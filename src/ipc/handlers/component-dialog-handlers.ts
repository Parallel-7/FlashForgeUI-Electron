/**
 * @fileoverview IPC handlers for component dialog windows
 *
 * Provides IPC communication handlers for opening component dialogs and
 * retrieving component metadata for rendering.
 *
 * Handlers:
 * - component-dialog:open: Opens dialog for specified component
 * - component-dialog:get-info: Returns component metadata (forwarded to main window)
 *
 * @author FlashForgeUI Team
 * @module ipc/handlers/component-dialog-handlers
 */

import { ipcMain } from 'electron';
import { createComponentDialog } from '../../windows/factories/ComponentDialogWindowFactory';

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

  console.log('[IPC] Component dialog handlers registered');
}
