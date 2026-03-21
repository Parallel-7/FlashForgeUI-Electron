/**
 * @fileoverview Jest coverage for Go2rtcService stream reconciliation behavior.
 */

const mockBinaryManager = {
  start: jest.fn(),
  stop: jest.fn(),
  isRunning: jest.fn(),
  getApiUrl: jest.fn(),
  getApiPort: jest.fn(),
  getWebRtcPort: jest.fn(),
  getPid: jest.fn(),
};

jest.mock('../Go2rtcBinaryManager.js', () => ({
  Go2rtcBinaryManager: class {},
  getGo2rtcBinaryManager: () => mockBinaryManager,
}));

import { Go2rtcService } from '../Go2rtcService.js';

describe('Go2rtcService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Go2rtcService as any).instance = null;
    mockBinaryManager.start.mockResolvedValue(undefined);
    mockBinaryManager.stop.mockResolvedValue(undefined);
    mockBinaryManager.isRunning.mockReturnValue(true);
    mockBinaryManager.getApiUrl.mockReturnValue('http://127.0.0.1:1984');
    mockBinaryManager.getApiPort.mockReturnValue(1984);
    mockBinaryManager.getWebRtcPort.mockReturnValue(8555);
    mockBinaryManager.getPid.mockReturnValue(1234);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
      json: jest.fn().mockResolvedValue({}),
    }) as any;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('detects matching managed streams and avoids re-registering them', async () => {
    const service = Go2rtcService.getInstance();

    await service.addStream('context-1', 'http://192.168.1.25:8080/?action=stream', 'oem', 'mjpeg');

    expect(service.hasMatchingStream('context-1', 'http://192.168.1.25:8080/?action=stream', 'oem', 'mjpeg')).toBe(
      true
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await service.addStream('context-1', 'http://192.168.1.25:8080/?action=stream', 'oem', 'mjpeg');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('restores managed streams when go2rtc has stopped and is re-initialized', async () => {
    const service = Go2rtcService.getInstance();

    await service.addStream('context-1', 'rtsp://192.168.1.25/live', 'custom', 'rtsp');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    mockBinaryManager.isRunning.mockReturnValue(false);
    await service.initialize();

    expect(mockBinaryManager.start).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('accepts intelligently detected fallback streams as managed go2rtc sources', async () => {
    const service = Go2rtcService.getInstance();

    await service.addStream('context-1', 'http://192.168.1.25:8080/?action=stream', 'intelligent-fallback', 'mjpeg');

    expect(
      service.hasMatchingStream('context-1', 'http://192.168.1.25:8080/?action=stream', 'intelligent-fallback', 'mjpeg')
    ).toBe(true);
  });
});
