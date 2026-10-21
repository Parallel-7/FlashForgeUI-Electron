# Architecture Overview

FlashForgeUI is an Electron desktop + headless controller for FlashForge printers
(Adventurer 5M / 5M Pro, AD5X, Creator 5 / Creator 5 Pro). One codebase, two faces:
the desktop app and the WebUI server (`src/main/webui/`) that also runs headless.

## Process model

| Process | Entry | Role |
| --- | --- | --- |
| Main | `src/main/bootstrap.ts` → `src/main/index.ts` | Orchestration: managers, services, IPC, windows. `bootstrap.ts` sets app name/userData before anything else loads. |
| Preload | `src/preload/index.ts`, `src/renderer/src/ui/component-dialog/component-dialog-preload.ts` | contextBridge API surface. Two preloads must stay in sync (dialog windows load the second one). |
| Renderer | `src/renderer/src/renderer.ts` | GridStack dashboard, components, dialogs. |
| WebUI static client | `src/main/webui/static/` | Browser client served by the WebUI server; shared with the standalone FlashForgeWebUI repo. |

## Core principles

- **One code path for desktop and headless.** Both share connection, polling, and
  camera stacks. Avoid `isHeadlessMode()` forks; duplication drifts.
- **Capability gating, not name matching.** `PrinterDetails.Name` is user-mutable.
  Gate on backend feature flags and PID-derived model info. (Bug class: ff-5mp-hass#13.)
- **Single widget-creation path.** All grid-widget creation routes through
  `createGridWidget()` + `createComponentForGrid()` in `src/renderer/src/gridController.ts`.
- **Progressive theme consolidation.** No hardcoded colors; use theme CSS variables
  (see [renderer/theme-system.md](../renderer/theme-system.md)).

## Bootstrap sequence

1. `bootstrap.ts` — app name + userData path.
2. `index.ts` — registers IPC handlers (`src/main/ipc/handlers/index.ts`), creates
   managers, loads saved printers, restores windows.
3. Renderer boots → `renderer.ts` → restores GridStack layout → `ComponentManager.updateAll`.

## Layer map

| Layer | Where | Examples |
| --- | --- | --- |
| Managers | `src/main/managers/` | PrinterContextManager, PrinterBackendManager, ConnectionFlowManager, PrinterDetailsManager, HeadlessManager, LoadingManager, CalibrationManager, WindowManager |
| Coordinators | `src/main/services/MultiContext*` | polling, print-state, temperature, Spoolman, notifications |
| Backends | `src/main/printer-backends/` | see [printer-backends.md](printer-backends.md) |
| Services | `src/main/services/` | go2rtc, Spoolman, SSH settings, file manager, notifications, discord |
| IPC | `src/main/ipc/` | handlers + camera handler; see [../ipc/handlers.md](../ipc/handlers.md) |
| WebUI | `src/main/webui/` | see [webui/headless.md](../webui/headless.md), [webui/server-routes.md](../webui/server-routes.md) |

File-by-file responsibilities: run `pnpm docs:combine` and read `fileoverview-report.md`.
