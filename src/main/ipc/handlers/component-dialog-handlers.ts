/**
 * @fileoverview IPC handlers for component dialog windows
 *
 * Provides IPC communication handlers for opening component dialogs and
 * retrieving component metadata for rendering.
 *
 * Handlers:
 * - component-dialog:open: Opens dialog for specified component
 * - component-dialog:get-polling-data: Returns current polling data for active context
 *
 * @author FlashForgeUI Team
 * @module ipc/handlers/component-dialog-handlers
 */

import { ipcMain } from 'electron';
import { createComponentDialog } from '../../windows/factories/ComponentDialogWindowFactory.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getMultiContextPollingCoordinator } from '../../services/MultiContextPollingCoordinator.js';

/**
 * Register all component dialog IPC handlers
 *
 * Must be called during app initialization to set up IPC communication
 * for component dialog windows.
 */
export function registerComponentDialogHandlers(): void {
  console.log('[IPC] Registering component dialog handlers');

  /**
   * Open component dialog for specified component ID
   */
  ipcMain.on('component-dialog:open', (_event, componentId: string) => {
    console.log(`[IPC] Opening component dialog for: ${componentId}`);

    try {
      createComponentDialog(componentId);
    } catch (error) {
      console.error('[IPC] Failed to create component dialog:', error);
    }
  });

  /**
   * Get current polling data for active context
   * Used by component dialogs to get initial data on open
   */
  ipcMain.handle('component-dialog:get-polling-data', () => {
    const contextManager = getPrinterContextManager();
    const activeContextId = contextManager.getActiveContextId();

    if (!activeContextId) {
      console.log('[IPC] No active context for polling data request');
      return null;
    }

    const pollingCoordinator = getMultiContextPollingCoordinator();
    const pollingData = pollingCoordinator.getPollingDataForContext(activeContextId);
    console.log(`[IPC] Returning polling data for context: ${activeContextId}`);
    return pollingData;
  });

  console.log('[IPC] Component dialog handlers registered');
}
