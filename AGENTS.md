# Codex Agent Handbook

This guide captures project-specific expectations for OpenAI Codex agents assisting in the FlashForgeUI-Electron repository. It summarizes operational guardrails, preferred workflows, and high-value reference points so future Codex sessions can ramp up quickly without depending on Claude-only resources.

## Operating Rules for Codex

- **Shell usage**: Always invoke commands through `["bash","-lc", "<command>"]` and set the `workdir` on every call. Prefer `rg`/`rg --files` for search.
- **File editing**: Use `apply_patch` for hand-written edits; avoid it for auto-generated outputs (e.g., `npm install`, formatters). Never touch files outside user instructions and never revert user-owned changes.
- **Planning discipline**: Create multi-step plans for anything non-trivial and keep the plan in sync as work progresses. Skip planning only for the simplest tasks.
- **Testing mindset**: Favor targeted verification (type checking, linting) over full builds unless the user requests otherwise or build validation is obviously necessary.
- **Escalation etiquette**: Sandbox is `workspace-write`, network is restricted, and approval policy is `on-request`. Request elevation only when essential, providing concise justification.
- **Interaction style**: Keep responses concise, friendly, and actionable. Reference files with `path:line` syntax. Suggest next steps only when they are natural.

## Key Repository Facts

- **Project scope**: FlashForgeUI is an Electron desktop + headless controller coordinating multiple simultaneous printer contexts with camera streaming, polling, Spoolman, and WebUI/Discord integrations.
- **Architecture anchors**:
  - `src/bootstrap.ts`: sets the Electron app name/userData path before any singleton loads.
  - `src/index.ts`: orchestrates manager/service initialization, registers IPC handlers, and launches windows.
  - `src/preload.ts`: exposes the typed `window.api` bridge (loading, camera, printer contexts, spoolman, etc.).
  - `src/managers/PrinterContextManager.ts`: per-context lifecycle and active-context tracking.
  - `src/services/MultiContextPollingCoordinator.ts`: maintains per-context polling cadence (3 s active / 30 s inactive).
  - `src/ui/components/printer-tabs/`: renderer tab UX for switching contexts.
  - `src/ui/components/ComponentManager.ts` + `src/ui/gridstack/*`: component system + layout/palette orchestration.
  - `src/utils/PortAllocator.ts`: assigns unique camera proxy ports (8181‑8191) for MJPEG streams plus RTSP WebSocket ports.
- **Feature status**: Multi-printer and headless/WebUI flows are feature-complete but still unverified with live printers (filament tracking, simultaneous jobs, multi-camera). Treat runtime assumptions as unvalidated.
- **Documentation standard**: Every `.ts` file needs an `@fileoverview` block explaining purpose, exports, and dependencies. Generate `fileoverview-collection.json` via `npm run docs:combine` when you need module summaries, then run `npm run docs:clean` to delete it so the repo stays clean.

### Sample `@fileoverview` Blocks

```ts
/**
 * @fileoverview Connection flow orchestrator for managing printer discovery and connection workflows.
 *
 * Provides high-level coordination of printer connection operations in multi-context environment:
 * - Network discovery flow management with printer selection
 * - Direct IP connection support with check code prompts
 * - Auto-connect functionality for previously connected printers
 * - Saved printer management and connection restoration
 * - Connection state tracking and event forwarding
 * - Multi-context connection flow tracking for concurrent connections
 *
 * Key exports:
 * - ConnectionFlowManager class: Main connection orchestrator
 * - getPrinterConnectionManager(): Singleton accessor function
 *
 * The manager coordinates multiple specialized services:
 * - PrinterDiscoveryService: Network scanning and printer detection
 * - SavedPrinterService: Persistent printer storage
 * - AutoConnectService: Automatic connection on startup
 * - ConnectionStateManager: Connection state tracking
 * - DialogIntegrationService: User interaction dialogs
 * - ConnectionEstablishmentService: Low-level connection setup
 *
 * Supports concurrent connection flows with unique flow IDs and context tracking,
 * enabling multi-printer connections while maintaining proper state isolation.
 */
```

```ts
/**
 * @fileoverview Central WebUI server coordinator managing Express HTTP server and WebSocket lifecycle.
 *
 * Provides comprehensive management of the WebUI server including Express HTTP server initialization,
 * static file serving, middleware configuration, API route registration, WebSocket server setup,
 * and integration with printer backend services. Automatically starts when a printer connects
 * (if enabled in settings) and stops on disconnect. Handles administrator privilege requirements
 * on Windows platforms, network interface detection for LAN access, and configuration changes
 * for dynamic server restart. Coordinates between HTTP API routes, WebSocket real-time updates,
 * and polling data from the main process to provide seamless remote printer control and monitoring.
 *
 * Key exports:
 * - WebUIManager class: Main server coordinator with singleton pattern
 * - getWebUIManager(): Singleton accessor function
 * - Lifecycle: start, stop, initialize, startForPrinter, stopForPrinter
 * - Status: getStatus, isServerRunning, getExpressApp, getHttpServer
 * - Integration: handlePollingUpdate (receives status from main process)
 * - Events: 'server-started', 'server-stopped', 'printer-connected', 'printer-disconnected'
 */
```

```ts
/**
 * @fileoverview Printer Tabs Component for Multi-Printer Support
 *
 * This component provides a tabbed interface for managing multiple printer connections
 * similar to Orca-FlashForge's tabbed interface. It extends EventEmitter to notify
 * the renderer process of user interactions with tabs.
 *
 * Key features:
 * - Tab management (add, remove, switch, update)
 * - Connection status indicators (connected, connecting, disconnected, error)
 * - Close buttons on tabs with hover effects
 * - "Add Printer" button for creating new connections
 * - Event emission for tab interactions (click, close, add)
 * - Visual distinction between active and inactive tabs
 *
 * Events:
 * - 'tab-clicked': Emitted when a tab is clicked (contextId: string)
 * - 'tab-closed': Emitted when a tab's close button is clicked (contextId: string)
 * - 'add-printer-clicked': Emitted when the add printer button is clicked
 */
```

## High-Value Scripts & Commands

Use these npm scripts to enforce quality checks and gather insights:

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run type-check` | TypeScript validation (`tsc --noEmit`). | Report success/fail clearly; fix root causes before completion. |
| `npm run lint` / `npm run lint:fix` | ESLint checks and auto-fixes on `src/**/*.ts`. | Auto-fix first; re-run lint to confirm clean state. |
| `npm run docs:check` | PowerShell script scanning for missing `@fileoverview`. | Use findings to prioritize documentation updates. |
| `npm run knip` (+ variants) | Dead code and dependency analysis via Knip. | Review results carefully; Electron patterns create false positives. |
| `npm run build:*` | Build main, renderer, WebUI, or platform packages. | Run only when requested or required for verification. |

Remember PowerShell scripts (`docs:*`, `linecount`) assume Windows-friendly environment; confirm availability before invoking.

## Bootstrapping & Entry Points

- Always import `src/bootstrap.ts` first inside `src/index.ts`. It sets the app name/AppUserModelID before singletons read `app.getPath('userData')`, preventing headless/Desktop config drift.
- `src/index.ts` orchestrates the main process: single-instance locking, CLI/headless parsing, manager/service instantiation, IPC handler registration (`src/ipc/handlers/index.ts` + supporting modules), and delayed BrowserWindow creation until setup is complete.
- `src/preload.ts` defines the `window.api` bridge with strict channel allowlists and scoped APIs (`loading`, `camera`, `printerContexts`, `printerSettings`, `spoolman`, etc.). Update both the handler registry and preload allowlists whenever you add/remove IPC channels.
- Renderer helpers under `src/renderer/*.ts` (gridController, shortcutButtons, perPrinterStorage, logging) bootstrap ComponentManager, printer tabs, palette editing, and layout persistence before delegating to main-process services.

## Renderer Component System

- `ComponentManager` (`src/ui/components/ComponentManager.ts`) registers every component from `src/ui/components/**`, initializes them in DOM order, and pushes untouched `polling-update` payloads to each component. Constructors must be idempotent because GridStack frequently remounts DOM nodes.
- Grid/layout orchestration lives in `src/ui/gridstack/*` plus `src/renderer/gridController.ts`. These modules handle edit mode toggles, palette interactions, widget hydration (log panel, job info, etc.), and per-context layout serialization.
- Printer tabs (`src/ui/components/printer-tabs/*`) emit IPC events consumed by `PrinterContextManager`. Always route context changes through this component so services hear the same events as the UI.
- Component dialogs reuse the stack via `src/windows/factories/ComponentDialogWindowFactory.ts`, `src/ui/component-dialog/*`, and `component-dialog-preload.ts`. Keep imports `type`-only inside preloads to avoid runtime `.d.ts` issues.

## Settings Dialog Architecture

The settings dialog follows a modular section-based pattern for better isolation and testability:

- **Base Contract**: `src/ui/settings/sections/SettingsSection.ts` provides the `SettingsSection` interface with `initialize()` and `dispose()` hooks.
- **Section Classes** (`src/ui/settings/sections/*.ts`): AutoUpdateSection, DesktopThemeSection, DiscordWebhookSection, InputDependencySection, PrinterContextSection, RoundedUISection, SpoolmanTestSection, TabSection.
- **Main Orchestrator**: `src/ui/settings/settings-renderer.ts` instantiates sections, manages dual settings routing (global config.json vs. per-printer printer_details.json), coordinates lifecycle, and handles validation/save logic.
- **Type Definitions**: `src/ui/settings/types.ts` and `src/ui/settings/types/external.ts` define shared interfaces.

When extending settings, create a new section class implementing `SettingsSection`, wire it in `settings-renderer.ts`, and keep cross-section dependencies minimal.

## IPC Handler Layout

- `src/ipc/handlers/index.ts` registers all domain handlers: backend, camera, component-dialog, connection, control, dialog, job, material, palette, printer-settings, shortcut-config, spoolman, update, etc. Add new handlers there **before** creating BrowserWindows.
- Supporting modules (`src/ipc/camera-ipc-handler.ts`, `printer-context-handlers.ts`, `WindowControlHandlers.ts`, legacy `DialogHandlers.ts`) expose additional channels. Keep their channel names synchronized with the preload’s allowlists and typed APIs.
- When adding IPC, touch all three surfaces: handler implementation, preload allowlists/interfaces, and renderer-side consumers (main window + dialogs). Dialog-only channels belong in `component-dialog-handlers.ts`.

## Multi-Printer & Polling Flow

1. `PrinterContextManager` creates contexts when `ConnectionFlowManager` finishes discovery/connect flows. Printer tabs issue IPC calls to switch the active context.
2. `PrinterBackendManager` instantiates the correct backend (Legacy, Adventurer5M, Adventurer5M Pro, AD5X) per context and exposes capability flags/material station helpers.
3. `MultiContextPollingCoordinator` spins up a `PrinterPollingService` per context. Active contexts poll every 3 s; inactive ones poll every 30 s but still provide cached data instantly when tabs switch. `MainProcessPollingCoordinator` remains for single-printer legacy mode.
4. `MultiContextPrintStateMonitor`, `MultiContextTemperatureMonitor`, `MultiContextSpoolmanTracker`, and `MultiContextNotificationCoordinator` manage per-context monitors/trackers, ensuring print completion, cooling, spool usage, and notifications work regardless of the active tab.
5. `CameraProxyService` (MJPEG proxies) and `RtspStreamService` (RTSP→WebSocket relays) reserve ports via `PortAllocator` (8181‑8191 for MJPEG, 9000+ for RTSP). Never bypass the allocator or share ports manually.
6. On `context-removed`, coordinators dispose pollers, release ports, tear down camera proxies, and unregister spoolman/notification trackers to prevent leaks.

## Headless Mode & WebUI

- CLI arguments are parsed in `src/utils/HeadlessArguments.ts` (`--last-used`, `--all-saved-printers`, `--printers=ip:type:checkcode`, `--webui-port`, `--webui-password`, camera overrides). `HeadlessManager.initialize()` applies overrides, enables WebUI, connects printers, starts polling/camera services, and sets up graceful shutdown.
- WebUI server code lives in `src/webui/server/*` (WebUIManager, AuthManager, WebSocketManager, route modules for camera/context/job/printer-control/printer-status/spoolman/temperature/theme/filtration). These routes reuse the same managers + services as the desktop UI—avoid duplicating logic.
- Static WebUI client lives in `src/webui/static/*`: `app.ts` bootstraps, `core/AppState.ts` + `core/Transport.ts` handle state/IPC, `features/*.ts` implement auth, camera streaming, context switching, spoolman, job control, layout theme, etc., and `grid/*` implements remote component layouts.
- Update `docs/README.md` whenever headless flags/defaults change. The default WebUI port is 3000.

## Spoolman Integration & Filament Tracking

- Config toggles (`SpoolmanEnabled`, `SpoolmanServerUrl`, `SpoolmanUpdateMode`) live in `AppConfig` and surface through `src/ipc/handlers/spoolman-handlers.ts`.
- `SpoolmanIntegrationService` persists active spools in `printer_details.json`, enforces AD5X/material-station blocking, validates configuration, and emits events for renderer + WebUI. Treat it as the single source of truth—don’t bypass it for ad-hoc persistence.
- `SpoolmanService` wraps the REST API with 10 s timeouts. `SpoolmanUsageTracker` + `MultiContextSpoolmanTracker` update usage when prints complete/cooling finishes, while `SpoolmanHealthMonitor` periodically pings the server and clears cached selections when offline.
- Renderer dialogs live in `src/ui/spoolman-dialog/*` and `src/ui/spoolman-offline-dialog/*`; WebUI equivalents live in `src/webui/server/routes/spoolman-routes.ts` and `src/webui/static/features/spoolman.ts`. Keep API shapes/events consistent so both surfaces stay synced.

## Fileoverview Inventory

- Run `npm run docs:combine` to generate `fileoverview-collection.json`, which aggregates every `@fileoverview` block for quick module summaries while you work.
- After you're done, run `npm run docs:clean` to remove the generated file and keep the repo tidy.
- Continue to run `npm run docs:check` after creating or heavily modifying files to ensure headers remain accurate; this script powers the combined inventory.

## Recommended Workflow Templates

### General Code Change

1. **Context**: Review relevant files (`rg`, `codebase exploration`) and check `CLAUDE.md` for recent architecture notes.
2. **Plan**: Outline steps, call out affected modules and validation strategy.
3. **Implement**: Modify files via `apply_patch` with minimal, well-structured commits.
4. **Document**: Ensure new/changed files keep `@fileoverview` headers up to date.
5. **Verify**: Run `npm run type-check` and `npm run lint`; add other checks only if warranted.
6. **Report**: Summarize changes, mention validations, and suggest next steps (e.g., build, documentation review).

### Documentation-Only Task

1. Identify files lacking headers with `npm run docs:check`.
2. Read the target file to understand responsibilities.
3. Add or update the `@fileoverview` block using succinct prose that covers purpose, key exports, dependencies, and usage notes.
4. Re-run `npm run docs:check` if the user requests confirmation.

### Bug Investigation

1. Capture current state with `git status`/`git diff` if necessary (respect sandbox rules).
2. Trace the data flow and key code paths using targeted `rg` queries.
3. Hypothesize root cause; confirm by inspecting adjacent modules (services, managers, IPC handlers).
4. Plan remediation, communicate assumptions, and only then implement.

### Review Request

1. Focus on identifying defects, risky patterns, missing tests, or documentation gaps.
2. Reference findings with precise file locations (`path:line`).
3. Keep high-level summaries short; lead with concrete issues.

## Testing & Runtime Limitations

- Cannot launch the Electron app, manipulate real printers, or validate UI visually.
- Restricted to static analysis, type checking, linting, and script-driven tooling.
- Treat any runtime-dependent assumption as unverified; call it out in deliverables.

## Helpful Reference Files

- `CLAUDE.md`: High-level development guide (multi-printer architecture, testing limitations).
- `ai_reference/ARCHITECTURE.md`: Deep dive into system components and interactions.
- `ai_reference` folder: Central knowledge base for this project. Add new long-form guidance here and consult existing references before tackling related work.
- `ai_reference/typescript-best-practices.md` & `ai_reference/electron-typescript-best-practices.md`: **Mandatory pre-reading before any programming task.** Revisit these documents at the start of every coding session to stay aligned with project standards.
- `.claude/commands/*.md`: Predefined workflows (load changes, lint, type-check, auto-document, dead code analysis).

Consult these resources early in a session to align with established expectations.

## Recent Lessons

- Component dialog preload files must never import `.d.ts` modules at runtime—use `import type {} from '../../types/global';` to keep typings without breaking the window bootstrap.
- The dialog relies on untouched `polling-update` payloads; avoid “fixing” the shape or you risk swallowing updates and rendering an empty dialog.
- GridStack initialization already performs component registration/initialization; removing or duplicating that logic leaves global references (e.g., log panel) unset. Preserve the existing flow unless you have a tested replacement.

## Practical Tips for Codex

- Prefer incremental `rg` searches over full `find`/`grep` when locating files or symbols.
- When editing large files, consider using `sed -n 'start,endp'` to preview relevant sections before patching.
- Keep diffs minimal and purposeful; bundle related changes together.
- If instructions conflict, prioritize user directives → developer message → system message hierarchy.
- Surface uncertainties explicitly and propose validation steps the user can run (e.g., `npm run build`, manual UI tests).

By following this handbook, Codex agents can contribute confidently while honoring repository standards and operational constraints.
