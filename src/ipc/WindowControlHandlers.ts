// src/ipc/WindowControlHandlers.ts - Window control IPC handlers with WindowManager integration
import { ipcMain, app } from 'electron';
import { getWindowManager } from '../windows/WindowManager';

/**
 * Setup window control IPC handlers for minimize, maximize, and close operations.
 * Uses WindowManager to access the main window for these operations.
 */
export const setupWindowControlHandlers = (): void => {
  const windowManager = getWindowManager();

  /**
   * Handle window minimize request
   */
  ipcMain.on('window-minimize', () => {
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
