# WebUI and Headless Mode

**Last Updated:** 2026-03-11 17:36 ET

This document covers headless mode operations and the WebUI server architecture.

---

## Headless Mode & WebUI Operations

- CLI flags are parsed in `src/main/utils/HeadlessArguments.ts` and validated via `validateHeadlessConfig`. Supported modes: `--last-used`, `--all-saved-printers`, or `--printers="<ip>:<type>:<checkcode,...>"`. Extra flags include `--webui-port`, `--webui-password`, and camera overrides.

- `HeadlessManager.initialize()` (invoked from `src/index.ts`) forces `WebUIEnabled`, applies overrides, connects printers (respecting discovery + saved printers), starts the WebUI server, launches polling/camera proxies, and sets up graceful shutdown.

- Headless mode is documented for users in `docs/README.md` (update that doc whenever CLI or defaults change). `DEFAULT_CONFIG.WebUIPort` is **3000**; any mention of 3001 is legacy.

- The WebUI server (`src/webui/server/WebUIManager.ts`) wires Express, authentication (`AuthManager`), route registration (`server/routes/*.ts` for camera, contexts, jobs, printer control/status, spoolman, temperature, theme, filtration), and `WebSocketManager` for per-context real-time updates. Routes reuse the same services/IPC calls as the desktop UI—avoid duplicating logic.

- Static client code under `src/webui/static/*` mirrors the desktop component model: `app.ts` bootstraps, `core/AppState.ts` + `core/Transport.ts` manage state + IPC bridge, `features/*.ts` implement auth, camera streaming, context switching, job control, layout theme, spoolman, etc., and `grid/*` handles component registration + layout persistence (`WebUIComponentRegistry`, `WebUIGridManager`, `WebUILayoutPersistence`, `WebUIMobileLayoutManager`).

- `WebSocketManager` fans out polling updates per context and feeds the static client; headless deployments typically rely on this for dashboards with no desktop UI running.

---

## Headless Architecture

### CLI Modes

- `--last-used`: Connect to last used
- `--all-saved-printers`: Connect to all saved
- `--printers="<ip>:<type>:<checkcode>"`: Explicit specs

### Debug Flags

- `--debug`: Enables debug logging for this session
- `--debug-network`: Enables network-specific debug logging

These flags work in both headless and desktop modes.

### Overrides

- `--webui-port=<port>` (default 3000)
- `--webui-password=<password>`

### Shared Stack

- Same connection/polling/camera services as desktop
- Minimal `isHeadlessMode()` conditionals
- Event forwarding from HeadlessManager to WebUI

### Initialization

```
applyConfigOverrides() → connectPrinters() → startWebUI()
→ setupEventForwarding() → startPolling() → initializeCameraStreams()
→ setupSignalHandlers()
```

### Graceful Shutdown

```
SIGINT/SIGTERM → shutdown() → Stop polling → Disconnect printers
→ go2rtcService.shutdown() → Stop WebUI → process.exit(0)
```

---

## WebUI Server

### WebUIManager (`src/webui/server/WebUIManager.ts`)

- Express HTTP server
- Static file serving
- API route registration
- WebSocket integration
- Admin privilege enforcement (Windows)
- Per-context WebUI enablement

### AuthManager (`src/webui/server/AuthManager.ts`)

- Password validation
- JWT-style token generation (HMAC-SHA256)
- Session management (24h for "remember me" sessions, 1h for temporary sessions; controlled by `rememberMe` flag during login)
- Token revocation on logout
- Multi-tab support

### WebSocketManager (`src/webui/server/WebSocketManager.ts`)

- Real-time bidirectional communication
- Token-based authentication
- Ping/pong keep-alive (30s)
- Message types: AUTH_SUCCESS, STATUS_UPDATE, SPOOLMAN_UPDATE, COMMAND_RESULT, ERROR, PONG
- Broadcasting to all clients or per-token

---

## API Routes

**Route Modules** (`src/webui/server/routes/`):
- printer-status-routes.ts: GET /api/status
- printer-control-routes.ts: POST /api/control/*
- temperature-routes.ts: POST /api/temperature/*
- filtration-routes.ts: POST /api/filtration/*
- job-routes.ts: Jobs (recent, local, start, control)
- camera-routes.ts: GET /api/camera/url/:contextId
- context-routes.ts: Contexts (list, switch)
- theme-routes.ts: Theme defaults
- spoolman-routes.ts: Spoolman operations
- calibration-routes.ts: Calibration settings, workspace analysis, history, reports, SSH helpers
- debug-routes.ts: Debug log access (`/api/debug/logs`, `/api/debug/status`, etc.)

---

## WebUI Static Client

### AppState (`src/webui/static/core/AppState.ts`)

```typescript
class AppState {
  isAuthenticated: boolean;
  authToken: string | null;
  websocket: WebSocket | null;
  printerStatus: PrinterStatus | null;
  printerFeatures: PrinterFeatures | null;
  spoolmanConfig: SpoolmanConfigResponse | null;
  activeSpool: ActiveSpoolData | null;
  // ... managers
  gridManager: WebUIGridManager;
  mobileLayoutManager: WebUIMobileLayoutManager;
  layoutPersistence: WebUILayoutPersistence;
}
```

### Transport (`src/webui/static/core/Transport.ts`)

- `apiRequest<T>()`: REST with auth headers
- `apiRequestWithMetadata<T>()`: REST with auth headers, returns status/ok along with data
- `buildAuthHeaders()`: Helper for auth header construction
- `connectWebSocket()`: WS with reconnection (exponential backoff)
- `disconnectWebSocket()`: Explicit WebSocket disconnection
- `sendCommand()`: WebSocket commands
- Event callbacks: onStatusUpdate, onSpoolmanUpdate, onConnectionChange

### Feature Modules (`src/webui/static/features/`)

- authentication.ts: Login, token persistence, session restoration
- context-switching.ts: Fetch/switch contexts, layout per-printer
- job-control.ts: Feature detection, controls, job start
- material-matching.ts: AD5X multi-color mapping
- spoolman.ts: Config, search, selection, updates
- camera.ts: MJPEG/RTSP stream initialization
- layout-theme.ts: Theme, visibility, edit mode, responsive

### Grid System (`src/webui/static/grid/`)

- WebUIComponentRegistry: Component definitions
- WebUIGridManager: GridStack desktop layout
- WebUIMobileLayoutManager: Vertical mobile layout
- WebUILayoutPersistence: Per-printer localStorage

---

## Key File Locations

**Headless & WebUI**
- `src/main/utils/HeadlessArguments.ts`, `HeadlessDetection.ts`, `HeadlessLogger.ts`, `src/main/managers/HeadlessManager.ts`
- `src/main/webui/server/*` (WebUIManager, AuthManager, WebSocketManager, route modules) + `src/main/webui/static/*` (AppState, Transport, features, grid)
- `docs/README.md` – user-facing headless instructions (keep updated)
