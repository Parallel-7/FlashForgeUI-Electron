/**
 * @fileoverview Tests for camera utility helpers covering stream-type detection,
 * URL formatting, validation, and context-aware camera config resolution.
 */

/**
 * @fileoverview Jest coverage for camera utility helpers.
 *
 * Verifies camera capability detection, custom URL derivation, and stream-type
 * classification used by desktop and WebUI camera setup paths.
 */
import type { PrinterFeatureSet } from '@shared/types/printer-backend/index.js';
import { getConfigManager } from '../../managers/ConfigManager.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import {
  detectStreamType,
  formatGo2rtcMjpegUrl,
  formatGo2rtcWsUrl,
  getCameraUserConfig,
  resolveCameraConfig,
  validateCameraUrl,
} from '../camera-utils.js';

jest.mock('../../managers/ConfigManager.js', () => ({
  getConfigManager: jest.fn(),
}));

jest.mock('../../managers/PrinterContextManager.js', () => ({
  getPrinterContextManager: jest.fn(),
}));

function createFeatures(overrides: Partial<PrinterFeatureSet['camera']> = {}): PrinterFeatureSet {
  return {
    camera: {
      builtin: false,
      customEnabled: false,
      customUrl: null,
      ...overrides,
    },
    ledControl: {
      builtin: false,
      customControlEnabled: false,
      usesLegacyAPI: true,
    },
    filtration: {
      available: false,
      controllable: false,
    },
    gcodeCommands: {
      available: true,
      usesLegacyAPI: true,
      supportedCommands: [],
    },
    statusMonitoring: {
      available: true,
      usesNewAPI: false,
      usesLegacyAPI: true,
      realTimeUpdates: false,
    },
    jobManagement: {
      localJobs: false,
      recentJobs: false,
      uploadJobs: false,
      startJobs: false,
      pauseResume: true,
      cancelJobs: true,
      usesNewAPI: false,
    },
    materialStation: {
      available: false,
      slotCount: 0,
      perSlotInfo: false,
      materialDetection: false,
    },
  };
}

describe('camera-utils', () => {
  const mockConfigManager = {
    get: jest.fn(),
  };
  const mockContextManager = {
    getContext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getConfigManager as jest.Mock).mockReturnValue(mockConfigManager);
    (getPrinterContextManager as jest.Mock).mockReturnValue(mockContextManager);
  });

  it('detects stream types from URLs', () => {
    expect(detectStreamType('rtsp://192.168.1.10/live')).toBe('rtsp');
    expect(detectStreamType('http://192.168.1.10:8080/?action=stream')).toBe('mjpeg');
    expect(detectStreamType('not-a-url')).toBe('mjpeg');
  });

  it('validates supported and unsupported camera URLs', () => {
    expect(validateCameraUrl('http://192.168.1.10:8080/?action=stream').isValid).toBe(true);
    expect(validateCameraUrl('rtsp://192.168.1.10/live').isValid).toBe(true);
    expect(validateCameraUrl('ftp://192.168.1.10/live')).toEqual({
      isValid: false,
      error: 'Unsupported protocol: ftp:. Use http://, https://, or rtsp://',
    });
    expect(validateCameraUrl('')).toEqual({
      isValid: false,
      error: 'URL is empty or not provided',
    });
  });

  it('derives the default FlashForge camera URL when custom camera is enabled without a URL', () => {
    const result = resolveCameraConfig({
      printerIpAddress: '192.168.1.25',
      printerFeatures: createFeatures(),
      userConfig: {
        customCameraEnabled: true,
        customCameraUrl: '',
      },
    });

    expect(result).toEqual({
      sourceType: 'custom',
      streamType: 'mjpeg',
      streamUrl: 'http://192.168.1.25:8080/?action=stream',
      isAvailable: true,
    });
  });

  it('rejects invalid custom camera URLs and falls back to builtin cameras when available', () => {
    const invalidCustom = resolveCameraConfig({
      printerIpAddress: '192.168.1.25',
      printerFeatures: createFeatures(),
      userConfig: {
        customCameraEnabled: true,
        customCameraUrl: 'not-a-url',
      },
    });
    const builtin = resolveCameraConfig({
      printerIpAddress: '192.168.1.25',
      printerFeatures: createFeatures({ builtin: true }),
      userConfig: {
        customCameraEnabled: false,
        customCameraUrl: null,
      },
    });

    expect(invalidCustom).toMatchObject({
      sourceType: 'custom',
      isAvailable: false,
      unavailableReason: expect.stringContaining('Custom camera URL is invalid'),
    });
    expect(builtin).toEqual({
      sourceType: 'builtin',
      streamType: 'mjpeg',
      streamUrl: 'http://192.168.1.25:8080/?action=stream',
      isAvailable: true,
    });
  });

  it('prefers per-printer camera settings over global config when a context is provided', () => {
    mockContextManager.getContext.mockReturnValue({
      printerDetails: {
        customCameraEnabled: true,
        customCameraUrl: '',
      },
    });
    mockConfigManager.get.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        CustomCamera: false,
        CustomCameraUrl: 'http://global-camera',
      };
      return values[key];
    });

    expect(getCameraUserConfig('context-1')).toEqual({
      customCameraEnabled: true,
      customCameraUrl: null,
    });
    expect(getCameraUserConfig()).toEqual({
      customCameraEnabled: false,
      customCameraUrl: 'http://global-camera',
    });
  });

  it('formats go2rtc proxy URLs for WebSocket and MJPEG access', () => {
    expect(formatGo2rtcWsUrl(1984, 'printer camera')).toBe('ws://localhost:1984/api/ws?src=printer%20camera');
    expect(formatGo2rtcMjpegUrl(1984, 'printer camera')).toBe(
      'http://localhost:1984/api/frame.jpeg?src=printer%20camera'
    );
  });
});
