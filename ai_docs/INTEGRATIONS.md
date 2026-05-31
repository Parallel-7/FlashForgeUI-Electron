# External Integrations

**Last Updated:** 2026-03-11 17:36 ET (America/New_York)

This document covers camera streaming, Spoolman filament tracking, and notification systems.

---

## Camera & Streaming Stack

- `Go2rtcService` provides unified camera streaming using go2rtc as the streaming gateway. It replaces both the old MJPEG proxy and RTSP-to-WebSocket approaches with a single, consistent interface.

- `Go2rtcBinaryManager` handles the go2rtc binary lifecycle (download, update, start/stop). The binary is stored in the userData directory and automatically managed.

- Ports are hardcoded in `Go2rtcBinaryManager`: **1984** for the go2rtc API, **8555** for WebRTC. These are fixed values and do not require dynamic allocation.

- go2rtc handles all protocol conversion internally: RTSP/MJPEG sources are converted to WebRTC, MSE, or MJPEG fallback for browser consumption. This eliminates the canvas rotation bug from JSMpeg and reduces latency to ~500ms.

- Renderer-side components (`src/renderer/src/ui/components/camera-preview`) and WebUI (`src/main/webui/static/features/camera.ts`) consume go2rtc streams via `video-rtc.js` (WebRTC) or native `<video>` elements.

### Go2rtcService (`src/main/services/Go2rtcService.ts`)

- Unified streaming for all camera types (builtin RTSP, custom MJPEG/RTSP)
- Protocol-agnostic: go2rtc handles RTSP → WebRTC/MSE/MJPEG conversion
- Per-context stream management with unique stream names
- Automatic reconnection built into go2rtc
- No ffmpeg dependency for basic streaming (go2rtc includes native RTSP support)
- Status monitoring and stream info API

### Go2rtcBinaryManager (`src/main/services/Go2rtcBinaryManager.ts`)

- Downloads platform-specific go2rtc binary on first use
- Stores binary in userData/go2rtc/
- Checks for updates on startup (optional, version-pinned by default)
- Manages binary process lifecycle (start/stop/restart)
- Configures go2rtc with streams from active printer contexts

### CameraStreamCoordinator (`src/main/services/CameraStreamCoordinator.ts`)

- Provides shared camera stream reconciliation helpers for desktop IPC and WebUI routes
- Main entry point: `resolveAndEnsureCameraStream()` - resolves camera config and ensures go2rtc stream exists
- Combines camera configuration resolution with go2rtc stream management
- Handles stream cleanup when cameras become unavailable
- Returns `EnsuredCameraStream` with resolved config and stream configuration

### camera-utils (`src/main/utils/camera-utils.ts`)

- Priority-based camera resolution: custom camera > OEM camera > none
- MJPEG and RTSP stream type detection via URL protocol parsing
- URL validation with detailed error messages (protocol, hostname, format)
- Context-aware camera configuration retrieval (per-printer or global settings)
- Proxy URL formatting for go2rtc WebSocket and MJPEG endpoints

### Legacy Camera Services (Deprecated)

The following services have been replaced by go2rtc:
- `CameraProxyService` (MJPEG proxy) → now handled by go2rtc
- `RtspStreamService` (node-rtsp-stream + ffmpeg) → now handled by go2rtc

Do not use these legacy services for new code.

---

## Spoolman Integration & Filament Tracking

- Configuration toggles live in `AppConfig`: `SpoolmanEnabled`, `SpoolmanServerUrl`, `SpoolmanUpdateMode`. IPC handlers in `src/main/ipc/handlers/spoolman-handlers.ts` expose config/get/set/selection APIs to both renderer and WebUI.

- `SpoolmanIntegrationService` is the source of truth for active spool assignments. It persists selections per printer in `printer_details.json`, enforces AD5X/material-station blocking (feature detection + model prefix), validates configuration, and emits events for desktop/WebUI consumers. Do **not** bypass it.

- `SpoolmanService` wraps the REST API with 10 s timeouts, usage updates (weight or length), search, and connectivity checks. `SpoolmanUsageTracker` + `MultiContextSpoolmanTracker` listen for print completion/cooling to submit usage updates, while `SpoolmanHealthMonitor` pings the server and resets cache/UI state when connectivity flips.

- WebUI routing lives in `src/main/webui/server/routes/spoolman-routes.ts`; the static client feature is `src/main/webui/static/features/spoolman.ts`. Keep API responses consistent between desktop and WebUI flows.

- Renderer dialogs: `src/renderer/src/ui/spoolman-dialog`, `src/renderer/src/ui/spoolman-offline-dialog`, and spool badges/components embedded in both the main gridstack dashboard and component dialogs. Maintain `spoolman-changed` events so everything rehydrates correctly.

### SpoolmanService (`src/main/services/SpoolmanService.ts`)

- REST API client (10s timeout)
- Operations: ping, getSpool, searchSpools, useFilament

### SpoolmanIntegrationService (`src/main/services/SpoolmanIntegrationService.ts`)

- Single source of truth for active spool selections
- Per-printer persistence in printer_details.json
- AD5X/material-station blocking
- Event broadcasting: 'spoolman-changed'

### SpoolmanUsageTracker / MultiContextSpoolmanTracker

- Listen to 'cooling-complete' events
- Calculate usage from job metadata
- Submit to Spoolman API
- Per-context tracker instances

### MultiContextSpoolmanTracker (`src/main/services/MultiContextSpoolmanTracker.ts`)

- Manages per-context SpoolmanUsageTracker instances for all connected printers
- Maps context IDs to individual SpoolmanUsageTracker instances
- Listens to PrinterContextManager events for context lifecycle (creation/removal)
- Creates trackers when print state monitors are ready for each context
- Handles automatic cleanup when contexts are removed
- Works in both GUI and headless modes (no mode-specific checks)
- Forwards events from individual trackers to global listeners
- Singleton pattern with global instance via `getMultiContextSpoolmanTracker()`

---

## Notifications & External Integrations

- Desktop notifications flow through `src/main/services/notifications/NotificationService` + `PrinterNotificationCoordinator`.

- `MultiContextNotificationCoordinator` ensures every context gets its own coordinator regardless of which tab is active.

- Discord integration (`src/main/services/discord/DiscordNotificationService.ts`) mirrors printer events to webhook embeds with rate limiting and per-context timers. Config keys: `DiscordSync`, `WebhookUrl`, `DiscordUpdateIntervalMinutes`.

- Web push notifications are specced in `ai_specs/webui-push-notifications.md`. Implementations should add `WebPushService`, subscription managers, and WebUI UI/worker updates without regressing desktop/Discord flows.

### NotificationService (`src/main/services/notifications/NotificationService.ts`)

- Desktop notification wrapper
- Platform compatibility detection
- Lifecycle events (sent, clicked, closed)
- 24-hour retention
- Silent notification support

### MultiContextNotificationCoordinator

- Per-printer notification coordinators
- Shared NotificationService
- Independent state per context
- Notification types: completion, cooling, errors, material station

### DiscordNotificationService (`src/main/services/discord/DiscordNotificationService.ts`)

- Webhook integration
- Timer-based updates (configurable interval, default 5min)
- Event-driven: Print complete, printer cooled, idle transition
- Per-context tracking with state caching
- Rich embeds with temperatures, progress, material usage
- Rate limiting (1s delay between messages)

---

## Persistence & Saved Printers

- `PrinterDetailsManager` manages JSON persistence for printers, last-used serials, per-printer settings (camera, LEDs, spoolman, custom features) and stores runtime context-to-printer mappings.

- `SavedPrinterService` exposes helpers to match discovered printers, track IP changes, and update `lastConnected`. It is the single source for UI lists and headless boot data.

- `AutoConnectService` and `ConnectionFlowManager` rely on these stores to auto-launch saved printers or rehydrate contexts after restarts.

---

## Key File Locations

**Camera, Notifications & Ports**
- `src/main/services/Go2rtcService.ts`, `Go2rtcBinaryManager.ts`, `CameraStreamCoordinator.ts`
- `src/main/utils/camera-utils.ts`
- `src/main/ipc/camera-ipc-handler.ts`, `src/main/webui/server/routes/camera-routes.ts`
- `src/main/services/notifications/*`, `src/main/services/discord/DiscordNotificationService.ts`

**Spoolman & Filament**
- `src/main/services/SpoolmanIntegrationService.ts`, `SpoolmanService.ts`, `SpoolmanUsageTracker.ts`, `SpoolmanHealthMonitor.ts`, `MultiContextSpoolmanTracker.ts`
- `src/main/ipc/handlers/spoolman-handlers.ts`, `src/renderer/src/ui/spoolman-dialog/*`, `src/renderer/src/ui/spoolman-offline-dialog/*`
- `src/main/webui/server/routes/spoolman-routes.ts`, `src/main/webui/static/features/spoolman.ts`
