/**
 * @fileoverview Tests for camera WebUI routes covering proxy-config responses,
 * auth-sensitive behavior, and go2rtc-backed camera availability.
 */

/**
 * @fileoverview Jest coverage for WebUI camera route handlers.
 *
 * Tests route-level camera status/proxy responses, validation, and error
 * handling around the shared camera services exposed to the WebUI.
 */
import express from 'express';
import { getConfigManager } from '../../../../managers/ConfigManager.js';
import { getPrinterContextManager } from '../../../../managers/PrinterContextManager.js';
import { getGo2rtcService } from '../../../../services/Go2rtcService.js';
import { registerCameraRoutes } from '../camera-routes.js';
import { startTestServer } from '../test-server.js';

jest.mock('../../../../managers/ConfigManager.js', () => ({
  getConfigManager: jest.fn(),
}));

jest.mock('../../../../managers/PrinterContextManager.js', () => ({
  getPrinterContextManager: jest.fn(),
}));

jest.mock('../../../../services/Go2rtcService.js', () => ({
  getGo2rtcService: jest.fn(),
}));

describe('camera-routes', () => {
  const go2rtcService = {
    hasStream: jest.fn(),
    hasMatchingStream: jest.fn(),
    isRunning: jest.fn(),
    initialize: jest.fn(),
    addStream: jest.fn(),
    removeStream: jest.fn(),
    getStreamConfig: jest.fn(),
  };
  const configManager = {
    get: jest.fn(),
  };
  const contextManager = {
    getContext: jest.fn(),
  };

  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
        getBackendForContext: jest.fn().mockReturnValue({
          getBackendStatus: jest.fn().mockReturnValue({
            features: {
              camera: {
                oemStreamUrl: 'http://192.168.1.25:8080/?action=stream',
                customEnabled: true,
                customUrl: null,
              },
            },
          }),
        }),
        isFeatureAvailable: jest.fn().mockReturnValue(true),
      },
      contextManager: {
        getActiveContextId: jest.fn().mockReturnValue('context-1'),
        getContext: jest.fn().mockReturnValue({
          id: 'context-1',
          printerDetails: {
            IPAddress: '192.168.1.25',
            customCameraEnabled: true,
            customCameraUrl: '',
            showCameraFps: true,
          },
        }),
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {},
      ...overrides,
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (getConfigManager as jest.Mock).mockReturnValue(configManager);
    (getPrinterContextManager as jest.Mock).mockReturnValue(contextManager);
    (getGo2rtcService as jest.Mock).mockReturnValue(go2rtcService);
    configManager.get.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        CustomCamera: false,
        CustomCameraUrl: '',
      };

      return values[key];
    });
    contextManager.getContext.mockImplementation((contextId: string) => {
      if (contextId !== 'context-1') {
        return undefined;
      }

      return {
        id: 'context-1',
        printerDetails: {
          IPAddress: '192.168.1.25',
          customCameraEnabled: true,
          customCameraUrl: '',
          showCameraFps: true,
        },
      };
    });
    go2rtcService.hasStream.mockReturnValue(false);
    go2rtcService.hasMatchingStream.mockReturnValue(false);
    go2rtcService.isRunning.mockReturnValue(false);
    go2rtcService.getStreamConfig.mockReturnValue({
      streamName: 'context-1-camera',
      apiPort: 1984,
      mode: 'webrtc,mse,mjpeg',
    });
  });

  it('uses the runtime OEM camera stream and returns a go2rtc websocket configuration', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerCameraRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/camera/proxy-config?contextId=context-1`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(go2rtcService.initialize).toHaveBeenCalled();
    expect(go2rtcService.addStream).toHaveBeenCalledWith(
      'context-1',
      'http://192.168.1.25:8080/?action=stream',
      'oem',
      'mjpeg'
    );
    expect(body).toEqual({
      success: true,
      wsUrl: expect.stringContaining('/api/ws?src=context-1-camera'),
      streamType: 'mjpeg',
      sourceType: 'oem',
      streamName: 'context-1-camera',
      apiPort: 1984,
      mode: 'webrtc,mse,mjpeg',
      showCameraFps: true,
    });
  });

  it('returns 503 when no camera is available for the resolved printer context', async () => {
    contextManager.getContext.mockReturnValue({
      id: 'context-1',
      printerDetails: {
        IPAddress: '192.168.1.25',
        customCameraEnabled: false,
        customCameraUrl: '',
        showCameraFps: false,
      },
    });
    const deps = createDependencies({
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
        getBackendForContext: jest.fn().mockReturnValue({
          getBackendStatus: jest.fn().mockReturnValue({
            features: {
              camera: {
                oemStreamUrl: '',
                customEnabled: false,
                customUrl: null,
              },
            },
          }),
        }),
        isFeatureAvailable: jest.fn().mockReturnValue(false),
      },
    });
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerCameraRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/camera/proxy-config?contextId=context-1`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(503);
    expect(go2rtcService.initialize).not.toHaveBeenCalled();
    expect(body).toEqual({
      success: false,
      error: 'Camera not available for this printer',
    });
  });
});
