# WebUI Server and Routes

`src/main/webui/server/` — an authenticated Express + WebSocket server that reuses
the same services/IPC as the desktop. Never duplicate desktop logic here.

## Server core

| File | Role |
| --- | --- |
| `WebUIManager.ts` | Express wiring, static serving (version-stamped, no-cache headers), route registration, WebSocket integration, per-context enablement |
| `AuthManager.ts` | Password validation, HMAC-SHA256 tokens, sessions (24h "remember me" / 1h temporary), revocation, multi-tab |
| `WebSocketManager.ts` | Token-authenticated sockets, 30s ping/pong; messages AUTH_SUCCESS, STATUS_UPDATE, SPOOLMAN_UPDATE, COMMAND_RESULT, ERROR, PONG |
| `CameraStreamProxy.ts` | **Authenticated WS proxy** tunneling streams through the WebUI port at `/api/camera/ws?src=<stream>&token=<auth>` — browsers never touch go2rtc's unauthenticated API (see [../integrations/camera-streaming.md](../integrations/camera-streaming.md)) |
| `auth-middleware.ts`, `security-middleware.ts`, `api-routes.ts`, `static-asset-options.ts` | Middleware + route aggregation |

## Route modules (`server/routes/`, verified listing)

| Module | Surface |
| --- | --- |
| `printer-status-routes.ts` | `GET /api/status` |
| `printer-control-routes.ts` | `POST /api/control/*` |
| `temperature-routes.ts` | `POST /api/temperature/*` |
| `filtration-routes.ts` | `POST /api/filtration/*` |
| `job-routes.ts`, `job-upload-routes.ts` | Recent/local jobs, start, control, upload |
| `camera-routes.ts` | Camera URLs + the authenticated stream proxy |
| `context-routes.ts` | Context list/switch |
| `theme-routes.ts` | Theme defaults |
| `spoolman-routes.ts` | Spoolman operations |
| `calibration-routes.ts` | Calibration settings, workspace analysis, history, reports, SSH helpers |
| `file-manager-routes.ts`, `ssh-settings-routes.ts` | SFTP file manager + SSH settings API (desktop has the full UI; WebUI UI coverage is partial) |
| `printer-power-routes.ts` | Power/reboot flows |
| `debug-routes.ts` | `/api/debug/logs`, `/api/debug/status` |

## Cache rule

Built WebUI assets must stay version-stamped and served with no-cache headers —
the browser Playwright suite exists to catch stale asset mixes, icon hydration
mismatches, and camera bootstrap regressions (see
[../testing/overview.md](../testing/overview.md)).
