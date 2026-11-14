/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Jest coverage for the WebUI camera feature helpers.
 *
 * Verifies `camera.js` builds `video-rtc` playback from camera proxy config,
 * surfaces invalid stream configuration cleanly, tears down camera UI when
 * printer capabilities indicate no camera support, and drives the fullscreen
 * toggle for the camera panel.
 */

const mockApiRequest = jest.fn();
const mockState: {
  authRequired: boolean;
  authToken: string | null;
  printerFeatures: { hasCamera: boolean };
} = {
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

  it('creates a video-rtc element from the proxied camera configuration', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
      wsUrl: '/api/camera/ws?src=context-1-camera',
      mode: 'webrtc,mse,mjpeg',
      showCameraFps: true,
    });

    await loadCameraStream();

    const player = document.querySelector('video-rtc') as HTMLElement | null;
    const overlay = document.getElementById('camera-fps-overlay');

    expect(player).not.toBeNull();
    expect((player as any).src).toBe('/api/camera/ws?src=context-1-camera');
    expect((player as any).mode).toBe('webrtc,mse,mjpeg');
    expect(document.getElementById('camera-placeholder')?.classList.contains('hidden')).toBe(true);
    expect(overlay?.classList.contains('hidden')).toBe(false);
    expect(overlay?.textContent).toBe('Streaming');
  });

  it('appends the auth token to the proxied websocket URL when authenticated', async () => {
    mockState.authRequired = true;
    mockState.authToken = 'secret token';
    mockApiRequest.mockResolvedValue({
      success: true,
      wsUrl: '/api/camera/ws?src=context-1-camera',
      mode: 'webrtc,mse,mjpeg',
      showCameraFps: false,
    });

    await loadCameraStream();

    const player = document.querySelector('video-rtc') as HTMLElement | null;

    expect(player).not.toBeNull();
    expect((player as any).src).toBe('/api/camera/ws?src=context-1-camera&token=secret%20token');
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

  describe('fullscreen toggle', () => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = jest.fn(async function (this: Element) {
      fullscreenElement = this;
    });
    const exitFullscreen = jest.fn(async () => {
      fullscreenElement = null;
    });

    const streamConfig = {
      success: true,
      wsUrl: '/api/camera/ws?src=context-1-camera',
      mode: 'webrtc,mse,mjpeg',
      showCameraFps: false,
    };

    function setFullscreenSupport(enabled: boolean): void {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled });
    }

    function getButton(): HTMLElement {
      return document.getElementById('camera-fullscreen-btn') as HTMLElement;
    }

    function fireFullscreenChange(): void {
      document.dispatchEvent(new Event('fullscreenchange'));
    }

    beforeEach(() => {
      fullscreenElement = null;
      requestFullscreen.mockClear();
      exitFullscreen.mockClear();

      // jsdom does not implement the Fullscreen API, so provide a minimal fake
      setFullscreenSupport(true);
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
      Object.defineProperty(Element.prototype, 'requestFullscreen', {
        configurable: true,
        value: requestFullscreen,
      });

      document.body.innerHTML = `
        <div id="camera-container">
          <div id="camera-placeholder"></div>
          <div id="camera-fps-overlay" class="hidden"></div>
          <button id="camera-fullscreen-btn" class="hidden" title="Enter fullscreen"></button>
        </div>
      `;
      teardownCameraStreamElements();
      mockApiRequest.mockResolvedValue(streamConfig);
    });

    afterEach(() => {
      delete (document as any).fullscreenEnabled;
      delete (document as any).fullscreenElement;
      delete (document as any).exitFullscreen;
      delete (Element.prototype as any).requestFullscreen;
    });

    it('stays hidden until a stream is playing', () => {
      expect(getButton().classList.contains('hidden')).toBe(true);
    });

    it('shows the button once the stream starts', async () => {
      await loadCameraStream();

      expect(getButton().classList.contains('hidden')).toBe(false);
    });

    it('keeps the button hidden when the browser lacks fullscreen support', async () => {
      setFullscreenSupport(false);

      await loadCameraStream();

      expect(getButton().classList.contains('hidden')).toBe(true);
    });

    it('enters fullscreen on the camera container and updates the button', async () => {
      await loadCameraStream();

      getButton().click();
      fireFullscreenChange();

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fullscreenElement).toBe(document.getElementById('camera-container'));
      expect(getButton().title).toBe('Exit fullscreen');
      expect(getButton().getAttribute('aria-label')).toBe('Exit fullscreen');
      expect(getButton().classList.contains('is-active')).toBe(true);
    });

    it('exits fullscreen when the button is clicked again', async () => {
      await loadCameraStream();
      getButton().click();
      fireFullscreenChange();

      getButton().click();
      fireFullscreenChange();

      expect(exitFullscreen).toHaveBeenCalledTimes(1);
      expect(getButton().title).toBe('Enter fullscreen');
      expect(getButton().classList.contains('is-active')).toBe(false);
    });

    it('resets the button when fullscreen is exited outside the button, such as with Esc', async () => {
      await loadCameraStream();
      getButton().click();
      fireFullscreenChange();

      fullscreenElement = null;
      fireFullscreenChange();

      expect(getButton().title).toBe('Enter fullscreen');
      expect(getButton().classList.contains('is-active')).toBe(false);
    });

    it('leaves fullscreen and hides the button when the camera is torn down', async () => {
      await loadCameraStream();
      getButton().click();
      fireFullscreenChange();

      teardownCameraStreamElements();

      expect(exitFullscreen).toHaveBeenCalledTimes(1);
      expect(getButton().classList.contains('hidden')).toBe(true);
    });

    it('logs a warning instead of throwing when the fullscreen request is rejected', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      requestFullscreen.mockRejectedValueOnce(new Error('denied'));
      await loadCameraStream();

      getButton().click();
      await Promise.resolve();
      await Promise.resolve();

      expect(warnSpy).toHaveBeenCalledWith('[Camera] Fullscreen toggle failed:', expect.any(Error));
      warnSpy.mockRestore();
    });
  });
});
