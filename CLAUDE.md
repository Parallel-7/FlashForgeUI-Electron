# FlashForgeUI-Electron Development Guide

**Last Updated:** 2025-11-14 16:44 ET (America/New_York)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping This File Current

**IMPORTANT**: This file is automatically loaded into Claude Code's context at the start of each session. To ensure accuracy:

1. **Check the timestamp** above against the current date/time at the start of each session
2. **If it's been more than 24 hours** since the last update, suggest reviewing and updating this file
3. **After confirming with the user**, review all sections for accuracy against the current codebase state
4. **Update the timestamp** after making any changes to this file
5. **CRITICAL**: ALWAYS use the `mcp__time__get_current_time` tool with timezone `America/New_York` to get the accurate current time before updating the timestamp - NEVER guess or manually write timestamps

The information in this file directly influences how Claude Code understands and works with the codebase, so keeping it current is essential for effective assistance.

## Project Overview

FlashForgeUI is an Electron-based desktop and headless controller for FlashForge printers. It supports multi-context printing, material station workflows, Spoolman-powered filament tracking, RTSP/MJPEG camera streaming, Discord + desktop notifications, and a fully authenticated WebUI. The app runs on Windows/macOS/Linux with both GUI and headless entry points (headless automatically boots the WebUI server).

## Architecture Snapshot

### Managers
- `src/managers/ConfigManager.ts` – centralized config store wrapping `AppConfig` (`src/types/config.ts`)
- `src/managers/PrinterContextManager.ts` – creates context IDs, tracks active context, relays lifecycle events
- `src/managers/ConnectionFlowManager.ts` – discovery, connection flows (GUI + headless), CLI connection helpers
- `src/managers/PrinterBackendManager.ts` – instantiates backends (`src/printer-backends/`) per context
- `src/managers/PrinterDetailsManager.ts` – persists `printer_details.json` in `app.getPath('userData')`
- `src/managers/HeadlessManager.ts` – orchestrates `--headless` boot, WebUI startup, polling, camera proxies
- `src/windows/WindowManager.ts` & `src/windows/WindowFactory.ts` – renderer/window lifecycle

### Services (partial list)
- Core polling/connectivity: `PrinterPollingService`, `PrintStateMonitor`, `TemperatureMonitoringService`, `CameraProxyService`, `RtspStreamService`, `PrinterDiscoveryService`, `ConnectionEstablishmentService`, `PrinterDataTransformer`, `ThumbnailCacheService`
- Multi-context coordinators: `MultiContextPollingCoordinator`, `MultiContextPrintStateMonitor`, `MultiContextTemperatureMonitor`, `MultiContextNotificationCoordinator`, `MultiContextSpoolmanTracker`
- Notifications: `services/notifications/*`, `services/discord/DiscordNotificationService.ts`
- Filament: `SpoolmanService`, `SpoolmanIntegrationService`, `SpoolmanUsageTracker`, `SpoolmanHealthMonitor`
- Misc: `AutoConnectService`, `AutoUpdateService`, `EnvironmentDetectionService`, `LogService`, `StaticFileManager`, `RtspStreamService`

### IPC, UI, and Windows
- IPC entry: `src/ipc/handlers/index.ts` (connection, jobs, materials, spoolman, camera, control, updates, printer context, WebUI)
- Renderer entry: `src/renderer.ts` plus `src/ui/components/printer-tabs` for multi-context tab UX
- Dialogs/live UIs: `src/ui/` (job picker, job uploader, component dialog, gridstack dashboard, spoolman dialogs, palette/material dialogs, settings, shortcuts)
- Window definitions: `src/windows/dialogs/*`, `src/windows/factories/*`

### WebUI & Headless
- `src/index.ts` – Electron entry (detects `--headless`, sets headless mode, registers IPC, creates main window)
- `src/utils/HeadlessArguments.ts` / `HeadlessDetection.ts` / `HeadlessLogger.ts`
- `src/webui/server/WebUIManager.ts`, `AuthManager.ts`, `api-routes.ts`, `WebSocketManager.ts`
- `src/webui/static/` – TypeScript app + service workers for remote UI

### Utilities & Types
- `src/utils/PortAllocator.ts` – per-context camera proxy ports (8181–8191)
- `src/utils/time|camera|error|validation.utils.ts`
- `src/types/` – contexts, polling, config, printer, spoolman, discord, node-rtsp-stream

## Multi-Printer & Polling Flow

1. **Context creation**: `PrinterContextManager` issues IDs like `context-1-<timestamp>` whenever `ConnectionFlowManager` completes a connect path.
2. **Backend wiring**: `PrinterBackendManager` chooses the correct backend (Legacy, A5M, A5M Pro, AD5X) per context and registers features.
3. **Polling**: `MultiContextPollingCoordinator` allocates a `PrinterPollingService` per context. Active context polls every 3s; inactive contexts stay at 3s to keep TCP alive while still forwarding cached data immediately on tab switch.
4. **Derived monitors**: `MultiContextPrintStateMonitor` feeds `PrintStateMonitor` instances. Temperature, usage, notification, and spoolman trackers register via their multi-context coordinators as soon as polling is ready.
5. **Notifications & integrations**: `MultiContextNotificationCoordinator` plugs OS notifications plus `DiscordNotificationService`. Planned Web Push hooks will reuse this path (`ai_specs/webui-push-notifications.md`).
6. **Cameras**: `CameraProxyService` (MJPEG) and `RtspStreamService` (node-rtsp-stream + ffmpeg) are invoked per context with unique ports from `PortAllocator`.
7. **Cleanup**: `PrinterContextManager` emits `context-removed`, allowing every coordinator/service (`MultiContext*`, camera proxies, spoolman trackers, Discord) to dispose resources and return ports.

Single-printer legacy mode still relies on `MainProcessPollingCoordinator` for the main-window happy path; multi-printer overrides that with the multi-context services above.

## Headless Mode & WebUI Operations

- CLI flags are parsed in `src/utils/HeadlessArguments.ts` and validated via `validateHeadlessConfig`. Supported modes: `--last-used`, `--all-saved-printers`, or `--printers="<ip>:<type>:<checkcode,...>"`. Extra flags: `--webui-port`, `--webui-password`.
- `HeadlessManager.initialize()` (invoked from `src/index.ts`) forces `WebUIEnabled`, applies overrides, connects printers (respecting discovery + saved printers), starts the WebUI server, launches polling/camera proxies, and sets up graceful shutdown.
- Headless mode is documented for users in `docs/README.md` (update that doc whenever CLI or defaults change). Note that `DEFAULT_CONFIG.WebUIPort` is **3000**, so references to 3001 are legacy.
- The WebUI server (`WebUIManager`) hosts Express + WS, enforces authentication via `AuthManager` (HMAC-signed tokens), and serves static assets resolved by `EnvironmentDetectionService`. API routes live in `src/webui/server/api-routes.ts` and reuse IPC/services for data access.
- `WebSocketManager` fans out polling updates to WebUI clients per context; headless setups typically rely on this for real-time dashboards.

## Camera & Streaming Stack

- `CameraProxyService` (MJPEG) spins up an Express proxy per context on ports 8181–8191 (managed by `PortAllocator`). Keep-alive timers were moved to the shared `CameraPriority` spec—do not recycle ports manually or short-circuit the allocator.
- `RtspStreamService` enables RTSP cameras by wrapping `node-rtsp-stream` + ffmpeg, exposing WebSocket ports starting at 9000 (per context). It auto-detects ffmpeg in common OS paths; missing ffmpeg should produce warnings but never crash the app.
- Renderer-side components (`src/ui/components/camera-preview`) and the WebUI both expect the proxy URLs emitted by these services. Maintain parity across GUI/headless flows (see `ai_specs/CAMERA_PRIORITY_SPEC.md` for rationale).

## Spoolman Integration & Filament Tracking

- Configuration toggles live in `AppConfig`: `SpoolmanEnabled`, `SpoolmanServerUrl`, `SpoolmanUpdateMode`. Use IPC handlers in `src/ipc/handlers/spoolman-handlers.ts` to reach the services.
- `SpoolmanIntegrationService` enforces AD5X/material-station blocking (context feature inspection + printer model prefix). Never remove that guard: AD5X printers already manage spools internally.
- Active spool data persists per printer inside `printer_details.json` via `PrinterDetailsManager`, ensuring GUI, headless, and WebUI stay in sync.
- `SpoolmanService` wraps the REST API; `SpoolmanUsageTracker` + `MultiContextSpoolmanTracker` watch print/temperature events to push usage updates. `SpoolmanHealthMonitor` periodically validates connectivity so the UI can surface offline warnings.
- Renderer dialogs: `src/ui/spoolman-dialog`, `spoolman-offline-dialog`, and spool badges in the component dialog. Maintain event contracts so `spoolman-changed` broadcasts keep UI/WebUI consistent.

## Notifications & External Integrations

- Desktop notifications flow through `services/notifications/NotificationService` + `PrinterNotificationCoordinator`.
- `MultiContextNotificationCoordinator` ensures every context gets its own coordinator regardless of which tab is active.
- Discord integration (`src/services/discord/DiscordNotificationService.ts`) mirrors printer events to webhook embeds with rate limiting and per-context timers. Config keys: `DiscordSync`, `WebhookUrl`, `DiscordUpdateIntervalMinutes`.
- Web push notifications are specced in `ai_specs/webui-push-notifications.md`. Implementations should add `WebPushService`, subscription managers, and WebUI UI/worker updates without regressing desktop/Discord flows.

## Persistence & Saved Printers

- `PrinterDetailsManager` manages JSON persistence for printers, last-used serials, per-printer settings (camera, LEDs, spoolman, custom features) and stores runtime context-to-printer mappings.
- `SavedPrinterService` exposes helpers to match discovered printers, track IP changes, and update `lastConnected`. It is the single source for UI lists and headless boot data.
- `AutoConnectService` and `ConnectionFlowManager` rely on these stores to auto-launch saved printers or rehydrate contexts after restarts.

## Development Workflow Expectations

- **Read the references** in `ai_reference/typescript-best-practices.md` and `ai_reference/electron-typescript-best-practices.md` at the start of every coding session. They capture project-wide patterns (strict typing, IPC hygiene, preload rules, etc.).
- **Gather context with `rg`**/`rg --files` rather than slower commands. Use targeted `sed -n`/`node -p` for previews.
- **Plan before coding**: create a multi-step plan (skip only for trivial edits) and keep it updated as you complete steps.
- **Editing**: prefer `apply_patch` for manual changes, keep diffs minimal, and never revert user-owned changes. Maintain ASCII unless the file already uses Unicode.
- **Documentation**: every `.ts` file must begin with an `@fileoverview` block describing purpose, key exports, and relationships. Run `npm run docs:check` if unsure.
- **Validation**: run the smallest meaningful checks (`npm run type-check`, `npm run lint`, targeted scripts) before handing work back. Reserve `npm run build*` for user requests or when architectural changes demand it.

## Quality & Tooling

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run type-check` | `tsc --noEmit` for main process + shared types | Required before concluding substantial TypeScript changes |
| `npm run lint` / `lint:fix` | ESLint across `src/**/*.ts` | Run `lint:fix` first when practical; re-run lint to confirm |
| `npm run docs:check` | PowerShell script scanning for missing `@fileoverview` blocks | Use from Windows shell or ensure PowerShell is available |
| `npm run knip` (+variants) | Dead code/dependency analysis | Expect intentional false positives (Electron patterns) |
| `npm run build:*` | Build main / renderer / WebUI / platform packages | Only when user asks or when structural build impacts occur |
| `npm run linecount` | PowerShell LOC summary | Informational only |

## Testing & Runtime Constraints

Claude agents can run:
- Static inspection, reasoning about architecture
- `npm run type-check`, `npm run lint`, `npm run docs:check`, `npm run knip`
- Targeted node scripts (no GUI)

Agents **cannot**:
- Launch the Electron UI or WebUI interactively
- Connect to physical printers, cameras, or material stations
- Validate RTSP/MJPEG streams, LED hardware, or actual Spoolman servers
- Perform visual/UI regression testing or multi-window click-throughs

Call out unverified runtime assumptions explicitly in deliverables.

## Recent Lessons

1. Component dialog preloads must import typings with `import type {} from '../../types/global';`—runtime `.d.ts` imports break the dialog bootstrap.
2. The component dialog expects untouched `polling-update` payloads; do not transform the shape before forwarding to `ComponentManager.updateAll`.
3. GridStack initialization (`src/ui/gridstack/`) already registers and wires widgets (e.g., log panel). Removing or duplicating that flow leaves globals unset.
4. Spoolman integration deliberately blocks AD5X/material-station contexts (`src/services/SpoolmanIntegrationService.ts`). Removing the guard regresses filament safety checks.
5. Camera proxy keep-alive + port management live in `CameraProxyService`/`PortAllocator` and the camera priority spec. Do not bypass the allocator or reuse ports manually, especially in headless mode.
6. Headless mode and desktop mode share the same connection/polling/camera stack. Avoid `isHeadlessMode()` forks unless absolutely necessary; duplicating logic leads to drift.

## Key File Locations

**Multi-Printer Core**
- `src/managers/PrinterContextManager.ts` – context lifecycle + events
- `src/services/MultiContextPollingCoordinator.ts` – per-context polling orchestration
- `src/services/MultiContextPrintStateMonitor.ts`, `MultiContextTemperatureMonitor.ts`, `MultiContextSpoolmanTracker.ts`, `MultiContextNotificationCoordinator.ts`
- `src/utils/PortAllocator.ts` – camera proxy ports

**Backends & Printers**
- `src/printer-backends/*.ts` – Legacy, Adventurer5M, Adventurer5M Pro, AD5X implementations
- `src/printer-backends/ad5x/*` – material station transforms/types/utils
- `src/managers/PrinterBackendManager.ts` – backend instantiation

**Headless & WebUI**
- `src/index.ts` – entry + headless bootstrap
- `src/managers/HeadlessManager.ts` – headless orchestration
- `src/utils/HeadlessArguments.ts`, `HeadlessDetection.ts`, `HeadlessLogger.ts`
- `src/webui/server/*` – Express/WS server, auth, API routes
- `docs/README.md` – user-facing headless instructions (keep updated)

**Camera & Notifications**
- `src/services/CameraProxyService.ts`, `RtspStreamService.ts`
- `src/services/notifications/*`, `src/services/discord/DiscordNotificationService.ts`

**Spoolman**
- `src/services/SpoolmanIntegrationService.ts`, `SpoolmanService.ts`, `SpoolmanUsageTracker.ts`, `SpoolmanHealthMonitor.ts`
- `src/ipc/handlers/spoolman-handlers.ts`
- `src/ui/spoolman-dialog/*`, `src/ui/spoolman-offline-dialog/*`

**UI & Windows**
- `src/renderer.ts`, `src/ui/components/printer-tabs/*`, `src/ui/component-dialog/*`, `src/ui/gridstack/*`, job/material dialogs under `src/ui/`
- `src/windows/WindowManager.ts`, `src/windows/dialogs/*`

**Specs & References**
- `ai_reference/ARCHITECTURE.md` – additional architecture primer
- `ai_reference/typescript-best-practices.md`, `ai_reference/electron-typescript-best-practices.md`
- `ai_specs/CAMERA_PRIORITY_SPEC.md` – camera proxy + RTSP behavior
- `ai_specs/webui-push-notifications.md` – upcoming WebUI push feature plan

## Reference Material

- `ai_reference/ARCHITECTURE.md`: overall system map (consult early).
- `ai_reference/typescript-best-practices.md` & `ai_reference/electron-typescript-best-practices.md`: required reading for code-style and IPC rules.
- `AGENTS.md`, `GEMINI.md`, `QWEN.md`: sibling agent guides for cross-AI alignment.
- `docs/README.md`: user-facing setup + headless instructions (update alongside feature changes).
- `ai_specs/*`: authoritative specs for in-flight features; always review before touching scoped areas.

Keep this guide synchronized with the repository—update sections when services, flows, or specs change.
