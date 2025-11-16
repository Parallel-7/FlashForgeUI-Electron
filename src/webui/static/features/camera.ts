/**
 * @fileoverview Camera streaming helpers for the WebUI client.
 *
 * Fetches camera proxy configuration, initializes MJPEG or RTSP (JSMpeg)
 * rendering, and provides teardown utilities so contexts can be switched
 * without stale DOM state. Keeps camera concerns isolated from the main app
 * orchestrator.
 */

import type { CameraProxyConfigResponse } from '../app.js';
import type { JSMpegPlayerInstance, JSMpegStatic } from '../../../types/jsmpeg';
import { state } from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { $, hideElement, showElement } from '../shared/dom.js';

declare const JSMpeg: JSMpegStatic;

let jsmpegPlayer: JSMpegPlayerInstance | null = null;

function destroyRtspPlayer(): void {
  try {
    jsmpegPlayer?.destroy();
  } catch (error) {
    console.warn('[Camera] Failed to destroy JSMpeg player:', error);
  } finally {
    jsmpegPlayer = null;
  }
}

export function teardownCameraStreamElements(): void {
  destroyRtspPlayer();

  const cameraStream = $('camera-stream') as HTMLImageElement | null;
  if (cameraStream) {
    cameraStream.src = '';
    cameraStream.removeAttribute('src');
    hideElement('camera-stream');
  }

  const canvas = $('camera-canvas') as HTMLCanvasElement | null;
  if (canvas) {
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    hideElement('camera-canvas');
  }

  const placeholder = $('camera-placeholder');
  if (placeholder) {
    placeholder.textContent = 'Camera offline';
  }
  showElement('camera-placeholder');
}

export async function loadCameraStream(): Promise<void> {
  const cameraPlaceholder = $('camera-placeholder');
  const cameraStream = $('camera-stream') as HTMLImageElement | null;
  const cameraCanvas = $('camera-canvas') as HTMLCanvasElement | null;

  if (!cameraPlaceholder || !cameraStream || !cameraCanvas) {
    console.error('[Camera] Required DOM elements not found');
    return;
  }

  if (state.authRequired && !state.authToken) {
    console.warn('[Camera] Skipping stream load due to missing auth token');
    teardownCameraStreamElements();
    return;
  }

  try {
    const config = await apiRequest<CameraProxyConfigResponse>('/api/camera/proxy-config');

    if (config.streamType === 'rtsp') {
      if (config.ffmpegAvailable === false) {
        showElement('camera-placeholder');
        hideElement('camera-stream');
        hideElement('camera-canvas');
        cameraPlaceholder.textContent = 'RTSP Camera: ffmpeg required for browser viewing';
        return;
      }

      if (!config.wsPort) {
        throw new Error('No WebSocket port provided for RTSP stream');
      }

      destroyRtspPlayer();
      hideElement('camera-stream');
      showElement('camera-canvas');
      hideElement('camera-placeholder');

      const wsUrl = `ws://${window.location.hostname}:${config.wsPort}`;
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
      });
      return;
    }

    if (!config.url) {
      throw new Error('No camera URL provided by server');
    }

    destroyRtspPlayer();
    const cameraUrl = config.url;
    cameraStream.src = cameraUrl;

    cameraStream.onload = () => {
      hideElement('camera-placeholder');
      hideElement('camera-canvas');
      showElement('camera-stream');
    };

    cameraStream.onerror = () => {
      showElement('camera-placeholder');
      hideElement('camera-stream');
      hideElement('camera-canvas');
      cameraPlaceholder.textContent = 'Camera Stream Error';

      setTimeout(() => {
        if (state.printerFeatures?.hasCamera) {
          cameraStream.src = `${cameraUrl}?t=${Date.now()}`;
        }
      }, 5000);
    };
  } catch (error) {
    console.error('[Camera] Failed to load camera proxy configuration:', error);
    showElement('camera-placeholder');
    hideElement('camera-stream');
    hideElement('camera-canvas');
    if (cameraPlaceholder) {
      cameraPlaceholder.textContent = 'Camera Configuration Error';
    }
  }
}

export function initializeCamera(): void {
  if (!state.printerFeatures?.hasCamera) {
    teardownCameraStreamElements();
    return;
  }

  void loadCameraStream();
}
