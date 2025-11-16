# FlashForgeUI-Electron Development Guide

**Last Updated:** 2025-11-15 18:54 ET (America/New_York)

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

## Bootstrapping & Entry Points

- `src/bootstrap.ts` **must** be the first import inside `src/index.ts`. It sets the Electron app name/AppUserModelID before singletons (ConfigManager, PrinterDetailsManager, etc.) read `app.getPath('userData')`, preventing headless/Desktop desync.
- `src/index.ts` orchestrates the main process: enforces single-instance locks, parses CLI/headless flags, registers all IPC handlers (`src/ipc/handlers/index.ts` + legacy handlers), instantiates managers/services, and only creates windows after everything else is wired.
- `src/preload.ts` exposes the typed `window.api` bridge with whitelisted channels plus scoped APIs (`loading`, `camera`, `printerContexts`, `printerSettings`, `spoolman`, etc.). Every renderer (main window + dialogs) depends on this contract, so keep backward compatibility and cleanup helpers (`removeListener`, `removeAllListeners`) intact.
- `src/renderer.ts` and helpers under `src/renderer/*.ts` initialize the component system, printer tabs, shortcut buttons, layout persistence, and logging hooks before delegating most logic to components/services in the main process.

## Architecture Snapshot

### Managers
- `src/managers/ConfigManager.ts` – centralized config store wrapping `AppConfig` (`src/types/config.ts`)
- `src/managers/PrinterContextManager.ts` – issues context IDs, tracks active context, propagates lifecycle events
- `src/managers/ConnectionFlowManager.ts` – discovery flows (GUI + headless), manual IP, auto-connect, saved printer restore
- `src/managers/PrinterBackendManager.ts` – instantiates + maps printer backends (`src/printer-backends/*`) per context
- `src/managers/PrinterDetailsManager.ts` – persists `printer_details.json` + per-printer settings inside `app.getPath('userData')`
- `src/managers/HeadlessManager.ts` – orchestrates `--headless` boot, WebUI startup, polling, and graceful shutdown
- `src/managers/LoadingManager.ts` – modal loading overlays surfaced via IPC (main window + dialogs)
- `src/windows/WindowManager.ts` / `src/windows/WindowFactory.ts` – renderer/window lifecycle coordination (main window + dialogs)

### Services (partial list)
- Polling & monitoring: `PrinterPollingService`, `MainProcessPollingCoordinator` (single-printer), `MultiContextPollingCoordinator`, `PrintStateMonitor`, `MultiContextPrintStateMonitor`, `TemperatureMonitoringService`, `MultiContextTemperatureMonitor`
- Connection/discovery: `PrinterDiscoveryService`, `ConnectionEstablishmentService`, `ConnectionStateManager`, `AutoConnectService`, `SavedPrinterService`, `DialogIntegrationService`
- Camera & streaming: `CameraProxyService`, `RtspStreamService`, `PortAllocator`, `ThumbnailCacheService`, `ThumbnailRequestQueue`
- Notifications: `PrinterNotificationCoordinator`, `MultiContextNotificationCoordinator`, `services/notifications/*`, `services/discord/DiscordNotificationService.ts`
- Filament: `SpoolmanService`, `SpoolmanIntegrationService`, `SpoolmanUsageTracker`, `MultiContextSpoolmanTracker`, `SpoolmanHealthMonitor`
- Misc/system: `PrinterDataTransformer`, `PrintStateMonitor`, `EnvironmentDetectionService`, `AutoUpdateService`, `LogService`, `StaticFileManager`

### IPC, UI, and Windows
- IPC entry: `src/ipc/handlers/index.ts` registers domain handlers (`backend`, `camera`, `component-dialog`, `connection`, `control`, `dialog`, `job`, `material`, `printer-settings`, `shortcut-config`, `spoolman`, etc.) plus supporting modules (`camera-ipc-handler.ts`, `printer-context-handlers.ts`, `WindowControlHandlers.ts`, legacy `DialogHandlers.ts`).
- Renderer entry: `src/renderer.ts` bootstraps printer tabs (`src/ui/components/printer-tabs`), `ComponentManager`, grid layout, shortcut buttons, and shared renderer helpers (`src/renderer/*.ts`).
- Dialogs/live UIs: `src/ui/` hosts component dialogs, gridstack dashboard, spoolman dialogs, palette/material dialogs, settings, shortcuts, uploaders, log windows, etc.
- Window definitions: `src/windows/dialogs/*`, `src/windows/factories/*` (including `ComponentDialogWindowFactory`).

### WebUI & Headless
- `src/index.ts` – Electron entry (detects `--headless`, sets headless mode, registers IPC, creates main window)
- `src/utils/HeadlessArguments.ts` / `HeadlessDetection.ts` / `HeadlessLogger.ts` – CLI + detection helpers shared by GUI/headless boots
- `src/webui/server/*` – WebUI server (WebUIManager, AuthManager, WebSocketManager) + domain routes (`routes/camera-routes.ts`, `context-routes.ts`, `job-routes.ts`, `printer-control-routes.ts`, `printer-status-routes.ts`, `spoolman-routes.ts`, `temperature-routes.ts`, etc.)
- `src/webui/static/*` – TypeScript client (state store, transport, features for auth/camera/spoolman/context switching, responsive grid system, dialogs, headers)

### Utilities & Types
- `src/utils/PortAllocator.ts` – per-context camera proxy ports (8181–8191 range)
- `src/utils/HeadlessArguments.ts`, `HeadlessDetection.ts`, `HeadlessLogger.ts`, `RoundedUICompatibility.ts`, `CSSVariables.ts`, `time|camera|error|extraction.utils.ts`, `EventEmitter.ts`
- `src/types/` – contexts, polling, config, printers, spoolman, discord, camera, printer backend operations, IPC

## Renderer Component System

- `ComponentManager` (`src/ui/components/ComponentManager.ts`) registers every component from `src/ui/components/**`, initializes them in DOM order, and fans out `polling-update` payloads. Keep component constructors idempotent—GridStack recreates DOM nodes frequently.
- Grid/backplane orchestration lives in `src/renderer/gridController.ts` + `src/ui/gridstack/*`. These modules handle component registration, palette toggles, edit mode, layout serialization, and widget hydration (log panel, job info, etc.).
- Printer tabs (`src/ui/components/printer-tabs/*`) provide the multi-context UX. IPC events from tabs feed directly into `PrinterContextManager`; avoid bypassing these events when adding context-sensitive UI.
- Renderer helpers: `src/renderer/perPrinterStorage.ts` (layout + shortcut persistence per context), `src/renderer/shortcutButtons.ts` (top-bar shortcuts + dialog wiring), `src/renderer/logging.ts` (shared log forwarding). Touch these only when changing renderer-wide behaviors.
- Component dialogs reuse the same component stack via `src/windows/factories/ComponentDialogWindowFactory.ts`, `src/ui/component-dialog/*`, and the mirrored preload (`component-dialog-preload.ts`). Import typings with `import type` only—runtime `.d.ts` imports break the preload bootstrap.

## Settings Dialog Architecture

The settings dialog uses a modular, section-based architecture for improved maintainability and testability:

- **Base Contract**: `src/ui/settings/sections/SettingsSection.ts` defines the `SettingsSection` interface with `initialize()` and `dispose()` lifecycle hooks. All sections implement this contract.
- **Section Implementations** (`src/ui/settings/sections/*.ts`):
  - `AutoUpdateSection`: Auto-update configuration and version checking
  - `DesktopThemeSection`: Theme selection with live CSS variable updates
  - `DiscordWebhookSection`: Discord webhook configuration and testing
  - `InputDependencySection`: Manages dependent input states (e.g., port fields enabled only when feature is enabled)
  - `PrinterContextSection`: Per-printer context indicator and settings toggle
  - `RoundedUISection`: Rounded UI toggle with platform compatibility checks and CSS injection
  - `SpoolmanTestSection`: Spoolman server connection testing
  - `TabSection`: Tab navigation state management
- **Orchestrator**: `src/ui/settings/settings-renderer.ts` instantiates all sections, coordinates lifecycle, manages dual settings routing (global config.json vs. per-printer printer_details.json), and handles save/validation logic.
- **Type Definitions**: `src/ui/settings/types.ts` and `src/ui/settings/types/external.ts` provide shared interfaces for settings APIs and mutable state.

When adding new settings sections:
1. Create a new class in `src/ui/settings/sections/` implementing the `SettingsSection` interface
2. Instantiate and wire it in `settings-renderer.ts`'s `initializeElements()` method
3. Call `initialize()` during setup and `dispose()` during cleanup
4. Keep section logic isolated—sections should not directly manipulate other sections' state

## IPC Handler Layout

- `src/ipc/handlers/index.ts` is the authoritative registry. Add new handlers there and ensure they are registered **before** any BrowserWindow is created.
- Domain handlers: `backend-handlers.ts`, `camera-handlers.ts`, `component-dialog-handlers.ts`, `connection-handlers.ts`, `control-handlers.ts`, `dialog-handlers.ts`, `job-handlers.ts`, `material-handlers.ts`, `printer-settings-handlers.ts`, `shortcut-config-handlers.ts`, `spoolman-handlers.ts`.
- Supporting modules: `camera-ipc-handler.ts` (legacy camera IPC surface), `printer-context-handlers.ts` (context CRUD + switching), `WindowControlHandlers.ts` (custom title bar), and `DialogHandlers.ts` (loading overlay + connection dialogs). Keep APIs in sync with the preload’s whitelist.
- When adding IPC channels, update `src/preload.ts` channel allowlists plus any typed surface (`PrinterContextsAPI`, `SpoolmanAPI`, etc.). Dialog-specific handlers should route through `component-dialog-handlers.ts` unless they are part of the legacy `DialogHandlers` path.

## Multi-Printer & Polling Flow

1. **Context creation**: `PrinterContextManager` issues IDs like `context-1-<timestamp>` whenever `ConnectionFlowManager` completes a connect path. Tabs in `PrinterTabsComponent` drive the active context via IPC.
2. **Backend wiring**: `PrinterBackendManager` instantiates the correct backend (Legacy, Adventurer5M, Adventurer5M Pro, AD5X) per context, exposes capability flags, and registers printer-specific helpers (material station ops, gcode routing, etc.).
3. **Polling cadence**: `MultiContextPollingCoordinator` spins up a `PrinterPollingService` per context. Active contexts poll every 3 s; inactive ones slow to 30 s but still push cached data instantly on tab switch. `MainProcessPollingCoordinator` remains for legacy single-printer paths.
4. **Derived monitors**: `MultiContextPrintStateMonitor`, `MultiContextTemperatureMonitor`, `MultiContextSpoolmanTracker`, and `MultiContextNotificationCoordinator` listen for new/remove events to wire per-context instances (print monitors, cooling monitors, spool usage trackers, notification coordinators). Services expect untouched `polling-update` payloads.
5. **Integrations**: Camera services (`CameraProxyService`, `RtspStreamService`) use `PortAllocator` to reserve unique MJPEG/RTSP ports per context. Discord + desktop notifications, Spoolman usage updates, and eventual web push flows (`ai_specs/webui-push-notifications.md`) hang off the same events.
6. **Cleanup**: When `PrinterContextManager` emits `context-removed`, every coordinator disposes listeners, closes sockets/servers, releases camera ports, and removes spoolman usage trackers/Discord timers to prevent leaks.

## Headless Mode & WebUI Operations

- CLI flags are parsed in `src/utils/HeadlessArguments.ts` and validated via `validateHeadlessConfig`. Supported modes: `--last-used`, `--all-saved-printers`, or `--printers="<ip>:<type>:<checkcode,...>"`. Extra flags include `--webui-port`, `--webui-password`, and camera overrides.
- `HeadlessManager.initialize()` (invoked from `src/index.ts`) forces `WebUIEnabled`, applies overrides, connects printers (respecting discovery + saved printers), starts the WebUI server, launches polling/camera proxies, and sets up graceful shutdown.
- Headless mode is documented for users in `docs/README.md` (update that doc whenever CLI or defaults change). `DEFAULT_CONFIG.WebUIPort` is **3000**; any mention of 3001 is legacy.
- The WebUI server (`src/webui/server/WebUIManager.ts`) wires Express, authentication (`AuthManager`), route registration (`server/routes/*.ts` for camera, contexts, jobs, printer control/status, spoolman, temperature, theme, filtration), and `WebSocketManager` for per-context real-time updates. Routes reuse the same services/IPC calls as the desktop UI—avoid duplicating logic.
- Static client code under `src/webui/static/*` mirrors the desktop component model: `app.ts` bootstraps, `core/AppState.ts` + `core/Transport.ts` manage state + IPC bridge, `features/*.ts` implement auth, camera streaming, context switching, job control, layout theme, spoolman, etc., and `grid/*` handles component registration + layout persistence (`WebUIComponentRegistry`, `WebUIGridManager`, `WebUILayoutPersistence`, `WebUIMobileLayoutManager`).
- `WebSocketManager` fans out polling updates per context and feeds the static client; headless deployments typically rely on this for dashboards with no desktop UI running.

## Camera & Streaming Stack

- `CameraProxyService` (MJPEG) spins up an Express proxy per context on ports 8181–8191 (managed by `PortAllocator`). Keep-alive timers were moved to the shared `CameraPriority` spec—do not recycle ports manually or short-circuit the allocator.
- `RtspStreamService` enables RTSP cameras by wrapping `node-rtsp-stream` + ffmpeg, exposing WebSocket ports starting at 9000 (per context). It auto-detects ffmpeg in common OS paths; missing ffmpeg should produce warnings but never crash the app.
- Renderer-side components (`src/ui/components/camera-preview`) and the WebUI both expect the proxy URLs emitted by these services. Maintain parity across GUI/headless flows (see `ai_specs/CAMERA_PRIORITY_SPEC.md` for rationale).

## Spoolman Integration & Filament Tracking

- Configuration toggles live in `AppConfig`: `SpoolmanEnabled`, `SpoolmanServerUrl`, `SpoolmanUpdateMode`. IPC handlers in `src/ipc/handlers/spoolman-handlers.ts` expose config/get/set/selection APIs to both renderer and WebUI.
- `SpoolmanIntegrationService` is the source of truth for active spool assignments. It persists selections per printer in `printer_details.json`, enforces AD5X/material-station blocking (feature detection + model prefix), validates configuration, and emits events for desktop/WebUI consumers. Do **not** bypass it.
- `SpoolmanService` wraps the REST API with 10 s timeouts, usage updates (weight or length), search, and connectivity checks. `SpoolmanUsageTracker` + `MultiContextSpoolmanTracker` listen for print completion/cooling to submit usage updates, while `SpoolmanHealthMonitor` pings the server and resets cache/UI state when connectivity flips.
- WebUI routing lives in `src/webui/server/routes/spoolman-routes.ts`; the static client feature is `src/webui/static/features/spoolman.ts`. Keep API responses consistent between desktop and WebUI flows.
- Renderer dialogs: `src/ui/spoolman-dialog`, `src/ui/spoolman-offline-dialog`, and spool badges/components embedded in both the main gridstack dashboard and component dialogs. Maintain `spoolman-changed` events so everything rehydrates correctly.

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
| `npm run specs:list -- --type active|completed` | Lists AI spec Markdown files (top-level or archive) | Defaults to active specs; pass `--type completed` for `ai_specs/archive` |
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

**Bootstrapping & Entry**
- `src/bootstrap.ts` – sets app name/userData path before anything else loads
- `src/index.ts` – main-process orchestrator (imports bootstrap first, registers IPC, creates windows)
- `src/preload.ts` / `src/ui/component-dialog/component-dialog-preload.ts` – context bridges for main + dialog renderers

**Managers & Multi-Context Core**
- `src/managers/PrinterContextManager.ts`, `PrinterBackendManager.ts`, `ConnectionFlowManager.ts`, `PrinterDetailsManager.ts`, `HeadlessManager.ts`, `LoadingManager.ts`
- `src/services/MultiContextPollingCoordinator.ts`, `MultiContextPrintStateMonitor.ts`, `MultiContextTemperatureMonitor.ts`, `MultiContextSpoolmanTracker.ts`, `MultiContextNotificationCoordinator.ts`
- `src/services/MainProcessPollingCoordinator.ts`, `PrinterPollingService.ts` for legacy single-printer paths

**Backends & Printers**
- `src/printer-backends/*.ts` – Legacy, Adventurer5M, Adventurer5M Pro, AD5X implementations
- `src/printer-backends/ad5x/*` – material station transforms/types/utils

**Renderer & Components**
- `src/renderer.ts`, `src/renderer/gridController.ts`, `src/renderer/shortcutButtons.ts`, `src/renderer/perPrinterStorage.ts`, `src/renderer/logging.ts`
- `src/ui/components/**` (ComponentManager, printer tabs, job info, etc.) + `src/ui/gridstack/**` for layout/palette logic
- `src/ui/component-dialog/**` – component dialog renderer + preload mirrors

**IPC & Windows**
- `src/ipc/handlers/index.ts` + domain handlers in `src/ipc/handlers/*.ts`, `camera-ipc-handler.ts`, `printer-context-handlers.ts`, `WindowControlHandlers.ts`, `DialogHandlers.ts`
- `src/windows/WindowManager.ts`, `src/windows/factories/*`, `src/windows/dialogs/*`

**Settings Dialog**
- `src/ui/settings/settings-renderer.ts` – main orchestrator for dual settings management (global + per-printer)
- `src/ui/settings/sections/SettingsSection.ts` – base interface for modular sections
- `src/ui/settings/sections/*.ts` – individual setting sections (AutoUpdate, DesktopTheme, Discord, InputDependency, PrinterContext, RoundedUI, SpoolmanTest, Tab)
- `src/ui/settings/types.ts`, `src/ui/settings/types/external.ts` – shared type definitions

**Camera, Notifications & Ports**
- `src/services/CameraProxyService.ts`, `RtspStreamService.ts`, `src/utils/PortAllocator.ts`
- `src/services/notifications/*`, `src/services/discord/DiscordNotificationService.ts`

**Spoolman & Filament**
- `src/services/SpoolmanIntegrationService.ts`, `SpoolmanService.ts`, `SpoolmanUsageTracker.ts`, `SpoolmanHealthMonitor.ts`
- `src/ipc/handlers/spoolman-handlers.ts`, `src/ui/spoolman-dialog/*`, `src/ui/spoolman-offline-dialog/*`
- `src/webui/server/routes/spoolman-routes.ts`, `src/webui/static/features/spoolman.ts`

**Headless & WebUI**
- `src/utils/HeadlessArguments.ts`, `HeadlessDetection.ts`, `HeadlessLogger.ts`, `src/managers/HeadlessManager.ts`
- `src/webui/server/*` (WebUIManager, AuthManager, WebSocketManager, route modules) + `src/webui/static/*` (AppState, Transport, features, grid)
- `docs/README.md` – user-facing headless instructions (keep updated)

**Specs & References**
- `ai_reference/ARCHITECTURE.md` – additional architecture primer
- `ai_reference/typescript-best-practices.md`, `ai_reference/electron-typescript-best-practices.md`
- `ai_specs/CAMERA_PRIORITY_SPEC.md` – camera proxy + RTSP behavior
- `ai_specs/webui-push-notifications.md` – upcoming WebUI push feature plan

## Fileoverview Inventory

- `fileoverview-report.md` (repo root) aggregates every `@fileoverview` block across `src/**/*.ts`. Use it to understand module responsibilities quickly before editing; it lists ~230 entries with filenames plus their summaries.
- `npm run find:console` surfaces `console.<level>` calls (pass `-- --level=debug` etc.) so you can strip leftover logs before packaging or focus on specific severities quickly.
- `npm run find:lucide` shows every file touching Lucide icons, making it simple to prune unused imports or confirm icon hydration paths.
- Run `npm run docs:check` to ensure new/updated files keep their `@fileoverview` headers synchronized with this inventory.

## Reference Material

- `ai_reference/ARCHITECTURE.md`: overall system map (consult early).
- `ai_reference/typescript-best-practices.md` & `ai_reference/electron-typescript-best-practices.md`: required reading for code-style and IPC rules.
- `AGENTS.md`, `GEMINI.md`, `QWEN.md`: sibling agent guides for cross-AI alignment.
- `docs/README.md`: user-facing setup + headless instructions (update alongside feature changes).
- `ai_specs/*`: authoritative specs for in-flight features; always review before touching scoped areas.

Keep this guide synchronized with the repository—update sections when services, flows, or specs change.
