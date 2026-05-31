/**
 * @fileoverview Camera streaming helpers for the WebUI client using go2rtc.
 *
 * Unified camera streaming using go2rtc as the streaming gateway. All camera types
 * (MJPEG and RTSP) are handled through go2rtc, which provides WebRTC/MSE/MJPEG
 * fallback for browser playback. This eliminates the rotation drift bug caused
 * by JSMpeg's canvas rendering by using native <video> element playback.
 *
 * Key improvements:
 * - Native <video> element (no canvas = no rotation drift)
 * - Lower latency via WebRTC (~500ms vs 1-3s with transcoding)
 * - Automatic reconnection built into go2rtc
 * - Unified handling for all camera types
 */

import type { CameraProxyConfigResponse } from '../app.js';
import { state } from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { $, hideElement, showElement } from '../shared/dom.js';

/**
 * Interface for the video-rtc custom element
 */
interface VideoRTCElement extends HTMLElement {
  src: string;
  mode: string;
  media: string;
}

/** Current video-rtc element instance */
let videoRtcElement: VideoRTCElement | null = null;

/** Whether FPS overlay is enabled */
let showFpsOverlay = false;

/**
 * Update FPS overlay display.
 * Note: video-rtc doesn't expose frame counts directly like JSMpeg did.
 * The FPS overlay will show connection status instead.
 */
function updateFpsDisplay(): void {
  const overlay = $('camera-fps-overlay');
  if (!overlay) return;

  if (!showFpsOverlay) {
    overlay.classList.add('hidden');
    return;
  }

  overlay.classList.remove('hidden');
  // video-rtc handles playback internally, we show stream status instead
  overlay.textContent = videoRtcElement ? 'Streaming' : 'Offline';
}

/**
 * Destroy the current video-rtc player
 */
function destroyVideoRtcPlayer(): void {
  if (videoRtcElement) {
    try {
      // Remove from DOM
      videoRtcElement.remove();
    } catch (error) {
      console.warn('[Camera] Failed to destroy video-rtc player:', error);
    } finally {
      videoRtcElement = null;
    }
  }
}

/**
 * Teardown all camera stream elements and reset state
 */
export function teardownCameraStreamElements(): void {
  showFpsOverlay = false;
  destroyVideoRtcPlayer();

  const placeholder = $('camera-placeholder');
  if (placeholder) {
    placeholder.textContent = 'Camera offline';
  }
  showElement('camera-placeholder');

  updateFpsDisplay();
}

/**
 * Create and configure a video-rtc element for camera streaming
 */
function createVideoRtcElement(wsUrl: string, mode: string): VideoRTCElement {
  const element = document.createElement('video-rtc') as VideoRTCElement;

  // Configure the element
  element.src = wsUrl;
  element.mode = mode;
  element.media = 'video'; // Video only, no audio for camera feeds

  // Style the element
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.objectFit = 'cover';
  element.style.display = 'block';

  return element;
}

/**
 * Load and display camera stream from go2rtc
 */
export async function loadCameraStream(): Promise<void> {
  const cameraPlaceholder = $('camera-placeholder');
  const cameraContainer = $('camera-container') || $('camera-stream')?.parentElement;

  if (!cameraPlaceholder) {
    console.error('[Camera] Required DOM element (camera-placeholder) not found');
    return;
  }

  // Check auth
  if (state.authRequired && !state.authToken) {
    console.warn('[Camera] Skipping stream load due to missing auth token');
    teardownCameraStreamElements();
    return;
  }

  try {
    // Fetch camera configuration from server
    const config = await apiRequest<CameraProxyConfigResponse>('/api/camera/proxy-config');

    if (!config.success) {
      throw new Error(config.error || 'Failed to get camera configuration');
    }

    if (!config.wsUrl) {
      throw new Error('No WebSocket URL provided for camera stream');
    }

    // Cleanup any existing player
    destroyVideoRtcPlayer();

    // Hide placeholder while streaming
    hideElement('camera-placeholder');

    // Set up FPS overlay (shows status for go2rtc)
    showFpsOverlay = config.showCameraFps ?? false;

    // Create video-rtc element
    const mode = config.mode || 'webrtc,mse,mjpeg';
    videoRtcElement = createVideoRtcElement(config.wsUrl, mode);

    // Find the camera container and add the video-rtc element
    if (cameraContainer) {
      cameraContainer.appendChild(videoRtcElement);
    } else {
      // Fallback: replace placeholder's parent content
      const parent = cameraPlaceholder.parentElement;
      if (parent) {
        parent.appendChild(videoRtcElement);
      }
    }

    console.log(`[Camera] go2rtc stream started: ${config.wsUrl} (mode: ${mode})`);
    updateFpsDisplay();
  } catch (error) {
    console.error('[Camera] Failed to load camera stream:', error);

    teardownCameraStreamElements();

    if (cameraPlaceholder) {
      const errorMessage = error instanceof Error ? error.message : 'Camera Configuration Error';
      cameraPlaceholder.textContent = errorMessage;
    }
    showElement('camera-placeholder');
  }
}

/**
 * Initialize camera module - called when printer features are available
 */
export function initializeCamera(): void {
  if (!state.printerFeatures?.hasCamera) {
    teardownCameraStreamElements();
    return;
  }

  void loadCameraStream();
}
