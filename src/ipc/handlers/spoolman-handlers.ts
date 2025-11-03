/**
 * @fileoverview Spoolman IPC handlers for dialog and API operations
 *
 * Provides IPC communication layer between renderer processes and Spoolman service.
 * Handles dialog window management, spool search operations, spool selection broadcasting,
 * and connection with the SpoolmanService for REST API calls.
 *
 * Key Features:
 * - Open spool selection dialog with singleton behavior
 * - Search spools via SpoolmanService REST API
 * - Broadcast spool selection to all renderer windows
 * - Validate Spoolman configuration before operations
 *
 * IPC Channels:
 * - `spoolman:open-dialog` - Open spool selection dialog
 * - `spoolman:search-spools` - Search for spools matching query
 * - `spoolman:select-spool` - Broadcast selected spool to renderers
 *
 * @module ipc/handlers/spoolman-handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { getConfigManager } from '../../managers/ConfigManager';
import { SpoolmanService } from '../../services/SpoolmanService';
import type { SpoolSearchQuery, ActiveSpoolData } from '../../types/spoolman';
import { createModalWindow, loadWindowHTML, setupDevTools, setupWindowLifecycle, createPreloadPath, validateParentWindow } from '../../windows/shared/WindowConfig';

let spoolmanDialogWindow: BrowserWindow | null = null;

// Spoolman dialog window size
const SPOOLMAN_DIALOG_SIZE = {
  width: 700,
  height: 800,
  minWidth: 600,
  minHeight: 700,
};

/**
 * Register Spoolman IPC handlers
 */
export function registerSpoolmanHandlers(): void {
  // Open spool selection dialog
  ipcMain.handle('spoolman:open-dialog', async (event) => {
    // Focus existing dialog if already open
    if (spoolmanDialogWindow && !spoolmanDialogWindow.isDestroyed()) {
      spoolmanDialogWindow.focus();
      return;
    }

    const parentWindow = BrowserWindow.fromWebContents(event.sender);

    if (!validateParentWindow(parentWindow, 'spoolman dialog')) {
      return;
    }

    // Create dialog window
    spoolmanDialogWindow = createModalWindow(
      parentWindow,
      SPOOLMAN_DIALOG_SIZE,
      createPreloadPath(path.join(__dirname, '../../ui/spoolman-dialog/spoolman-dialog-preload.js')),
      { resizable: false, frame: false }
    );

    // Load HTML and setup lifecycle
    void loadWindowHTML(spoolmanDialogWindow, 'spoolman-dialog');

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      spoolmanDialogWindow,
      () => {
        spoolmanDialogWindow = null;
      }
    );

    setupDevTools(spoolmanDialogWindow);
  });

  // Search spools
  ipcMain.handle('spoolman:search-spools', async (_event, query: SpoolSearchQuery) => {
    const config = getConfigManager().getConfig();

    if (!config.SpoolmanEnabled) {
      throw new Error('Spoolman integration is disabled');
    }

    if (!config.SpoolmanServerUrl) {
      throw new Error('Spoolman server URL not configured');
    }

    const service = new SpoolmanService(config.SpoolmanServerUrl);
    return await service.searchSpools(query);
  });

  // Select spool
  ipcMain.handle('spoolman:select-spool', async (_event, spool: ActiveSpoolData) => {
    // Broadcast selection to all renderer windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('spoolman:spool-selected', spool);
    });
  });
}
