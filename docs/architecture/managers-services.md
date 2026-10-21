# Managers and Services

The main process splits orchestration (managers) from domain work (services).
Multi-context variants fan one service across all connected printers.

## Managers (`src/main/managers/`)

| Manager | Responsibility |
| --- | --- |
| `PrinterContextManager` | Owns the context list; context lifecycle, switching, events. One context per printer. |
| `PrinterBackendManager` | Creates/holds the backend instance per context. |
| `ConnectionFlowManager` | Connect flows: discovery-selected, manual (`connectDirectlyToIP`), reconnect. |
| `PrinterDetailsManager` | Persists `printer_details.json` (see `src/shared/types/printer.ts`). Note: no `getSettings()` — per-printer settings live on `PrinterDetails` itself (`context.printerDetails.showCameraFps`, etc.). |
| `HeadlessManager` | Headless boot of the WebUI server, CLI modes. |
| `LoadingManager` | Initial-load orchestration. |
| `CalibrationManager` | Input-shaper/bed calibration workflows. |
| `WindowManager` / `WindowFactory` / `factories/`, `dialogs/` | Window lifecycle, dialog windows (incl. component dialog). |

## Multi-context coordinators (`src/main/services/MultiContext*`)

| Coordinator | Responsibility |
| --- | --- |
| `MultiContextPollingCoordinator` | Polls `/detail` per context; distributes `polling-update` payloads. |
| `MultiContextPrintStateMonitor` | Derives print-state transitions (notification triggers). |
| `MultiContextTemperatureMonitor` | Temperature trend/threshold logic. |
| `MultiContextSpoolmanTracker` | Per-context filament tracking (blocked for AD5X/material-station — see [../integrations/spoolman.md](../integrations/spoolman.md)). |
| `MultiContextNotificationCoordinator` | Fans notifications per context. |

`MainProcessPollingCoordinator` / `PrinterPollingService` remain for the legacy
single-printer paths.

## Polling data flow

```
MultiContextPollingCoordinator (interval per context)
  → polling-update payload (DO NOT transform the shape before ComponentManager.updateAll)
  → renderer: ComponentManager.updateAll(contextId, payload)
  → WebUI: WebSocketManager broadcast to authenticated sockets
```

Wall-clock ETA gating: `isPrintAdvancing` (`src/shared/types/polling.ts`) covers
`Printing` ONLY. Every surface converting remaining duration → clock time must gate on
it (desktop job stats, WebUI `panels.ts`, `static/shared/formatting.ts`, Discord
embed). `isActive` includes Paused and is the wrong predicate; Heating drifts too.
Mirrored in FlashForgeWebUI and the ff-5mp-api libs.
