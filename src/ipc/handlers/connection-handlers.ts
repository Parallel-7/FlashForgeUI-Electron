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

  // Select discovered printer handler
  ipcMain.on('printer-selection:select', async (_, printer: unknown) => {
    console.log('Printer selected:', printer);
    
    try {
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      const mainWindow = windowManager.getMainWindow();
      
      // Show connecting message
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        const printerData = printer as { name?: string };
        printerSelectionWindow.webContents.send('printer-selection:connecting', printerData.name || 'Unknown Printer');
      }
      
      // Check if this is a saved printer with IP change info or a discovered printer
      const printerData = printer as {
        name?: string;
        ipAddress?: string;
        serialNumber?: string;
        model?: string;
        lastConnected?: string;
        isOnline?: boolean;
        ipAddressChanged?: boolean;
        currentIpAddress?: string;
      };
      
      // Convert to DiscoveredPrinter format, using current IP if changed
      const ipToUse = (printerData.ipAddressChanged && printerData.currentIpAddress)
        ? printerData.currentIpAddress
        : printerData.ipAddress || '';
      
      console.log(`Using IP address for connection: ${ipToUse}` + 
                  (printerData.ipAddressChanged ? ` (changed from ${printerData.ipAddress})` : ''));
      
      const discoveredPrinter: DiscoveredPrinter = {
        name: printerData.name || 'Unknown',
        ipAddress: ipToUse,
        serialNumber: printerData.serialNumber || '',
        model: printerData.model
      };
      
      // Attempt to connect to the selected printer
      const result = await connectionManager.connectToDiscoveredPrinter(discoveredPrinter);
      
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
        
        console.log('Successfully connected to printer:', result.printerDetails?.Name);
      } else {
        // Connection failed - show error and keep dialog open
        console.error('Connection failed:', result.error);
        
        if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
          printerSelectionWindow.webContents.send('printer-selection:connection-failed', result.error);
        }
        
        // Show error dialog to user
        await dialog.showMessageBox({
          type: 'error',
          title: 'Connection Failed',
          message: `Failed to connect to ${printerData.name || 'Unknown Printer'}`,
          detail: result.error || 'Unknown error occurred',
          buttons: ['OK']
        });
      }
    } catch (error) {
      console.error('Printer selection error:', error);
      
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        printerSelectionWindow.webContents.send('printer-selection:connection-failed', 
          error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Show error dialog to user
      await dialog.showMessageBox({
        type: 'error',
        title: 'Connection Error',
        message: `Error connecting to ${(printer as { name?: string }).name || 'Unknown Printer'}`,
        detail: error instanceof Error ? error.message : 'Unknown error occurred',
        buttons: ['OK']
      });
    }
  });

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
        
        // Show error dialog to user
        await dialog.showMessageBox({
          type: 'error',
          title: 'Connection Failed',
          message: `Failed to connect to ${savedDetails.Name}`,
          detail: result.error || 'Unknown error occurred',
          buttons: ['OK']
        });
      }
    } catch (error) {
      console.error('Saved printer selection error:', error);
      
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        printerSelectionWindow.webContents.send('printer-selection:connection-failed', 
          error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Show error dialog to user
      await dialog.showMessageBox({
        type: 'error',
        title: 'Connection Error',
        message: 'Error connecting to saved printer',
        detail: error instanceof Error ? error.message : 'Unknown error occurred',
        buttons: ['OK']
      });
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
