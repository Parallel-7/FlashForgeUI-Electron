/**
 * Connection-related IPC handlers for printer discovery and connection management.
 * Handles all printer connection operations including discovery, selection, and saved printer connections.
 */

import { ipcMain } from 'electron';
import type { ConnectionFlowManager } from '../../managers/ConnectionFlowManager';
import type { getWindowManager } from '../../windows/WindowManager';

type WindowManager = ReturnType<typeof getWindowManager>;

/**
 * Register all connection-related IPC handlers
 */
export function registerConnectionHandlers(
  connectionManager: ConnectionFlowManager,
  windowManager: WindowManager
): void {
  // Start discovery handler
  ipcMain.handle('printer-selection:start-discovery', async () => {
    try {
      const result = await connectionManager.startConnectionFlow({ checkForActiveConnection: false });
      return { success: result.success, error: result.error };
    } catch (error) {
      console.error('Discovery error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Discovery failed' };
    }
  });

  // Note: 'printer-selection:select' and 'printer-selection:select-saved' handlers removed
  // Connection is now handled exclusively through DialogIntegrationService to prevent duplicate connections

  // Cancel selection handler
  ipcMain.on('printer-selection:cancel', () => {
    const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
    if (printerSelectionWindow) {
      printerSelectionWindow.close();
    }
  });

  // Manual IP connection handler
  ipcMain.handle('printer-connection:connect-to-ip', async (_, ipAddress: string) => {
    try {
      console.log('Manual IP connection requested:', ipAddress);
      const result = await connectionManager.connectDirectlyToIP(ipAddress);
      return { success: result.success, error: result.error };
    } catch (error) {
      console.error('Manual IP connection error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Manual connection failed' };
    }
  });
}
