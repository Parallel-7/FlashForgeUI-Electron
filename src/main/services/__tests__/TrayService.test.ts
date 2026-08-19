/**
 * @fileoverview Unit tests for TrayService
 *
 * Focuses on the minimize-to-tray guard added for issue #75: hiding the window is only safe when a
 * tray icon actually exists, so `hideToTray()` must downgrade to a plain minimize whenever tray
 * creation failed (stock GNOME has no StatusNotifierItem host). Also covers tray lifecycle
 * (create/destroy, empty-icon and throwing-constructor paths), window surfacing, and the one-shot
 * "still running in the tray" hint.
 */

// Mutable Electron mocks so individual tests can configure return values.
const mockApp = {
  getName: jest.fn(() => 'FlashForgeUI'),
  getAppPath: jest.fn(() => '/app'),
  quit: jest.fn(),
};

const mockTrayInstance = {
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
};

const mockTrayConstructor = jest.fn(() => mockTrayInstance);

const mockImage = {
  isEmpty: jest.fn(() => false),
  resize: jest.fn((): unknown => mockImage),
};

const mockNativeImage = {
  createFromPath: jest.fn(() => mockImage),
};

const mockNotificationShow = jest.fn();
const mockNotificationConstructor = jest.fn(() => ({ show: mockNotificationShow }));
const mockNotificationIsSupported = jest.fn(() => true);

jest.mock('electron', () => ({
  app: mockApp,
  Menu: { buildFromTemplate: jest.fn((template: unknown) => template) },
  nativeImage: mockNativeImage,
  Tray: mockTrayConstructor,
  Notification: Object.assign(mockNotificationConstructor, {
    isSupported: mockNotificationIsSupported,
  }),
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Main window mock resolved lazily through WindowManager, mirroring the real service.
const mockMainWindow = {
  hide: jest.fn(),
  show: jest.fn(),
  focus: jest.fn(),
  minimize: jest.fn(),
  restore: jest.fn(),
  isMinimized: jest.fn(() => false),
};

const mockWindowManager = {
  getMainWindow: jest.fn((): unknown => mockMainWindow),
};

jest.mock('../../windows/WindowManager.js', () => ({
  getWindowManager: jest.fn(() => mockWindowManager),
}));

import { getTrayService, TrayService } from '../TrayService.js';

describe('TrayService', () => {
  let service: TrayService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton between tests so initialize() can run fresh each time.
    (TrayService as unknown as { instance: TrayService | null }).instance = null;

    // Restore default mock return values.
    mockImage.isEmpty.mockReturnValue(false);
    mockImage.resize.mockReturnValue(mockImage);
    mockNativeImage.createFromPath.mockReturnValue(mockImage);
    mockTrayConstructor.mockReturnValue(mockTrayInstance);
    mockWindowManager.getMainWindow.mockReturnValue(mockMainWindow);
    mockMainWindow.isMinimized.mockReturnValue(false);
    mockNotificationIsSupported.mockReturnValue(true);

    service = getTrayService();
  });

  describe('Singleton Pattern', () => {
    it('returns the same instance when called multiple times', () => {
      expect(getTrayService()).toBe(getTrayService());
    });
  });

  describe('initialize', () => {
    it('creates the tray and reports availability', () => {
      expect(service.isAvailable()).toBe(false);

      service.initialize();

      expect(mockTrayConstructor).toHaveBeenCalledTimes(1);
      expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith('FlashForgeUI');
      expect(service.isAvailable()).toBe(true);
    });

    it('is idempotent - a second call does not create another tray', () => {
      service.initialize();
      service.initialize();

      expect(mockTrayConstructor).toHaveBeenCalledTimes(1);
    });

    it('skips tray creation when the icon image is empty', () => {
      mockImage.isEmpty.mockReturnValue(true);

      service.initialize();

      expect(mockTrayConstructor).not.toHaveBeenCalled();
      expect(service.isAvailable()).toBe(false);
    });

    it('treats a throwing Tray constructor as non-fatal', () => {
      mockTrayConstructor.mockImplementation(() => {
        throw new Error('no StatusNotifierItem host');
      });

      expect(() => service.initialize()).not.toThrow();
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('hideToTray - tray availability guard', () => {
    it('hides the window when a tray icon exists', () => {
      service.initialize();

      service.hideToTray();

      expect(mockMainWindow.hide).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.minimize).not.toHaveBeenCalled();
    });

    it('minimizes instead of hiding when tray creation failed', () => {
      // The critical guard: hiding with no tray icon would leave the window unreachable.
      mockImage.isEmpty.mockReturnValue(true);
      service.initialize();

      service.hideToTray();

      expect(mockMainWindow.hide).not.toHaveBeenCalled();
      expect(mockMainWindow.minimize).toHaveBeenCalledTimes(1);
    });

    it('minimizes instead of hiding when initialize was never called', () => {
      service.hideToTray();

      expect(mockMainWindow.hide).not.toHaveBeenCalled();
      expect(mockMainWindow.minimize).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no main window', () => {
      mockWindowManager.getMainWindow.mockReturnValue(null);
      service.initialize();

      expect(() => service.hideToTray()).not.toThrow();
      expect(mockMainWindow.hide).not.toHaveBeenCalled();
      expect(mockMainWindow.minimize).not.toHaveBeenCalled();
    });
  });

  describe('hideToTray - first-hide hint', () => {
    it('shows the hint only once per session', () => {
      service.initialize();

      service.hideToTray();
      service.hideToTray();
      service.hideToTray();

      expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
      expect(mockNotificationShow).toHaveBeenCalledTimes(1);
    });

    it('skips the hint when notifications are unsupported', () => {
      mockNotificationIsSupported.mockReturnValue(false);
      service.initialize();

      service.hideToTray();

      expect(mockNotificationConstructor).not.toHaveBeenCalled();
      expect(mockMainWindow.hide).toHaveBeenCalledTimes(1);
    });

    it('still hides the window when the hint throws', () => {
      mockNotificationConstructor.mockImplementation(() => {
        throw new Error('notification backend unavailable');
      });
      service.initialize();

      expect(() => service.hideToTray()).not.toThrow();
      expect(mockMainWindow.hide).toHaveBeenCalledTimes(1);
    });

    it('does not show the hint on the minimize fallback path', () => {
      mockImage.isEmpty.mockReturnValue(true);
      service.initialize();

      service.hideToTray();

      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });
  });

  describe('surfaceMainWindow', () => {
    it('shows and focuses the window', () => {
      service.surfaceMainWindow();

      expect(mockMainWindow.show).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.focus).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.restore).not.toHaveBeenCalled();
    });

    it('restores first when the window is minimized', () => {
      mockMainWindow.isMinimized.mockReturnValue(true);

      service.surfaceMainWindow();

      expect(mockMainWindow.restore).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.show).toHaveBeenCalledTimes(1);
    });

    it('does nothing when there is no main window', () => {
      mockWindowManager.getMainWindow.mockReturnValue(null);

      expect(() => service.surfaceMainWindow()).not.toThrow();
      expect(mockMainWindow.show).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('destroys the tray and clears availability', () => {
      service.initialize();

      service.destroy();

      expect(mockTrayInstance.destroy).toHaveBeenCalledTimes(1);
      expect(service.isAvailable()).toBe(false);
    });

    it('is safe to call when no tray was created', () => {
      expect(() => service.destroy()).not.toThrow();
      expect(mockTrayInstance.destroy).not.toHaveBeenCalled();
    });

    it('re-arms the hint so a later tray session teaches again', () => {
      service.initialize();
      service.hideToTray();
      expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);

      service.destroy();
      service.initialize();
      service.hideToTray();

      expect(mockNotificationConstructor).toHaveBeenCalledTimes(2);
    });
  });
});
