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
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfigManager } from '../../managers/ConfigManager.js';
import { getSpoolmanIntegrationService } from '../../services/SpoolmanIntegrationService.js';
import { SpoolmanService } from '../../services/SpoolmanService.js';
import type { SpoolSearchQuery, ActiveSpoolData } from '../../types/spoolman.js';
import { createModalWindow, loadWindowHTML, setupDevTools, setupWindowLifecycle, validateParentWindow } from '../../windows/shared/WindowConfig.js';
import { createPreloadPath, createWindowWidth, createWindowHeight, createWindowMinWidth, createWindowMinHeight } from '../../windows/shared/WindowTypes.js';
import type { WindowDimensions } from '../../windows/shared/WindowTypes.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getSpoolmanHealthMonitor } from '../../services/SpoolmanHealthMonitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let spoolmanDialogWindow: BrowserWindow | null = null;

// Spoolman dialog window size
const SPOOLMAN_DIALOG_SIZE: WindowDimensions = {
  width: createWindowWidth(700),
  height: createWindowHeight(800),
  minWidth: createWindowMinWidth(600),
  minHeight: createWindowMinHeight(700),
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
      createPreloadPath(path.join(__dirname, '../../ui/spoolman-dialog/spoolman-dialog-preload.cjs')),
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

  // Select spool - save to context and broadcast
  ipcMain.handle('spoolman:select-spool', async (_event, spool: ActiveSpoolData, contextId?: string) => {
    const service = getSpoolmanIntegrationService();

    // Save to context (persisted via ConfigManager)
    await service.setActiveSpool(contextId, spool);

    // Broadcast selection to all renderer windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('spoolman:spool-selected', spool);
    });
  });

  // Get active spool for a context
  ipcMain.handle('spoolman:get-active-spool', async (_event, contextId?: string) => {
    const service = getSpoolmanIntegrationService();
    return service.getActiveSpool(contextId);
  });

  // Set active spool (used by component or external calls)
  ipcMain.handle('spoolman:set-active-spool', async (_event, spool: ActiveSpoolData | null, contextId?: string) => {
    const service = getSpoolmanIntegrationService();

    if (spool) {
      await service.setActiveSpool(contextId, spool);
    } else {
      await service.clearActiveSpool(contextId);
    }

    // Broadcast update to all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('spoolman:spool-updated', spool);
    });
  });

  // Test connection to Spoolman server
  ipcMain.handle('spoolman:test-connection', async (_event, serverUrl: string) => {
    try {
      const service = new SpoolmanService(serverUrl);
      return await service.testConnection();
    } catch (error) {
      console.error('[SpoolmanHandlers] Test connection error:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('spoolman:get-status', async (_event, contextId?: string) => {
    const service = getSpoolmanIntegrationService();
    const contextManager = getPrinterContextManager();
    const targetContextId = contextId || contextManager.getActiveContextId();

    if (!service.isGloballyEnabled()) {
      return {
        enabled: false,
        contextId: targetContextId,
        disabledReason: 'Spoolman integration is disabled. Enable it in Settings.'
      };
    }

    if (!targetContextId) {
      return {
        enabled: false,
        contextId: null,
        disabledReason: 'Connect a printer to use Spoolman.'
      };
    }

    if (!service.isContextSupported(targetContextId)) {
      return {
        enabled: false,
        contextId: targetContextId,
        disabledReason: service.getDisabledReason(targetContextId)
      };
    }

    return {
      enabled: true,
      contextId: targetContextId,
      disabledReason: null
    };
  });

  ipcMain.handle('spoolman:retry-connection', async () => {
    const monitor = getSpoolmanHealthMonitor();
    return await monitor.manualRetry();
  });
}
