# Spoolman Integration

Filament tracking against a [Spoolman](https://github.com/Donkie/Spoolman) server.

## Service stack (`src/main/services/`)

| Service | Role |
| --- | --- |
| `SpoolmanService.ts` | REST client (10s timeout): ping, getSpool, searchSpools, useFilament |
| `SpoolmanIntegrationService.ts` | **Single source of truth** for active spool selections; per-printer persistence in `printer_details.json`; emits `spoolman-changed`; validates config |
| `SpoolmanUsageTracker.ts` | Listens for `cooling-complete`, computes usage from job metadata, submits to the API |
| `MultiContextSpoolmanTracker.ts` | Per-context tracker instances; context lifecycle aware; GUI + headless |
| `SpoolmanHealthMonitor.ts` | Pings the server; resets cache/UI state on connectivity flips |

Config keys on `AppConfig`: `SpoolmanEnabled`, `SpoolmanServerUrl`,
`SpoolmanUpdateMode` (handlers: `src/main/ipc/handlers/spoolman-handlers.ts`).

## Hard rule: AD5X / material-station blocking

`SpoolmanIntegrationService` deliberately blocks AD5X and material-station contexts
(feature detection + model prefix). **Removing the guard regresses filament safety
checks.** Creator 5 slots map through the material-station palette instead.

## Surfaces

- Renderer: `spoolman-dialog/`, `spoolman-offline-dialog/`, spool badges in the
  dashboard and component dialogs. Keep `spoolman-changed` events intact so
  everything rehydrates.
- WebUI: `server/routes/spoolman-routes.ts` + `static/features/spoolman.ts`.
  Keep API responses consistent between desktop and WebUI flows.

Slot blueprint (how slots map to tools/material stations):
[spoolman-slot-blueprint.md](spoolman-slot-blueprint.md).
