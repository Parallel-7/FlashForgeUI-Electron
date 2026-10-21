# IPC Handlers

`src/main/ipc/handlers/index.ts` is the authoritative registry; handlers must be
registered BEFORE any BrowserWindow is created.

## Domain handlers (`src/main/ipc/handlers/`)

`backend`, `calibration`, `camera`, `component-dialog`, `connection`, `control`,
`dialog`, `e2e`, `file-manager`, `job`, `material`, `palette`, `printer-power`,
`printer-settings`, `shortcut-config`, `spoolman`, `ssh-settings`, `theme`, `update`,
`webui`.

Supporting modules outside `handlers/`: `src/main/ipc/camera-ipc-handler.ts`
(camera surface), `printer-context-handlers.ts` (context CRUD/switching),
`WindowControlHandlers.ts` (custom title bar), `DialogHandlers.ts` (loading overlay +
connection dialogs).

Registration order in `src/main/index.ts`:

1. `registerAllIpcHandlers(managers)` — domain handlers
2. Multi-context handlers (printer contexts, connection state)
3. Legacy dialog handlers
4. Window controls
5. THEN create windows

## Channel catalog (domains → representative channels)

- **connection**: `printer-selection:start-discovery`, `printer-connection:connect-to-ip`, `printer-selection:cancel`
- **backend**: `request-model-preview`, `request-printer-data`, `get-material-station-status`, `printer:get-features`
- **control**: `set-bed-temp`, `set-extruder-temp`, `turn-off-*-temp`, `led-on/off`, `pause/resume/cancel-print`, `home-axes`, `set-filtration`, `clear-status`
- **job**: `job-picker:get-local-jobs`, `job-picker:get-recent-jobs` (legacy + modern), upload paths
- **material**: `material:set-slot`, `material:configure-slot` (+ `spoolman.openSpoolSelection` via preload)
- **file-manager**: `file-manager:*` (list/delete/rename/thumbnails/USB) — pinned to the context active when the dialog opened; opened only via `file-manager:open` shortcut channel
- **ssh-settings**: `ssh-settings:get/update/reset`
- **printer-power**: power-cycle/reboot flows (SSH-backed; see [../integrations/ssh-sftp.md](../integrations/ssh-sftp.md))
- **camera / spoolman / theme / update / webui / palette / shortcut-config / printer-settings / calibration / component-dialog**: see handler files

When adding a channel: update the preload allowlist(s) AND typed surfaces
(`PrinterContextsAPI`, `SpoolmanAPI`, …). Dialog-specific handlers route through
`component-dialog-handlers.ts` unless they belong to the legacy `DialogHandlers` path.

## The two preloads must stay in sync

`src/preload/index.ts` (main renderer) and
`src/renderer/src/ui/component-dialog/component-dialog-preload.ts` (pop-out dialogs)
mirror each other. The dialog preload must also carry the `material` namespace and
`onSpoolPickedForSlot` listener — a gap there surfaces as "Material control is not
available" in the material-station widget. Type-only imports in the dialog preload:
`import type {} from '../../types/global';` (a runtime `.d.ts` import breaks the
dialog bootstrap).
