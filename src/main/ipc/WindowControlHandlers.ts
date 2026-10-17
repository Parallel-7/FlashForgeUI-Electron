/**
 * @fileoverview Window control IPC handlers for main window frame operations.
 *
 * Provides IPC handlers for custom title bar window controls:
 * - Window minimize operation (honors the MinimizeToTray setting)
 * - Window maximize/restore toggle operation
 * - Window close operation (triggers app quit)
 *
 * Key exports:
 * - setupWindowControlHandlers(): Registers all window control IPC handlers
 *
 * These handlers enable the custom frameless window title bar to control the main window,
 * replacing the native OS window controls. The close handler directly quits the application
 * to ensure proper process cleanup when using a custom title bar.
 */

import { app, ipcMain } from 'electron';
import { getConfigManager } from '../managers/ConfigManager.js';
import { getTrayService } from '../services/TrayService.js';
import { getWindowManager } from '../windows/WindowManager.js';

/**
 * Setup window control IPC handlers for minimize, maximize, and close operations.
 * Uses WindowManager to access the main window for these operations.
 */
export const setupWindowControlHandlers = (): void => {
  const windowManager = getWindowManager();

  /**
   * Handle window minimize request.
   *
   * With MinimizeToTray enabled the window is hidden instead of iconified, which is what actually
   * clears the taskbar/dock entry (issue #75). TrayService downgrades this to a plain minimize when
   * no tray icon exists, so the window can never be hidden with no way back.
   */
  ipcMain.on('window-minimize', () => {
    if (getConfigManager().get('MinimizeToTray')) {
      getTrayService().hideToTray();
      return;
    }

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  /**
   * Handle window maximize/restore toggle request
   */
  ipcMain.on('window-maximize', () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  /**
   * Handle window close request
   * Directly quit the app instead of just closing the window
   * This ensures the process exits properly when using custom title bar
   */
  ipcMain.on('window-close', () => {
    app.quit();
  });
};
