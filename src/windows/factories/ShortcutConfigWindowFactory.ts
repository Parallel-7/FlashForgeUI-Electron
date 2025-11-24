/**
 * @fileoverview Factory for creating shortcut configuration dialog window
 *
 * Creates modal dialog windows for managing topbar shortcut button configuration.
 * Users can assign up to 3 components to quick-access shortcut slots. The dialog
 * provides dropdowns for slot assignment and displays current configuration status.
 *
 * Dialog specifications:
 * - Size: 540x680 (min 500x620)
 * - Modal: true (blocks main window)
 * - Frameless: true
 * - Transparent: true
 * - Resizable: false
 *
 * Communication pattern:
 * - Uses unique dialog ID and response channel for each instance
 * - Promise-based result handling
 * - Sends updated configuration to main window on save
 * - Proper cleanup of IPC handlers on close
 *
 * @author FlashForgeUI Team
 * @module windows/factories/ShortcutConfigWindowFactory
 */

import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWindowManager } from '../WindowManager.js';
import {
  createPreloadPath,
  createWindowWidth,
  createWindowHeight,
  createWindowMinWidth,
  createWindowMinHeight,
} from '../shared/WindowTypes.js';
import {
  createModalWindow,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
  generateDialogId,
  createResponseChannelName,
  loadWindowHTML,
} from '../shared/WindowConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Window data storage type
 */
interface WindowDataStorage {
  readonly resolve: (result: void) => void;
}

/**
 * Shortcut config dialog window extension
 */
interface ShortcutConfigDialogWindow extends BrowserWindow {
  windowData?: WindowDataStorage;
}

/**
 * Create shortcut configuration dialog window
 *
 * Opens a modal dialog for managing shortcut button configuration.
 * The dialog allows users to assign components to up to 3 shortcut slots.
 *
 * @returns Promise that resolves when dialog is closed
 *
 * @example
 * ```typescript
 * import { createShortcutConfigDialog } from './ShortcutConfigWindowFactory';
 *
 * // Open dialog
 * await createShortcutConfigDialog();
 * ```
 */
export const createShortcutConfigDialog = (): Promise<void> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (!validateParentWindow(mainWindow, 'shortcut config dialog')) {
      resolve();
      return;
    }

    // Generate unique dialog ID and response channel
    const dialogId = generateDialogId();
    const responseChannel = createResponseChannelName(dialogId);
    let handlerActive = true;

    // Create the dialog window
    const configDialogWindow: ShortcutConfigDialogWindow = createModalWindow(
      mainWindow,
      {
        width: createWindowWidth(540),
        height: createWindowHeight(680),
        minWidth: createWindowMinWidth(500),
        minHeight: createWindowMinHeight(620),
      },
      createPreloadPath(
        path.join(
          __dirname,
          '../../ui/shortcut-config-dialog/shortcut-config-dialog-preload.cjs'
        )
      ),
      { resizable: false, frame: false }
    );

    // Set up response handler
    const handleResponse = async (): Promise<void> => {
      if (!handlerActive) return;

      handlerActive = false;
      ipcMain.removeHandler(responseChannel);

      // Clear window manager reference
      windowManager.setShortcutConfigDialogWindow(null);

      // Close dialog window immediately
      if (configDialogWindow && !configDialogWindow.isDestroyed()) {
        configDialogWindow.destroy();
      }

      // Resolve promise
      resolve();
    };

    ipcMain.handle(responseChannel, handleResponse);

    // Load HTML
    void loadWindowHTML(configDialogWindow, 'shortcut-config-dialog');

    // Initialize dialog when ready
    configDialogWindow.webContents.on('did-finish-load', () => {
      if (configDialogWindow && !configDialogWindow.isDestroyed()) {
        configDialogWindow.webContents.send('dialog-init', {
          responseChannel,
        });
      }
    });

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(configDialogWindow, () => {
      windowManager.setShortcutConfigDialogWindow(null);
      // If handler is still active, resolve (cancelled)
      if (handlerActive) {
        handlerActive = false;
        ipcMain.removeHandler(responseChannel);
        resolve();
      }
    });

    setupDevTools(configDialogWindow);
    windowManager.setShortcutConfigDialogWindow(configDialogWindow);
  });
};
