/**
 * @fileoverview Unit tests for AutoLaunchService
 *
 * Validates OS login-item registration for the "Start with system" / "Start minimized"
 * preferences (issue #75): correct app.setLoginItemSettings arguments on toggle, openAsHidden
 * only applying on darwin, the Linux freedesktop `.desktop` autostart path (write/remove,
 * APPIMAGE vs execPath vs the wrapped `.bin` launcher, XDG_CONFIG_HOME, --hidden, TryExec/Icon,
 * `%%` escaping), deferral of the initial apply until the config has loaded, wasLaunchedHidden()
 * detection across platforms, and that unpackaged (development) builds skip OS registration while
 * honoring toggles.
 *
 * @module services/__tests__/AutoLaunchService.test
 */

// Mutable Electron app mock so individual tests can configure return values.
const mockApp = {
  setLoginItemSettings: jest.fn(),
  getLoginItemSettings: jest.fn(() => ({ launchItems: [] })),
  getName: jest.fn(() => 'FlashForgeUI'),
};

jest.mock('electron', () => ({
  app: mockApp,
}));

// Filesystem mock for the Linux autostart path (node:fs). existsSync backs the launcher-vs-.bin
// resolution and defaults to false so tests opt in explicitly.
const mockFs = {
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  rmSync: jest.fn(),
  existsSync: jest.fn(() => false),
};

jest.mock('node:fs', () => mockFs);

// Home directory mock so Linux autostart paths are deterministic.
jest.mock('node:os', () => ({
  homedir: jest.fn(() => '/home/testuser'),
}));

// Mutable ConfigManager mock used by the service constructor + listeners.
const mockConfigManager = {
  getConfig: jest.fn(() => ({ StartAtBoot: false, StartMinimized: false })),
  isConfigLoaded: jest.fn(() => true),
  on: jest.fn(),
  once: jest.fn(),
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
  const originalExecPath = process.execPath;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton between tests so initialize() can run fresh each time.
    (AutoLaunchService as unknown as { instance: AutoLaunchService | null }).instance = null;

    // Restore default platform to win32 (override per-test as needed).
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // Restore default mock return values.
    mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: false });
    mockConfigManager.isConfigLoaded.mockReturnValue(true);
    mockEnvironmentService.isPackaged.mockReturnValue(true);
    mockFs.existsSync.mockReturnValue(false);
    mockApp.getLoginItemSettings.mockReturnValue({ launchItems: [] });
    Object.defineProperty(process, 'argv', { value: ['electron'], configurable: true });

    // Clear Linux autostart env vars so each test controls them explicitly.
    delete process.env.APPIMAGE;
    delete process.env.XDG_CONFIG_HOME;

    service = getAutoLaunchService();
  });

  afterEach(() => {
    delete process.env.APPIMAGE;
    delete process.env.XDG_CONFIG_HOME;
    Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
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

  describe('initialize - Linux freedesktop autostart', () => {
    const AUTOSTART_FILE = '/home/testuser/.config/autostart/flashforgeui.desktop';

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    });

    it('does not call setLoginItemSettings on Linux', () => {
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      expect(mockApp.setLoginItemSettings).not.toHaveBeenCalled();
    });

    it('writes a .desktop entry to ~/.config/autostart using the APPIMAGE path', () => {
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/testuser/.config/autostart', {
        recursive: true,
      });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      const [writtenPath, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(writtenPath).toBe(AUTOSTART_FILE);
      expect(contents).toContain('[Desktop Entry]');
      expect(contents).toContain('Type=Application');
      expect(contents).toContain('Exec="/home/testuser/Apps/FlashForgeUI.AppImage"');
      expect(contents).not.toContain('--hidden');
    });

    it('appends --hidden to the Exec line when StartMinimized is on', () => {
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/home/testuser/Apps/FlashForgeUI.AppImage" --hidden');
    });

    it('honors XDG_CONFIG_HOME for the autostart directory', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [writtenPath] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(writtenPath).toBe('/custom/config/autostart/flashforgeui.desktop');
    });

    it('falls back to process.execPath when APPIMAGE is not set (.deb/.rpm)', () => {
      // A .deb/.rpm install exposes a stable POSIX binary path; emulate it explicitly so the
      // assertion holds regardless of the OS running the test suite.
      Object.defineProperty(process, 'execPath', {
        value: '/opt/FlashForgeUI/flashforgeui',
        configurable: true,
      });
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/opt/FlashForgeUI/flashforgeui"');
    });

    it('removes the .desktop entry when StartAtBoot is off', () => {
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: false });

      service.initialize();

      expect(mockFs.rmSync).toHaveBeenCalledWith(AUTOSTART_FILE, { force: true });
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('writes TryExec and Icon so stale entries are skipped and KDE renders the row', () => {
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      // TryExec is a plain path, not a quoted Exec-style command line.
      expect(contents).toContain('TryExec=/home/testuser/Apps/FlashForgeUI.AppImage');
      expect(contents).toContain('Icon=FlashForgeUI');
    });

    it('escapes literal percent signs in the Exec path as %%', () => {
      // A literal % is a field code to the Exec parser, so it must be doubled.
      process.env.APPIMAGE = '/home/testuser/100% Apps/FlashForgeUI.AppImage';
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/home/testuser/100%% Apps/FlashForgeUI.AppImage"');
    });

    it('targets the launcher script rather than the wrapped .bin binary on deb/rpm', () => {
      // The Linux build moves the real Electron binary to <name>.bin behind a launcher script;
      // autostart should invoke the launcher, which is the supported entry point.
      Object.defineProperty(process, 'execPath', {
        value: '/opt/FlashForgeUI/FlashForgeUI.bin',
        configurable: true,
      });
      mockFs.existsSync.mockImplementation((p: unknown) => p === '/opt/FlashForgeUI/FlashForgeUI');
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/opt/FlashForgeUI/FlashForgeUI"');
      expect(contents).toContain('TryExec=/opt/FlashForgeUI/FlashForgeUI');
    });

    it('keeps the .bin path when no sibling launcher exists', () => {
      Object.defineProperty(process, 'execPath', {
        value: '/opt/FlashForgeUI/FlashForgeUI.bin',
        configurable: true,
      });
      mockFs.existsSync.mockReturnValue(false);
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/opt/FlashForgeUI/FlashForgeUI.bin"');
    });

    it('defers the initial apply until the config is loaded', () => {
      // Applying default StartAtBoot=false eagerly would delete a valid autostart entry before
      // the saved config arrives.
      mockConfigManager.isConfigLoaded.mockReturnValue(false);
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: false, StartMinimized: false });
      process.env.APPIMAGE = '/home/testuser/Apps/FlashForgeUI.AppImage';

      service.initialize();

      expect(mockFs.rmSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();

      // Once the load settles, the saved values are applied.
      const configLoadedCall = mockConfigManager.once.mock.calls.find(
        ([event]) => event === 'config-loaded'
      );
      expect(configLoadedCall).toBeDefined();
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: true });
      (configLoadedCall as unknown as [string, () => void])[1]();

      const [, contents] = mockFs.writeFileSync.mock.calls[0] as [string, string];
      expect(contents).toContain('Exec="/home/testuser/Apps/FlashForgeUI.AppImage" --hidden');
    });

    it('skips filesystem writes in development (unpackaged) mode', () => {
      mockEnvironmentService.isPackaged.mockReturnValue(false);
      mockConfigManager.getConfig.mockReturnValue({ StartAtBoot: true, StartMinimized: false });

      service.initialize();

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockFs.rmSync).not.toHaveBeenCalled();
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
