# RTSP Camera FPS Overlay Implementation Spec

**Created:** 2025-12-28
**Status:** Ready for Implementation
**Depends On:** Commit 73c56be (camera FPS overlay feature)

## Overview

Extend the camera FPS overlay feature (currently working for MJPEG streams) to support RTSP camera streams. This should be a seamless, behind-the-scenes change that:

1. Uses the **same `showCameraFps` setting** (already per-printer)
2. Works transparently regardless of camera type (MJPEG or RTSP)
3. Requires **no user configuration changes**

## Current Implementation (MJPEG)

### Backend: CameraProxyService (src/main/services/CameraProxyService.ts:465-472)

```typescript
// Counts JPEG frames by detecting start markers (0xFFD8)
response.on('data', (chunk: Buffer) => {
  streamInfo.stats.bytesReceived += chunk.length;
  for (let i = 0; i < chunk.length - 1; i++) {
    if (chunk[i] === 0xFF && chunk[i + 1] === 0xD8) {
      streamInfo.stats.framesReceived++;
    }
  }
  this.distributeToClientsForContext(streamInfo, chunk);
});
```

### Frontend: camera-preview.ts (src/renderer/src/ui/components/camera-preview)

- **`loadFpsOverlaySetting()`**: Fetches `showCameraFps` from `printer-settings:get`
- **`startFpsUpdateInterval()`**: 1-second polling interval
- **`updateFpsFromStats()`**: Calls `window.api.camera.getStatus(contextId)` to get `stats.framesReceived`
- **`calculateFps()`**: Computes FPS from frame count delta with light smoothing (0.2/0.8)
- **`updateFpsDisplay()`**: Updates the overlay text (`XX FPS` or `-- FPS`)

### IPC Flow (MJPEG)

```
Renderer                          Main Process
   |                                   |
   |--[camera:get-status]------------->|
   |                                   | CameraProxyService.getStatusForContext()
   |<----{stats.framesReceived}--------|
   |                                   |
   | Calculate FPS from frame delta    |
   | Update overlay display            |
```

## RTSP Architecture Analysis

### Current RTSP Flow

```
Main Process                                          Renderer
     |                                                    |
     | RtspStreamService.setupStream()                    |
     | ├── Spawns ffmpeg (RTSP → MPEG1)                  |
     | └── Creates WebSocket server (port 9000+)         |
     |                                                    |
     |<-------------[camera:get-rtsp-relay-info]----------|
     |-------{wsUrl: ws://localhost:9000}---------------->|
     |                                                    |
     |                                                    | new JSMpeg.Player(wsUrl, {
     |                                                    |   onSourceEstablished,
     |                                                    |   onSourceCompleted
     |                                                    | })
     |                                                    |
     | <------WebSocket MPEG1 stream--------------------> | JSMpeg decodes & renders
```

### Key Insight: Client-Side FPS for RTSP

JSMpeg provides an `onVideoDecode(decoder, time)` callback that fires **after each decoded frame**. This is actually **more accurate** than backend byte counting because it measures frames actually rendered to the canvas.

**Advantages of client-side approach:**
- Measures actual decoded/rendered frames (not network traffic)
- No backend changes required to RtspStreamService
- More responsive (no IPC round-trip)
- Works identically across platforms

## Implementation Plan

### Phase 1: Extend JSMpeg Type Definitions

**File:** `src/shared/types/jsmpeg.d.ts`

The type definition already includes `onVideoDecode`. We just need to ensure it's properly typed for our use case.

```typescript
// Already exists, verify it's correct:
onVideoDecode?: (decoder: unknown, time: number) => void;
```

No changes needed to type definitions.

### Phase 2: Update CameraPreviewComponent

**File:** `src/renderer/src/ui/components/camera-preview/camera-preview.ts`

#### 2.1 Add RTSP-specific FPS tracking state

```typescript
// Near line 118, add:
/** RTSP FPS tracking - frame count from onVideoDecode */
private rtspFrameCount = 0;
private isRtspStream = false;
```

#### 2.2 Modify createRtspStream() to hook onVideoDecode

Current code (line 556-592):
```typescript
private createRtspStream(wsUrl: string, cameraView: HTMLElement): void {
  // ... existing setup ...

  this.jsmpegPlayer = new JSMpeg.Player(wsUrl, {
    canvas: canvasElement,
    autoplay: true,
    audio: false,
    onSourceCompleted: () => {
      this.logDebug('[CameraPreview] RTSP stream completed');
    },
    onSourceEstablished: () => {
      this.logDebug('[CameraPreview] RTSP stream established');
      this.updateComponentState('streaming');
    },
  });
  // ...
}
```

**Modified version:**
```typescript
private createRtspStream(wsUrl: string, cameraView: HTMLElement): void {
  // ... existing setup ...

  // Mark this as an RTSP stream for FPS tracking
  this.isRtspStream = true;
  this.rtspFrameCount = 0;

  this.jsmpegPlayer = new JSMpeg.Player(wsUrl, {
    canvas: canvasElement,
    autoplay: true,
    audio: false,
    onSourceCompleted: () => {
      this.logDebug('[CameraPreview] RTSP stream completed');
    },
    onSourceEstablished: () => {
      this.logDebug('[CameraPreview] RTSP stream established');
      this.updateComponentState('streaming');
    },
    // NEW: Track frames for FPS calculation
    onVideoDecode: () => {
      this.rtspFrameCount++;
    },
  });
  // ...
}
```

#### 2.3 Modify createMjpegStream() to set stream type flag

```typescript
private createMjpegStream(streamUrl: string, cameraView: HTMLElement): void {
  // Mark this as NOT an RTSP stream
  this.isRtspStream = false;
  // ... rest of existing code ...
}
```

#### 2.4 Update updateFpsFromStats() for dual-mode support

Current code polls backend for MJPEG stats. We need to add RTSP path:

```typescript
private async updateFpsFromStats(): Promise<void> {
  if (!this.activeContextId || !this.showFpsOverlay) return;

  try {
    let currentFrames: number;
    const currentTime = Date.now();

    if (this.isRtspStream) {
      // RTSP: Use local frame counter from onVideoDecode
      currentFrames = this.rtspFrameCount;
    } else {
      // MJPEG: Poll backend for stats
      const status = await window.api.camera.getStatus(this.activeContextId);
      if (!status?.stats) return;
      currentFrames = status.stats.framesReceived ?? 0;
    }

    this.calculateFps(currentFrames, currentTime);
  } catch {
    // Silently ignore errors during FPS polling
  }
}
```

#### 2.5 Update resetFpsTracking() to clear RTSP state

```typescript
private resetFpsTracking(): void {
  this.lastFpsFrameCount = null;
  this.lastFpsTimestamp = null;
  this.currentFps = null;
  this.rtspFrameCount = 0;  // NEW
  this.isRtspStream = false; // NEW
  this.stopFpsUpdateInterval();
  this.updateFpsDisplay();
}
```

#### 2.6 Update cleanupCameraStream() to reset RTSP state

```typescript
private cleanupCameraStream(): void {
  // ... existing JSMpeg cleanup ...

  // Reset RTSP FPS tracking
  this.rtspFrameCount = 0;
  this.isRtspStream = false;

  // ... rest of existing code ...
}
```

### Phase 3: Update enableCameraPreview() Flow

No changes needed! The existing code already:
1. Loads FPS overlay setting via `loadFpsOverlaySetting()`
2. Calls `createRtspStream()` or `createMjpegStream()` based on stream type
3. Updates component state to 'streaming'
4. FPS visibility is handled by `updateFpsOverlayVisibility()`

The flow works automatically because we're just adding the `isRtspStream` flag and hooking `onVideoDecode`.

### Phase 4: Verify Context Switching

The existing `handleContextSwitch()` method already:
1. Calls `resetHeartbeatTracking()` which calls `resetFpsTracking()`
2. Calls `loadFpsOverlaySetting()` for the new printer
3. Recreates the stream with `enableCameraPreview()`

No changes needed for context switching.

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/renderer/src/ui/components/camera-preview/camera-preview.ts` | Modify | Add RTSP FPS tracking via onVideoDecode callback |

**Total: 1 file, ~15-20 lines of changes**

## Testing Plan

### Unit Tests (Manual)

1. **MJPEG Camera (existing functionality)**
   - Connect to printer with built-in MJPEG camera
   - Enable FPS overlay in settings
   - Verify FPS displays and updates every second
   - Toggle preview off/on, verify FPS resets and resumes

2. **RTSP Custom Camera**
   - Configure custom RTSP camera URL for a printer
   - Enable FPS overlay in settings
   - Verify FPS displays and updates every second
   - Compare displayed FPS to expected camera output (e.g., 30 FPS)
   - Toggle preview off/on, verify FPS resets and resumes

3. **Context Switching**
   - Connect to two printers (one MJPEG, one RTSP)
   - Enable FPS overlay on both
   - Switch between printers
   - Verify FPS overlay shows correct values for each
   - Verify FPS resets when switching

4. **Setting Toggle**
   - Disable FPS overlay in settings
   - Verify overlay hides for both MJPEG and RTSP
   - Re-enable FPS overlay
   - Verify overlay shows for both stream types

### Edge Cases

1. **No Camera Available**
   - FPS overlay should remain hidden when no camera
   - No errors in console

2. **RTSP Stream Failure**
   - ffmpeg not installed: FPS overlay hidden (stream won't establish)
   - Invalid RTSP URL: FPS overlay hidden (stream won't establish)

3. **High FPS Streams**
   - Test with 60 FPS RTSP source
   - Verify counter doesn't overflow or lag

## Questions for Review

1. **FPS Overlay Position**: The current overlay is positioned at `top: 8px; right: 8px`. Should it be in the same position for RTSP (renders to canvas) vs MJPEG (renders to img)?
   - **Answer needed**: Yes, position should be identical. The overlay is positioned relative to `.camera-stream-area`, not the stream element itself, so this should work automatically.

2. **WebUI Support**: The WebUI also has camera support (`src/main/webui/static/features/camera.ts`). Should the FPS overlay be added there too?
   - **Answer needed**: Scope decision - defer to follow-up spec if desired.

3. **Frame Count Overflow**: For very long streams, `rtspFrameCount` could theoretically overflow. At 60 FPS, JavaScript's MAX_SAFE_INTEGER (2^53) would take ~4.8 million years to overflow. Should we add a reset mechanism anyway?
   - **Recommendation**: Not needed. FPS calculation uses deltas, so absolute count doesn't matter.

## Implementation Checklist

- [ ] Add `rtspFrameCount` and `isRtspStream` state variables
- [ ] Set `isRtspStream = true` in `createRtspStream()`
- [ ] Set `isRtspStream = false` in `createMjpegStream()`
- [ ] Add `onVideoDecode` callback to JSMpeg.Player options
- [ ] Update `updateFpsFromStats()` to branch on stream type
- [ ] Update `resetFpsTracking()` to clear RTSP state
- [ ] Update `cleanupCameraStream()` to reset RTSP state
- [ ] Run type-check: `npm run type-check`
- [ ] Run build: `npm run build:renderer`
- [ ] Run lint: `npm run lint`
- [ ] Manual testing with RTSP camera

---

## Part 2: WebUI Extension

### Overview

Extend the FPS overlay to the WebUI (`src/main/webui/static/`). This uses the same client-side approach for both MJPEG and RTSP since:
1. WebUI camera is already client-side rendered
2. Consistent with desktop RTSP approach
3. No complex WebSocket changes needed

### WebUI Architecture Summary

```
Browser (WebUI)                                 Server (Main Process)
     |                                                    |
     |----[GET /api/camera/proxy-config]----------------->|
     |<----{streamType, url/wsPort, showCameraFps}--------|
     |                                                    |
     | MJPEG: img.src = proxyUrl                          |
     | RTSP:  new JSMpeg.Player(wsUrl, {onVideoDecode})   |
     |                                                    |
     | Client-side FPS calculation                        |
     | Update overlay display                             |
```

### Phase 1: Backend - Add Setting to Camera Config Response

**File:** `src/main/webui/server/routes/camera-routes.ts`

Extend the `/camera/proxy-config` response to include the FPS overlay setting.

**Current response (MJPEG):**
```typescript
const response = {
  success: true,
  streamType: 'mjpeg' as const,
  port: status.port,
  url: `http://${host}:${status.port}/stream`
};
```

**Modified response:**
```typescript
// Import getPrinterDetailsManager at top
import { getPrinterDetailsManager } from '../../../managers/PrinterDetailsManager.js';

// In the route handler, after getting context:
const printerDetailsManager = getPrinterDetailsManager();
const printerSettings = printerDetailsManager.getSettings(context.printerDetails.SerialNumber);
const showCameraFps = printerSettings?.showCameraFps ?? false;

// Include in both MJPEG and RTSP responses:
const response = {
  success: true,
  streamType: 'mjpeg' as const,
  port: status.port,
  url: `http://${host}:${status.port}/stream`,
  showCameraFps  // NEW
};
```

**Also update RTSP response:**
```typescript
const response = {
  success: true,
  streamType: 'rtsp' as const,
  wsPort: streamStatus.wsPort,
  ffmpegAvailable: true,
  showCameraFps  // NEW
};
```

### Phase 2: HTML Template - Add FPS Overlay Element

**File:** `src/main/webui/static/grid/WebUIComponentRegistry.ts`

Update the camera component template:

```typescript
camera: {
  id: 'camera',
  html: `
    <div class="panel panel-camera" id="camera-panel">
      <div class="panel-header">Camera</div>
      <div class="panel-content camera-panel-content">
        <div id="camera-placeholder" class="no-camera">Camera Unavailable</div>
        <img id="camera-stream" class="camera-stream hidden" alt="Printer camera stream">
        <canvas id="camera-canvas" class="camera-stream hidden"></canvas>
        <div id="camera-fps-overlay" class="camera-fps-overlay hidden">-- FPS</div>
      </div>
    </div>
  `,
},
```

### Phase 3: CSS Styling

**File:** `src/main/webui/static/webui.css`

Add after `.camera-panel-content .camera-stream` rules (~line 462):

```css
/* Camera FPS Overlay */
.camera-fps-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: var(--text-color, #e8e8e8);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  font-weight: 500;
  z-index: 10;
  pointer-events: none;
  user-select: none;
}

/* Ensure camera-panel-content has relative positioning for overlay */
.camera-panel-content {
  position: relative;
}
```

### Phase 4: Camera Feature - FPS Tracking Logic

**File:** `src/main/webui/static/features/camera.ts`

#### 4.1 Add state variables at module level (after `let jsmpegPlayer`):

```typescript
// FPS tracking state
let showFpsOverlay = false;
let isRtspStream = false;
let frameCount = 0;
let lastFpsFrameCount = 0;
let lastFpsTimestamp = 0;
let currentFps: number | null = null;
let fpsUpdateIntervalId: number | null = null;
```

#### 4.2 Add FPS utility functions:

```typescript
function updateFpsDisplay(): void {
  const overlay = $('camera-fps-overlay');
  if (!overlay) return;

  if (!showFpsOverlay) {
    overlay.classList.add('hidden');
    return;
  }

  overlay.classList.remove('hidden');
  overlay.textContent = currentFps !== null ? `${currentFps} FPS` : '-- FPS';
}

function calculateFps(): void {
  const now = Date.now();
  const currentFrameCount = frameCount;

  if (lastFpsTimestamp === 0) {
    // First calculation - just store the baseline
    lastFpsFrameCount = currentFrameCount;
    lastFpsTimestamp = now;
    return;
  }

  const timeDelta = (now - lastFpsTimestamp) / 1000; // seconds
  if (timeDelta < 0.5) return; // Wait for at least 0.5s of data

  const frameDelta = currentFrameCount - lastFpsFrameCount;
  const instantFps = Math.round(frameDelta / timeDelta);

  // Light smoothing (20% new, 80% old)
  if (currentFps === null) {
    currentFps = instantFps;
  } else {
    currentFps = Math.round(instantFps * 0.2 + currentFps * 0.8);
  }

  lastFpsFrameCount = currentFrameCount;
  lastFpsTimestamp = now;
  updateFpsDisplay();
}

function startFpsTracking(): void {
  if (fpsUpdateIntervalId !== null) return;

  frameCount = 0;
  lastFpsFrameCount = 0;
  lastFpsTimestamp = 0;
  currentFps = null;

  fpsUpdateIntervalId = window.setInterval(calculateFps, 1000);
  updateFpsDisplay();
}

function stopFpsTracking(): void {
  if (fpsUpdateIntervalId !== null) {
    window.clearInterval(fpsUpdateIntervalId);
    fpsUpdateIntervalId = null;
  }
  currentFps = null;
  updateFpsDisplay();
}

function resetFpsTracking(): void {
  stopFpsTracking();
  frameCount = 0;
  isRtspStream = false;
}
```

#### 4.3 Update `loadCameraStream()` - RTSP section:

```typescript
// After: jsmpegPlayer = new JSMpeg.Player(wsUrl, {
jsmpegPlayer = new JSMpeg.Player(wsUrl, {
  canvas: cameraCanvas,
  autoplay: true,
  audio: false,
  onSourceEstablished: () => {
    console.log('[Camera] RTSP stream connected');
  },
  onSourceCompleted: () => {
    console.log('[Camera] RTSP stream completed');
  },
  // NEW: Track frames for FPS
  onVideoDecode: () => {
    frameCount++;
  },
});

// NEW: Set stream type and start FPS tracking
isRtspStream = true;
showFpsOverlay = config.showCameraFps ?? false;
if (showFpsOverlay) {
  startFpsTracking();
}
```

#### 4.4 Update `loadCameraStream()` - MJPEG section:

```typescript
// After setting cameraStream.src:
cameraStream.src = cameraUrl;

// NEW: Set stream type and setting
isRtspStream = false;
showFpsOverlay = config.showCameraFps ?? false;

cameraStream.onload = () => {
  hideElement('camera-placeholder');
  hideElement('camera-canvas');
  showElement('camera-stream');

  // NEW: Count frames on each image load
  frameCount++;
};

// NEW: Start FPS tracking after first load
if (showFpsOverlay) {
  startFpsTracking();
}
```

#### 4.5 Update `teardownCameraStreamElements()`:

```typescript
export function teardownCameraStreamElements(): void {
  // NEW: Stop FPS tracking
  resetFpsTracking();

  destroyRtspPlayer();
  // ... rest of existing code ...
}
```

### Phase 5: Type Definition Update

**File:** `src/main/webui/static/app.ts` (or create `types.ts`)

Update `CameraProxyConfigResponse` interface:

```typescript
export interface CameraProxyConfigResponse {
  success: boolean;
  streamType: 'mjpeg' | 'rtsp';
  url?: string;
  port?: number;
  wsPort?: number;
  ffmpegAvailable?: boolean;
  showCameraFps?: boolean;  // NEW
}
```

### WebUI File Changes Summary

| File | Change Type | Lines | Description |
|------|-------------|-------|-------------|
| `src/main/webui/server/routes/camera-routes.ts` | Modify | ~15 | Add `showCameraFps` to response |
| `src/main/webui/static/grid/WebUIComponentRegistry.ts` | Modify | ~3 | Add FPS overlay element |
| `src/main/webui/static/webui.css` | Modify | ~20 | FPS overlay styling |
| `src/main/webui/static/features/camera.ts` | Modify | ~80 | FPS tracking logic |
| `src/main/webui/static/app.ts` | Modify | ~1 | Update type interface |

**Total WebUI: 5 files, ~120 lines**

### WebUI Testing Plan

1. **MJPEG Camera**
   - Access WebUI with MJPEG camera printer
   - Verify FPS overlay appears when setting is enabled
   - Toggle off in desktop settings, refresh WebUI - overlay should hide

2. **RTSP Camera**
   - Access WebUI with RTSP camera configured
   - Verify FPS overlay appears when setting is enabled
   - Compare FPS to expected camera output

3. **No Camera / Camera Disabled**
   - FPS overlay should remain hidden
   - No console errors

4. **Multi-Context**
   - Switch between printers with different FPS settings
   - Verify overlay respects each printer's setting

---

## Combined Implementation Checklist

### Desktop App (Phase 1)
- [ ] Add `rtspFrameCount` and `isRtspStream` state variables
- [ ] Set `isRtspStream = true` in `createRtspStream()`
- [ ] Set `isRtspStream = false` in `createMjpegStream()`
- [ ] Add `onVideoDecode` callback to JSMpeg.Player options
- [ ] Update `updateFpsFromStats()` to branch on stream type
- [ ] Update `resetFpsTracking()` to clear RTSP state
- [ ] Update `cleanupCameraStream()` to reset RTSP state

### WebUI Extension (Phase 2)
- [ ] Add `showCameraFps` to camera-routes.ts responses
- [ ] Add FPS overlay element to WebUIComponentRegistry.ts template
- [ ] Add FPS overlay CSS to webui.css
- [ ] Add FPS tracking state and functions to camera.ts
- [ ] Hook `onVideoDecode` for RTSP in camera.ts
- [ ] Count frame loads for MJPEG in camera.ts
- [ ] Update type definition for CameraProxyConfigResponse

### Validation
- [ ] Run type-check: `npm run type-check`
- [ ] Run build: `npm run build:renderer`
- [ ] Run build:webui: `npm run build:webui` (if applicable)
- [ ] Run lint: `npm run lint`
- [ ] Manual testing with MJPEG camera (desktop + WebUI)
- [ ] Manual testing with RTSP camera (desktop + WebUI)

---

## References

- [JSMpeg GitHub - onVideoDecode docs](https://github.com/phoboslab/jsmpeg)
- Commit 73c56be: Original FPS overlay implementation
- `src/main/services/CameraProxyService.ts`: MJPEG frame counting
- `src/main/services/RtspStreamService.ts`: RTSP stream setup
- `src/shared/types/jsmpeg.d.ts`: JSMpeg type definitions
