# WebUI Static Client

`src/main/webui/static/` — the browser client, shared with the standalone
[FlashForgeWebUI](https://github.com/Parallel-7/FlashForgeWebUI) repo. Mirrors the
desktop component model.

## Core

- `app.ts` — bootstrap.
- `core/AppState.ts` — auth/token/websocket state, printer status + features,
  spoolman config, active spool; owns `gridManager`, `mobileLayoutManager`,
  `layoutPersistence`.
- `core/Transport.ts` — `apiRequest<T>()`, `apiRequestWithMetadata<T>()`,
  `buildAuthHeaders()`, `connectWebSocket()` (reconnect with exponential backoff),
  `disconnectWebSocket()`, `sendCommand()`; callbacks onStatusUpdate,
  onSpoolmanUpdate, onConnectionChange.
- `shared/` — browser-side helpers (e.g. `formatting.ts` mirrors desktop
  formatting incl. the `isPrintAdvancing` ETA gate).

## Features (`features/*.ts`)

`authentication.ts` (login, token persistence, session restore),
`context-switching.ts` (fetch/switch contexts, per-printer layout),
`job-control.ts` (feature detection, controls, job start — gating mirrors desktop),
`material-matching.ts` (AD5X multi-color mapping), `spoolman.ts` (config, search,
selection, updates), `camera.ts` (go2rtc WebRTC/MSE/MJPEG via the authenticated
proxy), `layout-theme.ts` (theme profiles, visibility, edit mode, responsive).

## Grid (`grid/`)

- `WebUIComponentRegistry` — component definitions
- `WebUIGridManager` — GridStack desktop layout
- `WebUIMobileLayoutManager` — vertical mobile layout
- `WebUILayoutPersistence` — per-printer localStorage

## Porting rule

Desktop-visible changes that make sense in a browser get mirrored here AND flagged
for the standalone FlashForgeWebUI repo (significant duplication by design until
the two are unified). Mirror WebUI gating changes into FlashForgeWebUI together.
