/**
 * @fileoverview Jest coverage for the WebUI camera feature helpers.
 *
 * Verifies `camera.js` builds `video-rtc` playback from camera proxy config,
 * surfaces invalid stream configuration cleanly, and tears down camera UI when
 * printer capabilities indicate no camera support.
 */
/**
 * @fileoverview JSDOM tests for WebUI camera initialization, proxy-config handling,
 * and fallback UI states when streams are unavailable.
 */

/**
 * @jest-environment jsdom
 */

const mockApiRequest = jest.fn();
const mockState = {
  authRequired: false,
  authToken: null,
  printerFeatures: {
    hasCamera: true,
  },
};

jest.mock('../../core/Transport.js', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

jest.mock('../../core/AppState.js', () => ({
  state: mockState,
}));

import { initializeCamera, loadCameraStream, teardownCameraStreamElements } from '../camera.js';

describe('webui camera feature', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockState.authRequired = false;
    mockState.authToken = null;
    mockState.printerFeatures = { hasCamera: true };
    document.body.innerHTML = `
      <div id="camera-container"></div>
      <div id="camera-placeholder"></div>
      <div id="camera-fps-overlay" class="hidden"></div>
    `;
    teardownCameraStreamElements();
  });

  it('creates a video-rtc element from the websocket camera configuration', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
      wsUrl: 'ws://localhost:1984/api/ws?src=context-1-camera',
      mode: 'webrtc,mse,mjpeg',
      showCameraFps: true,
    });

    await loadCameraStream();

    const player = document.querySelector('video-rtc') as HTMLElement | null;
    const overlay = document.getElementById('camera-fps-overlay');

    expect(player).not.toBeNull();
    expect((player as any).src).toBe('ws://localhost:1984/api/ws?src=context-1-camera');
    expect((player as any).mode).toBe('webrtc,mse,mjpeg');
    expect(document.getElementById('camera-placeholder')?.classList.contains('hidden')).toBe(true);
    expect(overlay?.classList.contains('hidden')).toBe(false);
    expect(overlay?.textContent).toBe('Streaming');
  });

  it('surfaces camera configuration errors when the server omits a websocket URL', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
    });

    await loadCameraStream();

    expect(document.querySelector('video-rtc')).toBeNull();
    expect(document.getElementById('camera-placeholder')?.textContent).toBe(
      'No WebSocket URL provided for camera stream'
    );
    expect(document.getElementById('camera-placeholder')?.classList.contains('hidden')).toBe(false);
  });

  it('tears down the camera immediately when printer features report no camera', () => {
    mockState.printerFeatures = { hasCamera: false };

    initializeCamera();

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(document.getElementById('camera-placeholder')?.textContent).toBe('Camera offline');
  });
});
