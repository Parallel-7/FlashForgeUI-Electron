import { jest, test, expect, describe } from '@jest/globals';
import { getGo2rtcBinaryManager } from '../Go2rtcBinaryManager';
import { getGo2rtcService } from '../Go2rtcService';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp'),
    getAppPath: jest.fn(() => '/tmp'),
    isPackaged: false,
    on: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
})) as any;

// Mock fs to avoid file writes
jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock child_process
jest.mock('node:child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    kill: jest.fn(),
    pid: 12345,
  })),
}));

describe('Go2rtc Authentication', () => {
  test('Go2rtcBinaryManager generates credentials', () => {
    const manager = getGo2rtcBinaryManager();
    const creds = manager.getCredentials();

    expect(creds.username).toBe('admin');
    expect(creds.password).toBeDefined();
    expect(creds.password.length).toBeGreaterThan(0);
  });

  test('Go2rtcService sends auth headers', async () => {
    const manager = getGo2rtcBinaryManager();
    const service = getGo2rtcService();

    const { username, password } = manager.getCredentials();
    const expectedAuth = Buffer.from(`${username}:${password}`).toString('base64');

    // Mock binaryManager methods
    jest.spyOn(manager, 'isRunning').mockReturnValue(true);
    jest.spyOn(manager, 'getApiUrl').mockReturnValue('http://localhost:1984');
    jest.spyOn(manager, 'getApiPort').mockReturnValue(1984);

    await service.addStream('test-context', 'rtsp://test', 'custom', 'rtsp');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/streams'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`
        })
      })
    );
  });

  test('Go2rtcService constructs authenticated WS URL', async () => {
      const manager = getGo2rtcBinaryManager();
      const service = getGo2rtcService();

      const { username, password } = manager.getCredentials();

      jest.spyOn(manager, 'isRunning').mockReturnValue(true);
      jest.spyOn(manager, 'getApiUrl').mockReturnValue('http://localhost:1984');
      jest.spyOn(manager, 'getApiPort').mockReturnValue(1984);

      await service.addStream('test-context-2', 'rtsp://test', 'custom', 'rtsp');
      const config = service.getStreamConfig('test-context-2');

      expect(config).not.toBeNull();
      if (config) {
         expect(config.wsUrl).toContain(`user=${username}`);
         expect(config.wsUrl).toContain(`password=${password}`);
      }
  });
});
