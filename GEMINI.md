# FlashForgeUI-Electron Development Guide

**Last Updated:** 2026-01-20 18:15 ET (America/New_York)

This file provides guidance to Gemini when working with code in this repository.

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
- **[TOOLING.md](ai_docs/TOOLING.md)** - Development tools, commands, testing constraints, code search tools

---

## Development Workflow Expectations

- **Invoke the `best-practices` skill** for universal software engineering principles (SOLID, DRY, KISS, YAGNI, etc.) and the `electron` skill for Electron-specific guidance. These skills provide authoritative best practices.

- **Gather context efficiently**: Use `codebase_investigator` for broad analysis and `search_file_content` or `glob` for targeted searches.

- **Package Manager**: This project uses **pnpm** (not npm or yarn). Use `pnpm install`, `pnpm add`, `pnpm <script>`, or `pnpm run <script>` for all package operations.

- **Windows Python**: On this Windows development environment, always use `python` not `python3` when running Python scripts or skills.

- **Plan before coding**: Create a multi-step plan. For complex tasks, use `write_todos`.

- **Documentation**: Every `.ts` file must begin with an `@fileoverview` block describing purpose, key exports, and relationships. Run `pnpm docs:check` if unsure.

- **Validation**: Run the smallest meaningful checks (`pnpm type-check`, `pnpm lint`, targeted scripts) before handing work back.
  1. `pnpm type-check`: Ensure no TypeScript errors.
  2. `pnpm build:webui` (if touching webui) or relevant build script.
  3. `pnpm lint`: Never ignore errors.

---

## Recent Lessons & Gotchas

1. **Bootstrap Criticality**: `src/main/bootstrap.ts` **MUST** be the first import inside `src/main/index.ts`. It sets the Electron app name before any singleton captures `app.getPath('userData')`.

2. **Dialog Preloads**: Component dialog preloads must import typings with `import type {} from '../../types/global';`. Runtime `.d.ts` imports break the dialog bootstrap.

3. **Payload Integrity**: The component dialog expects untouched `polling-update` payloads; do not transform the shape before forwarding to `ComponentManager.updateAll`.

4. **GridStack Initialization**: `src/ui/gridstack/` already registers and wires widgets (e.g., log panel). Removing or duplicating that flow leaves globals unset.

5. **Spoolman Safety**: Spoolman integration deliberately blocks AD5X/material-station contexts (`src/services/SpoolmanIntegrationService.ts`). Removing the guard regresses filament safety checks.

6. **Camera Streaming**: `Go2rtcService` provides unified streaming via go2rtc (WebRTC/MSE). `Go2rtcBinaryManager` handles binary lifecycle. `PortAllocator` manages port allocation. Do not manually configure go2rtc streams or bypass the allocator.

7. **Headless Parity**: Headless mode and desktop mode share the same connection/polling/camera stack. Avoid `isHeadlessMode()` forks unless absolutely necessary.

8. **Theme System**: **NEVER** hardcode colors in CSS. Always use CSS variables (`--theme-primary`, `--surface-elevated`, etc.). See `ai_docs/THEME_SYSTEM.md`.

9. **Settings Access**: `PrinterDetailsManager` does NOT have a `getSettings()` method. Access per-printer settings via `context.printerDetails.showCameraFps` etc.

10. **Versioning**: Semver treats stable versions as newer than prereleases (`1.0.3 > 1.0.3-alpha.1`). Always bump alpha version (e.g., `alpha.2`) until stable.

---

## Key File Locations

### Bootstrapping & Entry
- `src/main/bootstrap.ts`: Sets app name/userData path. **First import.**
- `src/main/index.ts`: Main process orchestrator.
- `src/preload/index.ts`: Main window context bridge.
- `src/renderer/src/ui/component-dialog/component-dialog-preload.ts`: Dialog context bridge.

### Managers & Multi-Context Core
- `src/main/managers/PrinterContextManager.ts`: Manages printer contexts.
- `src/main/managers/PrinterBackendManager.ts`: Instantiates backends.
- `src/main/managers/ConnectionFlowManager.ts`: Handles connection logic.
- `src/main/managers/PrinterDetailsManager.ts`: Persists printer data.
- `src/main/managers/HeadlessManager.ts`: Orchestrates headless mode.
- `src/main/services/MultiContextPollingCoordinator.ts`: Central polling coordinator.
- `src/main/services/MultiContextPrintStateMonitor.ts`: Monitors print states.

### Backends & Printers
- `src/main/printer-backends/*.ts`: Implementations for Legacy, AD5M, AD5M Pro, AD5X.
- `src/main/printer-backends/ad5x/*`: AD5X specific logic (Material Station).

### Renderer & Components
- `src/renderer/src/renderer.ts`: Entry point.
- `src/renderer/src/gridController.ts`: GridStack controller.
- `src/renderer/src/ui/components/**`: UI Components (tabs, job info, etc.).
- `src/renderer/src/ui/gridstack/**`: Layout logic.

### IPC & Windows
- `src/main/ipc/handlers/index.ts`: Registration of all handlers.
- `src/main/ipc/handlers/*.ts`: Domain-specific handlers.
- `src/main/windows/WindowManager.ts`: Window management.

### Settings Dialog
- `src/renderer/src/ui/settings/settings-renderer.ts`: Settings orchestrator.
- `src/renderer/src/ui/settings/sections/*.ts`: Individual settings sections.

### Camera, Notifications & Ports
- `src/main/services/Go2rtcService.ts`: Unified go2rtc streaming service.
- `src/main/services/Go2rtcBinaryManager.ts`: go2rtc binary lifecycle management.
- `src/main/utils/PortAllocator.ts`: Port management.
- `src/main/ipc/camera-ipc-handler.ts`: Camera IPC handlers.
- `src/main/webui/server/routes/camera-routes.ts`: WebUI camera routes.
- `src/main/services/discord/DiscordNotificationService.ts`: Discord integration.

### Spoolman & Filament
- `src/main/services/SpoolmanIntegrationService.ts`: Core integration.
- `src/main/webui/server/routes/spoolman-routes.ts`: WebUI routes.

### Headless & WebUI
- `src/main/utils/HeadlessArguments.ts`: CLI arg parsing.
- `src/main/webui/server/*`: Express server, Auth, WebSockets.
- `src/main/webui/static/*`: WebUI frontend.

---

## Building and Running

### Scripts
- `pnpm dev`: Start development server (Main + Renderer + WebUI).
- `pnpm build`: Build for production.
- `pnpm build:win` / `:mac` / `:linux`: Platform-specific builds.
- `pnpm lint`: Run Biome linter.
- `pnpm type-check`: Run TypeScript check.
- `pnpm audit:dead-code`: Scan for unused code.
- `pnpm find:console`: Find console logs.
- `pnpm find:lucide`: Find icon usage.

---

## Reference Material

### AI Reference Documentation
- **[ARCHITECTURE.md](ai_docs/ARCHITECTURE.md)**

### Specs & Plans
- **`ai_specs/*`**: Feature specifications.
- **`ai_specs/CAMERA_PRIORITY_SPEC.md`**: Camera behavior spec.
- **`ai_specs/webui-push-notifications.md`**: WebUI push plan.

### Code Inventory
- **`fileoverview-report.md`**: Summary of all files via `@fileoverview`.