# IPC Communication Architecture

**Last Updated:** 2026-03-11 17:34 ET (America/New_York)

This document covers the inter-process communication system between main and renderer processes.

---

## IPC Handler Layout

- `src/main/ipc/handlers/index.ts` is the authoritative registry. Add new handlers there and ensure they are registered **before** any BrowserWindow is created.

- Domain handlers: `backend-handlers.ts`, `calibration-handlers.ts`, `camera-handlers.ts`, `component-dialog-handlers.ts`, `connection-handlers.ts`, `control-handlers.ts`, `dialog-handlers.ts`, `job-handlers.ts`, `material-handlers.ts`, `palette-handlers.ts`, `printer-settings-handlers.ts`, `shortcut-config-handlers.ts`, `spoolman-handlers.ts`, `theme-handlers.ts`, `update-handlers.ts`, `webui-handlers.ts`.

- Supporting modules: `src/main/ipc/camera-ipc-handler.ts` (legacy camera IPC surface), `src/main/ipc/printer-context-handlers.ts` (context CRUD + switching), `src/main/ipc/WindowControlHandlers.ts` (custom title bar), and `src/main/ipc/DialogHandlers.ts` (loading overlay + connection dialogs). Keep APIs in sync with the preload's whitelist.

- When adding IPC channels, update `src/preload/index.ts` channel allowlists plus any typed surface (`PrinterContextsAPI`, `SpoolmanAPI`, etc.). Dialog-specific handlers should route through `component-dialog-handlers.ts` unless they are part of the legacy `DialogHandlers` path.

---

## Security Model

### Context Bridge Pattern

```
Renderer Process (Sandboxed)
    ↓ window.api calls
Preload Script (Privileged)
    ↓ Channel validation
    ↓ contextBridge
ipcRenderer
    ↓ Whitelisted channels
ipcMain Handlers
    ↓ Business logic
Services/Managers
```

---

## Preload Scripts

### Main Renderer (`src/preload/index.ts`)

- ~63 send channels
- ~46 receive channels
- ~51 invoke channels
- Specialized namespaces: `config`, `dialog`, `loading`, `camera`, `printerContexts`, `spoolman`

### Component Dialog (`src/renderer/src/ui/component-dialog/component-dialog-preload.ts`)

- Mirrors main preload API with scoped channel validation
- Adds `componentDialogAPI` for lifecycle:
  ```typescript
  componentDialogAPI = {
    receive: (channel, func) => void  // channels: 'component-dialog:init', 'polling-update', 'theme-changed'
    send: (channel, ...data) => void  // channels: 'component-dialog:close'
    invoke: (channel, ...data) => Promise<unknown>  // channels: 'component-dialog:get-info', 'component-dialog:get-polling-data'
  }
  ```
- Exposed via `window.api.dialog.component`
- Same security guarantees as main preload

### Channel Validation

```typescript
const validSendChannels = ['request-printer-data', 'pause-print', ...];

send: (channel, data) => {
  if (validSendChannels.includes(channel)) {
    ipcRenderer.send(channel, data);
  }
}
```

---

## Handler Registration

### Central Registry (`src/main/ipc/handlers/index.ts`)

```typescript
export function registerAllIpcHandlers(managers: AppManagers) {
  registerConnectionHandlers(connectionManager, windowManager);
  registerBackendHandlers(backendManager, windowManager);
  registerJobHandlers(backendManager, windowManager);
  registerDialogHandlers(configManager, windowManager);
  registerCalibrationHandlers();
  registerMaterialHandlers(backendManager);
  registerControlHandlers(backendManager);
  registerWebUIHandlers();
  registerCameraHandlers(managers);
  initializePrinterSettingsHandlers();
  registerPaletteHandlers();
  registerShortcutConfigHandlers();
  registerComponentDialogHandlers();
  registerUpdateHandlers(configManager, windowManager);
  registerSpoolmanHandlers();
  registerThemeHandlers();
}
```

### Registration Order in index.ts

```
1. Domain handlers (via registerAllIpcHandlers)
2. Multi-context handlers (printer contexts, connection state)
3. Legacy handlers (dialog handlers)
4. Window controls
5. THEN create windows
```

---

## Domain Handlers

### Connection Domain (`connection-handlers.ts`)

- `printer-selection:start-discovery`
- `printer-connection:connect-to-ip`
- `printer-selection:cancel`

### Backend Domain (`backend-handlers.ts`)

- `request-model-preview`
- `request-printer-data`
- `get-material-station-status`
- `printer:get-features`

### Control Domain (`control-handlers.ts`)

- Temperature: `set-bed-temp`, `set-extruder-temp`, `turn-off-*-temp`
- LED: `led-on`, `led-off`
- Print: `pause-print`, `resume-print`, `cancel-print`
- Operations: `home-axes`, `set-filtration`, `clear-status`

### Job Domain (`job-handlers.ts`)

- `job-picker:get-local-jobs`, `job-picker:get-recent-jobs` (legacy + modern printers)
- `job-picker:start-job` (with material mapping for AD5X)
- `uploader:browse-file`, `uploader:upload-job`, `uploader:cancel` (job upload workflow)
- `upload-file-ad5x` (AD5X-specific upload with material station support)
- `request-thumbnail`, `request-legacy-thumbnail` (with caching via `ThumbnailCacheService`)
- `job-selected`, `close-job-picker` (dialog lifecycle)

### Spoolman Domain (`spoolman-handlers.ts`)

- `spoolman:open-dialog` - Open spool selection dialog
- `spoolman:search-spools` - Search spools via REST API
- `spoolman:select-spool` - Broadcast spool selection to renderers
- `spoolman:get-active-spool` - Get active spool for context
- `spoolman:set-active-spool` - Set active spool for context
- `spoolman:test-connection` - Test connection to Spoolman server
- `spoolman:get-status` - Get Spoolman status for context (enabled/disabled + reason)
- `spoolman:retry-connection` - Manual retry via `SpoolmanHealthMonitor`

### Palette Domain (`palette-handlers.ts`)

- `open-component-palette`, `close-component-palette`, `palette:close`
- `palette:get-components` (invoke)
- `palette:remove-component`, `palette:add-component`
- `palette:opened`, `palette:toggle-edit-mode`

### Calibration Domain (`calibration-handlers.ts`)

- Settings: `calibration:get-settings`, `calibration:update-settings`
- Workspace: `calibration:get-workspace`, `calibration:create-workspace`, `calibration:clear-workspace`
- File operations: `calibration:open-config-file`, `calibration:open-shaper-csv-file`, `calibration:open-ssh-key-file`
- Mesh: `calibration:load-config`, `calibration:get-profiles`, `calibration:parse-mesh`, `calibration:analyze-mesh`, `calibration:compute-workflow`
- History: `calibration:get-history`, `calibration:add-history`, `calibration:clear-history`
- Reports: `calibration:export-report`, `calibration:save-report`, `calibration:save-config`
- SSH: `calibration:ssh-connect`, `calibration:ssh-disconnect`, `calibration:ssh-status`, `calibration:ssh-is-connected`, `calibration:ssh-execute`
- SSH transfers: `calibration:ssh-fetch-config`, `calibration:ssh-fetch-shaper`, `calibration:ssh-upload-config`, `calibration:ssh-download-file`, `calibration:ssh-upload-file`, `calibration:ssh-list-dir`, `calibration:ssh-file-exists`
- SSH config persistence: `calibration:get-ssh-config`, `calibration:save-ssh-config`, `calibration:clear-ssh-config`
- Input shaper: `calibration:analyze-shaper`, `calibration:generate-shaper-config`, `calibration:save-shaper-result`, `calibration:get-shaper-definitions`

### Printer Settings Domain (`printer-settings-handlers.ts`)

- `printer-settings:get` - Get per-printer settings (camera, LEDs, legacy mode)
- `printer-settings:update` - Update per-printer settings
- `printer-settings:get-printer-name` - Get printer name for active context

### Theme Domain (`theme-handlers.ts`)

- `theme-profile-operation` (profile CRUD)
- `theme-updated` (broadcast)

### Update Domain (`update-handlers.ts`)

- `check-for-updates`, `download-update`, `install-update`
- `open-installer`, `open-release-page`
- `get-update-status`, `set-update-channel`

### WebUI Domain (`webui-handlers.ts`)

- `webui:start`, `webui:stop`, `webui:get-status`
- `webui:set-password`, `webui:get-auth-status`
- `webui:get-port`, `webui:set-port`

---

## Communication Patterns

### 1. Request-Response (invoke/handle)

```typescript
// Renderer
const result = await window.api.invoke('printer-contexts:switch', contextId);

// Main
ipcMain.handle('printer-contexts:switch', async (_event, contextId) => {
  contextManager.switchContext(contextId);
});
```

### 2. One-Way Send (send/on)

```typescript
// Renderer
window.api.send('pause-print');

// Main
ipcMain.on('pause-print', async () => {
  await backendManager.pausePrint(contextId);
});
```

### 3. Event Broadcasting (receive)

```typescript
// Main
mainWindow.webContents.send('polling-update', data);

// Renderer
window.api.receive('polling-update', (data) => {
  updateUI(data);
});
```

---

## Renderer API Surface

```typescript
interface ElectronAPI {
  send/receive/removeListener/invoke
  config: ConfigAPI
  dialog: DialogNamespace
  loading: LoadingAPI
  camera: CameraAPI
  printerContexts: PrinterContextsAPI
  connectionState: ConnectionStateAPI
  printerSettings: PrinterSettingsAPI
  spoolman: SpoolmanAPI
}
```

---

## Key File Locations

**IPC & Windows**
- `src/main/ipc/handlers/index.ts` + domain handlers in `src/main/ipc/handlers/*.ts`
- `src/main/ipc/camera-ipc-handler.ts`, `src/main/ipc/printer-context-handlers.ts`, `src/main/ipc/WindowControlHandlers.ts`, `src/main/ipc/DialogHandlers.ts`
- `src/main/windows/WindowManager.ts`, `src/main/windows/WindowFactory.ts`, `src/main/windows/factories/*`, `src/main/windows/dialogs/*`
- `src/preload/index.ts`, `src/renderer/src/ui/component-dialog/component-dialog-preload.ts`
