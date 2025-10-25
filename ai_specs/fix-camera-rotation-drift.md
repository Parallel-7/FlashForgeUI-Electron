# Fix: Camera Stream Progressive Rotation Bug

## Problem Description

Users report that after the application has been running for a while, the MJPEG camera feed progressively rotates counter-clockwise. The rotation can accumulate up to 90 degrees over time. The issue:

- Occurs after extended runtime (timing varies)
- Affects only the camera stream in the UI, not the actual video feed
- Persists even when toggling the camera preview off/on
- Only corrects itself when the entire application is restarted
- Does not occur when viewing the camera stream directly

## Root Cause Analysis

Based on investigation:

1. **The img element is recreated when toggling preview** - This rules out the img element itself as the source
2. **The `.camera-view` container persists** - The parent div is never destroyed/recreated, only its innerHTML is cleared
3. **GPU compositing layers on long-running containers** - The combination of:
   - Persistent container with `display: flex`, `align-items: center`, `justify-content: center`
   - Child img with `object-fit: cover` (forces GPU compositing)
   - Continuous MJPEG stream updates
   - Long runtime without container recreation

This suggests the `.camera-view` container's GPU compositing layer is accumulating rendering artifacts or transform drift over time.

## Solution

Implement a two-layer defense:

### Layer 1: CSS Hardening (Prevent Transform Accumulation)

Add explicit CSS properties to the camera view container and image to prevent any transform accumulation or GPU compositor drift.

**File:** `src/ui/components/camera-preview/camera-preview.css`

Add to `.component-camera-preview .camera-view` selector:
```css
.component-camera-preview .camera-view {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background-color: var(--darker-bg);
  min-height: 0;

  /* Prevent GPU layer transform accumulation */
  transform: rotate(0deg);
  will-change: auto;
}
```

Modify `.component-camera-preview .camera-view img` selector:
```css
.component-camera-preview .camera-view img {
  width: 100%;
  height: 100%;
  object-fit: cover;

  /* Explicitly prevent any rotation transforms */
  transform: rotate(0deg) !important;

  /* Prevent GPU compositor optimizations that could accumulate artifacts */
  will-change: auto;

  /* Force proper image rendering */
  image-rendering: -webkit-optimize-contrast;
}
```

### Layer 2: Periodic Container Reset (Failsafe)

Since toggling the preview doesn't fix the issue (container persists), implement periodic recreation of the entire `.camera-view` container to clear any GPU layer corruption.

**File:** `src/ui/components/camera-preview/camera-preview.ts`

#### Changes Required:

1. **Add refresh interval property:**
```typescript
/** Periodic refresh timer to prevent GPU compositor artifacts */
private containerRefreshInterval: NodeJS.Timeout | null = null;
```

2. **Start refresh timer when enabling camera:**

In `enableCameraPreview()` method, after successfully creating the stream and before updating button state:

```typescript
// Update button state
button.textContent = 'Preview Off';
this.updateComponentState('streaming');

// Start periodic container refresh to prevent GPU compositor artifacts
// This recreates the img element every 30 minutes to clear any accumulated rendering drift
this.startContainerRefresh(cameraView, cameraConfig.streamType === 'rtsp');
```

3. **Add new method to start container refresh:**
```typescript
/**
 * Start periodic container refresh to prevent GPU compositor artifacts
 * Recreates the camera stream element every 30 minutes to clear accumulated rendering drift
 */
private startContainerRefresh(cameraView: HTMLElement, isRtsp: boolean): void {
  // Clear any existing interval
  this.stopContainerRefresh();

  this.containerRefreshInterval = setInterval(async () => {
    if (!this.previewEnabled || !this.cameraStreamElement) {
      return;
    }

    console.log('[CameraPreview] Performing periodic container refresh to prevent artifacts');

    try {
      // Store current stream info
      let streamUrl = '';
      if (isRtsp) {
        const rtspInfo = await window.api.invoke('camera:get-rtsp-relay-info') as { wsUrl: string } | null;
        if (!rtspInfo) return;
        streamUrl = rtspInfo.wsUrl;
      } else {
        const proxyUrl = await window.api.camera.getProxyUrl();
        streamUrl = proxyUrl;
      }

      // Clean up current stream
      this.cleanupCameraStream();

      // Recreate stream with fresh elements
      if (isRtsp) {
        this.createRtspStream(streamUrl, cameraView);
      } else {
        this.createMjpegStream(streamUrl, cameraView);
      }

      console.log('[CameraPreview] Container refresh completed');
    } catch (error) {
      console.error('[CameraPreview] Error during container refresh:', error);
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}
```

4. **Add method to stop refresh:**
```typescript
/**
 * Stop periodic container refresh
 */
private stopContainerRefresh(): void {
  if (this.containerRefreshInterval) {
    clearInterval(this.containerRefreshInterval);
    this.containerRefreshInterval = null;
  }
}
```

5. **Update cleanup to stop refresh timer:**

In `cleanup()` method, add before existing cleanup code:
```typescript
protected cleanup(): void {
  console.log('Cleaning up camera preview component');

  // Stop periodic refresh
  this.stopContainerRefresh();

  // Clean up camera stream
  this.cleanupCameraStream();

  // ... rest of existing cleanup ...
}
```

6. **Update disableCameraPreview to stop refresh:**

In `disableCameraPreview()` method, add after logging:
```typescript
private async disableCameraPreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
  console.log('Disabling camera preview');

  // Stop periodic refresh
  this.stopContainerRefresh();

  // Clean up stream
  this.cleanupCameraStream();

  // ... rest of existing code ...
}
```

## Implementation Notes

- The CSS changes explicitly force `transform: rotate(0deg)` to prevent any rotation accumulation
- The 30-minute refresh interval is conservative - can be adjusted if needed
- The refresh recreates the img/canvas element completely, clearing any GPU layer state
- Logging is included for debugging - can monitor if refreshes correlate with stability
- The refresh only runs while preview is enabled
- RTSP and MJPEG streams are both handled by the refresh mechanism

## Testing Recommendations

After implementation:

1. Run the application for extended periods (several hours)
2. Monitor console logs for refresh events
3. Check if rotation still occurs after 30-minute intervals
4. If rotation still appears, consider reducing refresh interval to 15 minutes
5. Test with both MJPEG and RTSP streams if applicable

## Rationale

This two-layer approach provides:

1. **CSS hardening** - Zero-cost prevention at the rendering layer
2. **Periodic reset** - Guaranteed cleanup of any accumulated state
3. **Minimal risk** - Non-invasive changes that don't affect core functionality
4. **Debuggability** - Console logging to verify refresh timing

The combination addresses both CSS-level transform accumulation and GPU compositor memory/state corruption.
