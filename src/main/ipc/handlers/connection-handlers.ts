/**
 * @fileoverview Connection-related IPC handlers for printer discovery and connection management.
 *
 * Provides IPC handlers for managing printer connections in multi-context environment:
 * - Network discovery initiation and flow management
 * - Manual IP address connection support
 * - Printer selection dialog control (open/cancel)
 * - Integration with ConnectionFlowManager for connection orchestration
 *
 * Key exports:
 * - registerConnectionHandlers(): Registers all connection-related IPC handlers
 *
 * Note: Direct printer selection handlers have been removed to prevent duplicate connections.
 * Connection is now handled exclusively through DialogIntegrationService to ensure proper
 * context creation and resource management in the multi-printer architecture.
 */

import { ipcMain } from 'electron';
import type { ConnectionFlowManager } from '../../managers/ConnectionFlowManager.js';
import type { getWindowManager } from '../../windows/WindowManager.js';

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

