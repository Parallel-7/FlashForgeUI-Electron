# FlashForgeUI-Electron Development Guide

**Last Updated:** 2026-03-06 17:54 ET (America/New_York)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Keeping This File Current

**IMPORTANT**: This file is automatically loaded into Claude Code's context at the start of each session. To ensure accuracy:

1. **Check the timestamp** above against the current date/time at the start of each session
2. **If it's been more than 24 hours** since the last update, suggest reviewing and updating this file
3. **After confirming with the user**, review all sections for accuracy against the current codebase state
4. **Update the timestamp** after making any changes to this file
5. **CRITICAL**: ALWAYS use the `mcp__time__get_current_time` tool with timezone `America/New_York` to get the accurate current time before updating the timestamp - NEVER guess or manually write timestamps

The information in this file directly influences how Claude Code understands and works with the codebase, so keeping it current is essential for effective assistance.

---

## Project Overview

FlashForgeUI is an Electron-based desktop and headless controller for FlashForge printers. It supports multi-context printing, material station workflows, Spoolman-powered filament tracking, go2rtc-based camera streaming (WebRTC/MSE), Discord + desktop notifications, and a fully authenticated WebUI. The app runs on Windows/macOS/Linux with both GUI and headless entry points (headless automatically boots the WebUI server).

---

## Architecture Quick Reference

For detailed architectural information, see the comprehensive reference documents in `ai_docs/`:

- **[ARCHITECTURE.md](ai_docs/ARCHITECTURE.md)** - High-level system overview, bootstrap sequence, managers, services, file organization
- **[MULTI_CONTEXT.md](ai_docs/MULTI_CONTEXT.md)** - Multi-printer context system, coordinators, polling architecture, service dependencies
- **[IPC_COMMUNICATION.md](ai_docs/IPC_COMMUNICATION.md)** - IPC handlers, security model, communication patterns, handler registration
- **[UI_COMPONENTS.md](ai_docs/UI_COMPONENTS.md)** - Renderer architecture, component system, settings dialog, GridStack layout
- **[WEBUI_HEADLESS.md](ai_docs/WEBUI_HEADLESS.md)** - Headless mode, WebUI server, static client, CLI modes
- **[INTEGRATIONS.md](ai_docs/INTEGRATIONS.md)** - Camera streaming, Spoolman, notifications, Discord, persistence
- **[THEME_SYSTEM.md](ai_docs/THEME_SYSTEM.md)** - CSS variables, theme computation, design patterns, hardcoded CSS detection
- **[TOOLING.md](ai_docs/TOOLING.md)** - Development tools, commands, testing constraints, code search MCP tools

---

## Development Workflow Expectations

- **Invoke the `best-practices` skill** for universal software engineering principles (SOLID, DRY, KISS, YAGNI, etc.) and the `electron` skill for Electron-specific guidance. These skills provide authoritative best practices.

- **Gather context efficiently**: Prefer `code-search-mcp` tools for fast, comprehensive codebase searching (see [TOOLING.md](ai_docs/TOOLING.md)). For simple queries, use `Grep` or `Glob` built-in tools.

- **Package Manager**: This project uses **pnpm** (not npm or yarn). Use `pnpm install`, `pnpm add`, `pnpm <script>`, or `pnpm run <script>` for all package operations.

- **Windows Python**: On this Windows development environment, always use `python` not `python3` when running Python scripts or skills.

- **Plan before coding**: create a multi-step plan (skip only for trivial edits) and keep it updated as you complete steps.

- **Editing**: prefer `Edit` tool for targeted changes, keep diffs minimal, and never revert user-owned changes. Maintain ASCII unless the file already uses Unicode.

- **Documentation**: every repo-maintained `.ts`, `.tsx`, `.js`, `.jsx`, and `.cjs` source file should begin with an `@fileoverview` block describing purpose, key exports, and relationships. Use `pnpm docs:check` to catch gaps under `src/` and `pnpm docs:combine` to refresh `fileoverview-report.md`.

- **Testing workflow**: `pnpm test` runs Jest over `src/`, `pnpm test:e2e` runs browser Playwright against the built WebUI fixture server, and `pnpm test:e2e:electron*` covers desktop Playwright flows. `test:all` currently excludes the Electron suites, so run the Electron slice explicitly when desktop behavior changes.

- **Validation**: run the smallest meaningful checks (`pnpm type-check`, `pnpm lint`, targeted scripts) before handing work back. Reserve `pnpm build*` for user requests or when architectural changes demand it.

- **Completion Checklist** (from [TOOLING.md](ai_docs/TOOLING.md)):
  1. Run type checking, if there's errors iterate until they are fixed properly (no band-aids, etc)
  2. Once type checking passes, run build. This ensures electron-vite compiles both main and renderer processes without errors, and if there are any, iterate until they are fixed properly (no band-aids, etc)
  3. Once build passes, the final check is running lint. It's important to never ignore the errors, the more they pile up the harder it becomes to do cleanups/maintain the codebase.

  Do not say you are done with something despite not having run one/any of these checks, and the same if one fails. All must be run and pass to ensure codebase quality and production readiness.

---

## Recent Lessons

1. Component dialog preloads must import typings with `import type {} from '../../types/global';` - runtime `.d.ts` imports break the dialog bootstrap.

2. The component dialog expects untouched `polling-update` payloads; do not transform the shape before forwarding to `ComponentManager.updateAll`.

3. GridStack initialization (`src/ui/gridstack/`) already registers and wires widgets (for example, the log panel). Removing or duplicating that flow leaves globals unset.

4. Spoolman integration deliberately blocks AD5X/material-station contexts (`src/services/SpoolmanIntegrationService.ts`). Removing the guard regresses filament safety checks.

5. **Camera streaming**: `Go2rtcService` provides unified streaming via go2rtc (WebRTC/MSE). `Go2rtcBinaryManager` handles binary lifecycle and configuration handoff. Do not manually configure go2rtc streams outside that service stack.

6. Headless mode and desktop mode share the same connection/polling/camera stack. Avoid `isHeadlessMode()` forks unless absolutely necessary; duplicating logic leads to drift.

7. **Theme System**: NEVER hardcode colors in CSS. Always use CSS variables from the theme system (`--theme-primary`, `--theme-primary-hover`, `--surface-elevated`, etc.). The theme system handles light/dark themes automatically. See [THEME_SYSTEM.md](ai_docs/THEME_SYSTEM.md).

8. **Per-printer settings access**: `PrinterDetailsManager` does NOT have a `getSettings()` method. Per-printer settings (like `showCameraFps`, `customCameraUrl`, `rtspFrameRate`, etc.) are stored directly on `PrinterDetails`. Access them via `context.printerDetails.showCameraFps` rather than inventing manager methods. See `src/shared/types/printer.ts` for the full `PrinterDetails` interface.

9. **Release versioning**: Semver treats stable versions as newer than prereleases with the same base (`1.0.3 > 1.0.3-alpha.X`). After releasing a stable version, the next alpha MUST bump the version number. Correct flow:
   ```
   1.0.3-alpha.1 -> 1.0.3-alpha.2 -> 1.0.3 (stable)
                                  |
   1.0.4-alpha.1 -> 1.0.4-alpha.2 -> 1.0.4 (stable)
   ```
   Never continue `X.Y.Z-alpha.N` after releasing `X.Y.Z` stable - `electron-updater` will look for `alpha.yml` in the stable release (which doesn't have it) and 404.

10. **Legacy mode is per-printer**: backend selection must read the saved printer/context setting instead of any global `ForceLegacyAPI` override. If a 5M-series printer needs legacy behavior, seed or update that printer's own settings rather than adding a process-wide fallback.

11. **Discovery alignment**: the desktop discovery path now follows the updated `@ghosttypes/ff-api` discovery API. If printers connect but tab state or discovery rows look wrong, inspect `src/main/index.ts`, `PrinterDiscoveryService.ts`, and renderer tab updates together instead of patching only one layer.

12. **WebUI cache regressions**: built WebUI assets must remain version-stamped and served with no-cache headers. The browser Playwright suite exists specifically to catch stale asset mixes, icon hydration mismatches, and camera bootstrap regressions before release.

13. **Desktop E2E boundaries**: use `tests/e2e/electron/desktop-smoke.spec.ts` for live `%APPDATA%` smoke coverage and `tests/e2e/electron/desktop-emulator.spec.ts` for isolated emulator-backed lifecycle coverage. On Windows, prefer the dedicated `package.json` scripts over ad hoc Playwright grep invocations.

---

## Key File Locations

### Bootstrapping & Entry

- `src/main/bootstrap.ts` - sets app name/userData path before anything else loads
- `src/main/index.ts` - main-process orchestrator (imports bootstrap first, registers IPC, creates windows)
- `src/preload/index.ts` / `src/renderer/src/ui/component-dialog/component-dialog-preload.ts` - context bridges for main + dialog renderers

### Managers & Multi-Context Core

- `src/main/managers/PrinterContextManager.ts`, `PrinterBackendManager.ts`, `ConnectionFlowManager.ts`, `PrinterDetailsManager.ts`, `HeadlessManager.ts`, `LoadingManager.ts`
- `src/main/services/MultiContextPollingCoordinator.ts`, `MultiContextPrintStateMonitor.ts`, `MultiContextTemperatureMonitor.ts`, `MultiContextSpoolmanTracker.ts`, `MultiContextNotificationCoordinator.ts`
- `src/main/services/MainProcessPollingCoordinator.ts`, `PrinterPollingService.ts` for legacy single-printer paths

### Backends & Printers

- `src/main/printer-backends/*.ts` - Legacy, Adventurer5M, Adventurer5M Pro, AD5X implementations
- `src/main/printer-backends/ad5x/*` - material station transforms/types/utils

### Renderer & Components

- `src/renderer/src/renderer.ts`, `src/renderer/src/gridController.ts`, `src/renderer/src/shortcutButtons.ts`, `src/renderer/src/perPrinterStorage.ts`, `src/renderer/src/logging.ts`
- `src/renderer/src/ui/components/**` (ComponentManager, printer tabs, job info, etc.) + `src/renderer/src/ui/gridstack/**` for layout/palette logic
- `src/renderer/src/ui/component-dialog/**` - component dialog renderer + preload mirrors

### IPC & Windows

- `src/main/ipc/handlers/index.ts` + domain handlers in `src/main/ipc/handlers/*.ts`, `camera-ipc-handler.ts`, `printer-context-handlers.ts`, `WindowControlHandlers.ts`, `DialogHandlers.ts`
- `src/main/windows/WindowManager.ts`, `src/main/windows/WindowFactory.ts`, `src/main/windows/factories/*`, `src/main/windows/dialogs/*`

### Settings Dialog

- `src/renderer/src/ui/settings/settings-renderer.ts` - main orchestrator for dual settings management (global + per-printer)
- `src/renderer/src/ui/settings/sections/SettingsSection.ts` - base interface for modular sections
- `src/renderer/src/ui/settings/sections/*.ts` - individual setting sections (AutoUpdate, DesktopTheme, Discord, InputDependency, PrinterContext, RoundedUI, SpoolmanTest, Tab)
- `src/renderer/src/ui/settings/types.ts`, `src/renderer/src/ui/settings/types/external.ts` - shared type definitions

### Camera & Notifications

- `src/main/services/Go2rtcService.ts`, `Go2rtcBinaryManager.ts`
- `src/main/ipc/camera-ipc-handler.ts`, `src/main/webui/server/routes/camera-routes.ts`
- `src/main/services/notifications/*`, `src/main/services/discord/DiscordNotificationService.ts`

### Spoolman & Filament

- `src/main/services/SpoolmanIntegrationService.ts`, `SpoolmanService.ts`, `SpoolmanUsageTracker.ts`, `SpoolmanHealthMonitor.ts`
- `src/main/ipc/handlers/spoolman-handlers.ts`, `src/renderer/src/ui/spoolman-dialog/*`, `src/renderer/src/ui/spoolman-offline-dialog/*`
- `src/main/webui/server/routes/spoolman-routes.ts`, `src/main/webui/static/features/spoolman.ts`

### Headless & WebUI

- `src/main/utils/HeadlessArguments.ts`, `HeadlessDetection.ts`, `HeadlessLogger.ts`, `src/main/managers/HeadlessManager.ts`
- `src/main/webui/server/*` (WebUIManager, AuthManager, WebSocketManager, route modules) + `src/main/webui/static/*` (AppState, Transport, features, grid)
- `docs/README.md` - user-facing headless instructions (keep updated)

### Testing & Automation

- `src/**/__tests__/*` - Jest coverage for managers, services, calibration, WebUI server/routes, WebUI static helpers, and build utilities
- `tests/e2e/browser/webui-smoke.spec.ts`, `tests/e2e/browser/webui-auth.spec.ts`, `tests/e2e/browser/helpers/webui-fixture-server.ts` - browser Playwright coverage for the built WebUI
- `tests/e2e/electron/desktop-smoke.spec.ts` - live desktop smoke test against the local FlashForgeUI profile
- `tests/e2e/electron/desktop-emulator.spec.ts`, `tests/e2e/electron/helpers/emulator-harness.ts` - emulator-backed Electron lifecycle coverage across modern and legacy printers
- `tests/fixtures/calibration/` - synthetic calibration fixture data (not referenced by automated tests; used for manual local testing)
- `scripts/run-playwright-electron-live.cjs`, `scripts/run-playwright-electron-emulator.cjs` - entry points for the Electron Playwright suites
- `package.json` - canonical place for the Electron slice scripts (`test:e2e:electron:emulator`, `:legacy`, `:legacy-multi`, `:modern-multi`, `:smoke`, `:live`)

---

## Reference Material

### AI Reference Documentation

- **[ARCHITECTURE.md](ai_docs/ARCHITECTURE.md)**: High-level system overview and architectural patterns
- **Specialized Guides**: See full list in Architecture Quick Reference section above

### Other Documentation

- **`GEMINI.md`, `QWEN.md`**: Sibling agent guides for cross-AI alignment
- **`docs/README.md`**: User-facing setup + headless instructions (update alongside feature changes)
- **`ai_specs/*`**: Authoritative specs for in-flight features; always review before touching scoped areas
- **`ai_specs/CAMERA_PRIORITY_SPEC.md`**: Camera proxy + RTSP behavior specification
- **`ai_specs/webui-push-notifications.md`**: Upcoming WebUI push feature plan

### Code Inventory

- **`fileoverview-report.md`** (repo root): Aggregates every `@fileoverview` block across `src/**/*.{ts,tsx,js,jsx}`. Use it to understand module responsibilities quickly before editing and regenerate it with `pnpm docs:combine` after large doc/header refreshes.
- **`pnpm find:console`**: Surfaces `console.<level>` calls (pass `-- --level=debug` etc.) so you can strip leftover logs before packaging or focus on specific severities quickly.
- **`pnpm find:lucide`**: Shows every file touching Lucide icons, making it simple to prune unused imports or confirm icon hydration paths.
- **`pnpm docs:check`**: Ensures new/updated source files keep their `@fileoverview` headers synchronized with this inventory, including tests, vendored JS copies, and declaration files under `src/`.

---

Keep this guide synchronized with the repository - update sections when services, flows, specs, or test surfaces change.


