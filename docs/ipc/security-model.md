# IPC Security Model

```
Renderer Process (sandboxed)
    ↓ window.api.* calls
Preload Script (privileged)
    ↓ channel validation against allowlists
    ↓ contextBridge
ipcRenderer
    ↓ whitelisted channels only
ipcMain Handlers
    ↓ business logic
Services / Managers
```

## Channel validation

Every preload API wraps `ipcRenderer` with an allowlist check; unknown channels are
dropped silently:

```typescript
const validSendChannels = ['request-printer-data', 'pause-print', /* ... */];
send: (channel, data) => {
  if (validSendChannels.includes(channel)) {
    ipcRenderer.send(channel, data);
  }
}
```

The same pattern applies to `on` (receive allowlists) and `invoke` channels.

## Renderer-exposed surface

- Main preload (`src/preload/index.ts`): send/receive/invoke allowlists plus
  namespaces `config`, `dialog`, `loading`, `camera`, `printerContexts`, `spoolman`.
- Component dialog preload: same guarantees, plus `componentDialogAPI`
  (`component-dialog:init`, `polling-update`, `theme-changed`, `component-dialog:close`,
  `component-dialog:get-info`, `component-dialog:get-polling-data`) exposed as
  `window.api.dialog.component`.

## Rules

- Renderers are sandboxed: NO direct Node access, no `remote`, no arbitrary
  `ipcRenderer.send`. If a renderer needs a new capability, add a named channel with
  validation in BOTH preloads.
- Handlers validate payloads before touching managers/services; never forward
  renderer input straight to shell/SSH calls (see the SFTP service boundaries in
  [../integrations/ssh-sftp.md](../integrations/ssh-sftp.md)).
- The WebUI is a separate trust boundary: its HTTP/WS surface lives in
  `src/main/webui/server/` behind `AuthManager` (see
  [../webui/server-routes.md](../webui/server-routes.md)); it never re-exposes raw
  IPC channels.
