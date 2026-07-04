/**
 * @fileoverview Unit tests for AutoLaunchService
 *
 * Validates OS login-item registration for the "Start with system" / "Start minimized"
 * preferences (issue #75): correct app.setLoginItemSettings arguments on toggle, openAsHidden
 * only applying on darwin, wasLaunchedHidden() detection across platforms, and that unpackaged
 * (development) builds skip the OS registration call entirely while still honoring live toggles.
 *
 * @module services/__tests__/AutoLaunchService.test
 */

// Mutable Electron app mock so individual tests can configure return values.
const mockApp = {
  setLoginItemSettings: jest.fn(),
  getLoginItemSettings: jest.fn(() => ({ launchItems: [] })),
};

jest.mock('electron', () => ({
  app: mockApp,
}));

// Mutable ConfigManager mock used by the service constructor + listeners.
const mockConfigManager = {
  getConfig: jest.fn(() => ({ StartAtBoot: false, StartMinimized: false })),
  on: jest.fn(),
  emit: jest.fn(),
};

jest.mock('../../managers/ConfigManager.js', () => ({
  getConfigManager: jest.fn(() => mockConfigManager),
}));

// Mutable environment service mock controlling packaged/dev gating.
const mockEnvironmentService = {
  isPackaged: jest.fn(() => true),
};

jest.mock('../EnvironmentDetectionService.js', () => ({
  getEnvironmentDetectionService: jest.fn(() => mockEnvironmentService),
}));

import { AutoLaunchService, getAutoLaunchService } from '../AutoLaunchService.js';

describe('AutoLaunchService', () => {
  let service: AutoLaunchService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton between tests so initialize() can run fresh each time.
    (AutoLaunchService as unknown as { instance: AutoLaunchService | null }).instance = null;

    // Restore default platform to win32 (override per-test as needed).
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // Restore default mock return values.
    mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: false });
    mockEnvironmentService.isPackaged.mockReturnValue(true);
    mockApp.getLoginItemSettings.mockReturnValue({ launchItems: [] });
    Object.defineProperty(process, 'argv', { value: ['electron'], configurable: true });

    service = getAutoLaunchService();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = getAutoLaunchService();
      const instance2 = getAutoLaunchService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize - setLoginItemSettings arguments', () => {
    it('registers openAtLogin=false and no --hidden args when both toggles are off', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: false });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledTimes(1);
      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: false,
        args: [],
      });
    });

    it('registers openAtLogin=true with --hidden args when both toggles are on (win32)', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: ['--hidden'],
      });
    });

    it('passes empty args when StartAtBoot is on but StartMinimized is off', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: [],
      });
    });

    it('passes --hidden args when StartMinimized is on but StartAtBoot is off', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: true });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: false,
        args: ['--hidden'],
      });
    });
  });

  describe('initialize - openAsHidden is darwin-only', () => {
    it('sets openAsHidden=true only on darwin when both toggles are on', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
      });
    });

    it('keeps openAsHidden=false on darwin when StartMinimized is off', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: [],
      });
    });

    it('keeps openAsHidden=false on win32 even when both toggles are on', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });

      service.initialize();

      const call = mockApp.setLoginItemSettings.mock.calls[0][0] as {
        openAsHidden: boolean;
      };
      expect(call.openAsHidden).toBe(false);
    });
  });

  describe('initialize - per-key config re-apply', () => {
    it('subscribes to config:StartAtBoot and config:StartMinimized events', () => {
      service.initialize();

      const subscribedChannels = mockConfigManager.on.mock.calls.map((call) => call[0]);
      expect(subscribedChannels).toContain('config:StartAtBoot');
      expect(subscribedChannels).toContain('config:StartMinimized');
    });

    it('re-applies login item settings when config:StartAtBoot toggles to true', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: true });
      service.initialize();
      mockApp.setLoginItemSettings.mockClear();

      // Locate the StartAtBoot listener and invoke it with the new value.
      const startAtBootCall = mockConfigManager.on.mock.calls.find(
        (call) => call[0] === 'config:StartAtBoot'
      );
      const listener = startAtBootCall?.[1] as (value: boolean) => void;
      listener(true);

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledTimes(1);
      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: ['--hidden'],
      });
    });

    it('re-applies login item settings when config:StartMinimized toggles to false', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });
      service.initialize();
      mockApp.setLoginItemSettings.mockClear();

      const startMinimizedCall = mockConfigManager.on.mock.calls.find(
        (call) => call[0] === 'config:StartMinimized'
      );
      const listener = startMinimizedCall?.[1] as (value: boolean) => void;
      listener(false);

      expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: [],
      });
    });
  });

  describe('initialize - idempotency', () => {
    it('does not re-subscribe or re-register when initialize() is called twice', () => {
      service.initialize();
      const onCallsAfterFirst = mockConfigManager.on.mock.calls.length;
      const setCallsAfterFirst = mockApp.setLoginItemSettings.mock.calls.length;

      service.initialize();

      expect(mockConfigManager.on.mock.calls.length).toBe(onCallsAfterFirst);
      expect(mockApp.setLoginItemSettings.mock.calls.length).toBe(setCallsAfterFirst);
    });
  });

  describe('initialize - development mode', () => {
    it('skips the OS login-item registration call when not packaged', () => {
      mockEnvironmentService.isPackaged.mockReturnValue(false);
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });

      service.initialize();

      expect(mockApp.setLoginItemSettings).not.toHaveBeenCalled();
    });

    it('still subscribes to config changes in development mode (toggle persists via ConfigManager)', () => {
      mockEnvironmentService.isPackaged.mockReturnValue(false);

      service.initialize();

      const subscribedChannels = mockConfigManager.on.mock.calls.map((call) => call[0]);
      expect(subscribedChannels).toContain('config:StartAtBoot');
      expect(subscribedChannels).toContain('config:StartMinimized');
    });
  });

  describe('wasLaunchedHidden', () => {
    it('returns true when process.argv contains --hidden', () => {
      Object.defineProperty(process, 'argv', {
        value: ['electron', '--hidden'],
        configurable: true,
      });

      expect(service.wasLaunchedHidden()).toBe(true);
    });

    it('returns false when process.argv lacks --hidden and no launch items match', () => {
      mockApp.getLoginItemSettings.mockReturnValue({ launchItems: [] });
      Object.defineProperty(process, 'argv', { value: ['electron'], configurable: true });

      expect(service.wasLaunchedHidden()).toBe(false);
    });

    it('returns true when an OS launch item carries --hidden args', () => {
      mockApp.getLoginItemSettings.mockReturnValue({
        launchItems: [{ name: 'FlashForgeUI', path: 'C:\\app\\FlashForgeUI.exe', args: ['--hidden'] }],
      });
      Object.defineProperty(process, 'argv', { value: ['electron'], configurable: true });

      expect(service.wasLaunchedHidden()).toBe(true);
    });

    it('returns false when launch item args do not include --hidden', () => {
      mockApp.getLoginItemSettings.mockReturnValue({
        launchItems: [{ name: 'FlashForgeUI', path: '/app/FlashForgeUI', args: ['--other'] }],
      });
      Object.defineProperty(process, 'argv', { value: ['electron'], configurable: true });

      expect(service.wasLaunchedHidden()).toBe(false);
    });
  });
});
