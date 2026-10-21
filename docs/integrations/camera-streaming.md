# Camera Streaming (go2rtc)

`Go2rtcService` is the single streaming gateway — it replaced the MJPEG proxy and
RTSP-to-WebSocket approaches. Do NOT manually configure go2rtc streams outside the
service stack.

## Components

| File | Role |
| --- | --- |
| `src/main/services/Go2rtcService.ts` | Unified streaming for builtin RTSP + custom MJPEG/RTSP; per-context stream names; status monitoring; go2rtc handles reconnection and protocol conversion (RTSP → WebRTC/MSE/MJPEG) |
| `src/main/services/Go2rtcBinaryManager.ts` | Binary lifecycle: platform-specific download to `userData/go2rtc/`, optional version-pinned updates, start/stop, stream config handoff |
| `src/main/services/CameraStreamCoordinator.ts` | `resolveAndEnsureCameraStream()` — shared reconciliation for desktop IPC and WebUI routes; cleanup when cameras vanish |
| `src/main/utils/camera-utils.ts` | Priority resolution (custom camera > OEM > none), MJPEG/RTSP detection, URL validation, proxy URL formatting |
| `src/main/webui/server/CameraStreamProxy.ts` | Authenticated WS proxy for browser clients (below) |

Consumers: `src/renderer/src/ui/components/camera-preview` and WebUI
`static/features/camera.ts` via `video-rtc.js` (WebRTC) or `<video>` (MSE).
No ffmpeg dependency for basic streaming; latency ~500ms.

## Network binding (since 1.0.5 — do not regress)

- go2rtc API `127.0.0.1:1984` and RTSP `127.0.0.1:8554` bind **loopback only**.
- WebRTC `:8555` stays on all interfaces (remote viewers need it).
- Every consumer (`renderer` wsUrl, `CameraStreamProxy`, `getApiUrl()`) uses
  `127.0.0.1` — never reintroduce a `:1984` all-interfaces listen or a
  `localhost`/LAN-IP go2rtc URL.
- **Browsers never connect to go2rtc directly.** Remote/WebUI viewing tunnels
  through the authenticated WebUI server: `/api/camera/ws?src=<stream>&token=<auth>`
  on the WebUI port (single-port model; forward only the WebUI port, never 1984).
  See wiki "Auto Start" + issue #76.

## Legacy (deprecated — do not use)

`CameraProxyService` (MJPEG proxy), `RtspStreamService` (node-rtsp-stream + ffmpeg).

Per-printer camera settings (`showCameraFps`, `customCameraUrl`, `rtspFrameRate`, …)
live on `PrinterDetails` in `src/shared/types/printer.ts`.
