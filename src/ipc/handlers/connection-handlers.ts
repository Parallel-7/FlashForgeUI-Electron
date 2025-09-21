/**
 * Connection-related IPC handlers for printer discovery and connection management.
 * Handles all printer connection operations including discovery, selection, and saved printer connections.
 */

import { ipcMain, dialog } from 'electron';
import type { ConnectionFlowManager } from '../../managers/ConnectionFlowManager';
import type { getWindowManager } from '../../windows/WindowManager';

type WindowManager = ReturnType<typeof getWindowManager>;
import type { DiscoveredPrinter } from '../../types/printer';
import { getPrinterDetailsManager } from '../../managers/PrinterDetailsManager';

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

  // Note: 'printer-selection:select' handler removed - connection is now handled
  // exclusively through ConnectionFlowManager to prevent duplicate dialogs

  // Handle saved printer selection
  ipcMain.on('printer-selection:select-saved', async (_, savedPrinter: unknown) => {
    console.log('Saved printer selected from dialog:', savedPrinter);
    
    try {
      // Validate saved printer data
      if (!savedPrinter || typeof savedPrinter !== 'object') {
        throw new Error('Invalid saved printer data');
      }
      
      const printerData = savedPrinter as { serialNumber?: string; ipAddress?: string };
      if (!printerData.serialNumber) {
        throw new Error('No serial number in saved printer data');
      }
      
      // Get the full saved printer details
      const printerDetailsManager = getPrinterDetailsManager();
      const savedDetails = printerDetailsManager.getSavedPrinter(printerData.serialNumber);
      
      if (!savedDetails) {
        throw new Error('Saved printer not found');
      }
      
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      const mainWindow = windowManager.getMainWindow();
      
      // Show connecting message
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        printerSelectionWindow.webContents.send('printer-selection:connecting', savedDetails.Name);
      }
      
      // Use the IP from the discovered printer if it changed
      const connectDetails = {
        ...savedDetails,
        IPAddress: printerData.ipAddress || savedDetails.IPAddress
      };
      
      // Connect using saved details (which includes the saved check code)
      const result = await connectionManager.connectWithSavedDetails(connectDetails);
      
      if (result.success) {
        // Connection successful - close dialog and notify main window
        if (printerSelectionWindow) {
          printerSelectionWindow.close();
        }
        
        mainWindow?.webContents.send('printer-connected', {
          name: result.printerDetails?.Name,
          ipAddress: result.printerDetails?.IPAddress,
          serialNumber: result.printerDetails?.SerialNumber,
          clientType: result.printerDetails?.ClientType
        });
        
        console.log('Successfully connected to saved printer:', result.printerDetails?.Name);
      } else {
        // Connection failed - show error and keep dialog open
        console.error('Connection failed:', result.error);
        
        if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
          printerSelectionWindow.webContents.send('printer-selection:connection-failed', result.error);
        }
        
        // Only show standard error dialog for actual connection errors, not user cancellations
        if (result.error && !result.error.includes('cancelled by user') && !result.error.includes('Connection cancelled')) {
          await dialog.showMessageBox({
            type: 'error',
            title: 'Connection Failed',
            message: `Failed to connect to ${savedDetails.Name}`,
            detail: result.error || 'Unknown error occurred',
            buttons: ['OK']
          });
        }
      }
    } catch (error) {
      console.error('Saved printer selection error:', error);
      
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        printerSelectionWindow.webContents.send('printer-selection:connection-failed', 
          error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Only show standard error dialog for actual connection errors, not user cancellations
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (!errorMessage.includes('cancelled by user') && !errorMessage.includes('Connection cancelled')) {
        await dialog.showMessageBox({
          type: 'error',
          title: 'Connection Error',
          message: 'Error connecting to saved printer',
          detail: errorMessage,
          buttons: ['OK']
        });
      }
    }
  });

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
