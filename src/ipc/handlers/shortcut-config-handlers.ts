/**
 * @fileoverview IPC handlers for shortcut button configuration
 *
 * Provides IPC communication handlers for the shortcut configuration dialog,
 * including opening the dialog, loading/saving configuration, and getting
 * available components.
 *
 * Handlers:
 * - shortcut-config:open: Opens the configuration dialog
 * - shortcut-config:get-current: Returns current shortcut configuration
 * - shortcut-config:save: Saves new configuration and notifies main window
 * - shortcut-config:get-available-components: Returns component list with pinned status
 *
 * @author FlashForgeUI Team
 * @module ipc/handlers/shortcut-config-handlers
 */

import { ipcMain } from 'electron';
import { createShortcutConfigDialog } from '../../windows/factories/ShortcutConfigWindowFactory';
import { getWindowManager } from '../../windows/WindowManager';
import type { ShortcutButtonConfig } from '../../ui/shortcuts/types';

// Import these will be implemented in renderer context
// For now we'll handle them via IPC to renderer
/**
 * Register all shortcut configuration IPC handlers
 *
 * Must be called during app initialization to set up IPC communication
 * for shortcut configuration management.
 */
export function registerShortcutConfigHandlers(): void {
  console.log('[IPC] Registering shortcut config handlers');

  /**
   * Open shortcut configuration dialog
   */
  ipcMain.on('shortcut-config:open', () => {
    console.log('[IPC] Opening shortcut config dialog');
    void createShortcutConfigDialog();
  });

  /**
   * Get current shortcut configuration
   * Forwards request to main window renderer which has access to localStorage
   */
  ipcMain.handle('shortcut-config:get-current', async () => {
    const mainWindow = getWindowManager().getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.error('[IPC] Main window not available for config request');
      return null;
    }

    // Ask main window renderer for current config
    return new Promise((resolve) => {
      const responseChannel = `shortcut-config:get-current-response-${Date.now()}`;

      ipcMain.once(responseChannel, (_event, config: ShortcutButtonConfig) => {
        resolve(config);
      });

      mainWindow.webContents.send('shortcut-config:get-current-request', responseChannel);
    });
  });

  /**
   * Save shortcut configuration
   * Forwards to main window renderer to save in localStorage
   */
  ipcMain.handle(
    'shortcut-config:save',
    async (_event, config: ShortcutButtonConfig) => {
      console.log('[IPC] Saving shortcut configuration:', config);

      const mainWindow = getWindowManager().getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        console.error('[IPC] Main window not available for saving config');
        return { success: false, error: 'Main window not available' };
      }

      // Forward to main window renderer to save
      return new Promise((resolve) => {
        const responseChannel = `shortcut-config:save-response-${Date.now()}`;

        ipcMain.once(
          responseChannel,
          (_event, result: { success: boolean; error?: string }) => {
            if (result.success) {
              // Notify main window to update topbar
              mainWindow.webContents.send('shortcut-config:updated', config);
            }
            resolve(result);
          }
        );

        mainWindow.webContents.send('shortcut-config:save-request', {
          config,
          responseChannel,
        });
      });
    }
  );

  /**
   * Get available components with pinned status
   * Forwards to main window renderer which has component registry access
   */
  ipcMain.handle('shortcut-config:get-available-components', async () => {
    const mainWindow = getWindowManager().getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.error('[IPC] Main window not available for components request');
      return [];
    }

    // Ask main window renderer for component list
    return new Promise((resolve) => {
      const responseChannel = `shortcut-config:get-components-response-${Date.now()}`;

      ipcMain.once(responseChannel, (_event, components: unknown[]) => {
        resolve(components);
      });

      mainWindow.webContents.send(
        'shortcut-config:get-components-request',
        responseChannel
      );
    });
  });

  console.log('[IPC] Shortcut config handlers registered');
}
