/**
 * DialogIntegrationService.ts
 * Handles integration with printer selection dialogs
 * Manages dialog creation, IPC communication, and user interaction flow
 */

import { EventEmitter } from 'events';
import { dialog } from 'electron';
import type { IpcMainEvent, BrowserWindow } from 'electron';
import { getWindowManager } from '../windows/WindowManager';
import { SavedPrinterMatch, DiscoveredPrinter, ConnectionResult } from '../types/printer';

/**
 * Service responsible for dialog integration and user interaction
 * Handles printer selection dialogs and confirmation prompts
 */
export class DialogIntegrationService extends EventEmitter {
  private static instance: DialogIntegrationService | null = null;
  private readonly windowManager = getWindowManager();

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of DialogIntegrationService
   */
  public static getInstance(): DialogIntegrationService {
    if (!DialogIntegrationService.instance) {
      DialogIntegrationService.instance = new DialogIntegrationService();
    }
    return DialogIntegrationService.instance;
  }

  /**
   * Show confirmation dialog before scanning when already connected
   */
  public async confirmDisconnectForScan(currentPrinterName?: string): Promise<boolean> {
    const printerName = currentPrinterName || 'Unknown Printer';
    
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'Printer Connected',
      message: `You are currently connected to ${printerName}`,
      detail: 'Scanning for printers may interfere with ongoing operations. Do you want to continue?',
      buttons: ['Cancel', 'Continue Scan'],
      defaultId: 0,
      cancelId: 0
    });

    return response.response === 1; // User clicked "Continue Scan"
  }

  /**
   * Show printer selection dialog for discovered printers
   * TODO: Implement proper dialog integration with the existing printer selection window
   */
  public async showPrinterSelectionDialog(printers: DiscoveredPrinter[]): Promise<DiscoveredPrinter | null> {
    // For now, return first printer as placeholder
    // This should integrate with the existing printer selection window
    return printers.length > 0 ? printers[0] : null;
  }

  /**
   * Show saved printer selection dialog
   * Creates and displays the printer selection window in saved mode
   */
  public async showSavedPrinterSelectionDialog(
    matches: SavedPrinterMatch[],
    onSelection: (serialNumber: string) => Promise<ConnectionResult>
  ): Promise<ConnectionResult> {
    return new Promise((resolve) => {
      // Dynamic import to avoid circular dependencies
      import('../windows/WindowFactory').then(({ createPrinterSelectionWindow }) => {
        createPrinterSelectionWindow();
        const printerSelectionWindow = this.windowManager.getPrinterSelectionWindow();
        
        // Set up one-time event handlers for this specific selection session
        const handleSavedPrinterSelection = async (_: IpcMainEvent, printer: unknown): Promise<void> => {
          console.log('Saved printer selected:', printer);
          
          try {
            if (!this.validatePrinterSelection(printer)) {
              resolve({ success: false, error: 'Invalid printer data received' });
              return;
            }
            
            const printerSerial = (printer as { serialNumber: string }).serialNumber;
            
            // Close the selection window first
            const currentWindow = this.windowManager.getPrinterSelectionWindow();
            if (currentWindow && !currentWindow.isDestroyed()) {
              currentWindow.close();
            }
            
            // Use the callback to handle the connection
            const result = await onSelection(printerSerial);
            resolve(result);
            
          } catch (error) {
            console.error('Error handling saved printer selection:', error);
            resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        };
        
        const handleSelectionCancel = (): void => {
          console.log('Saved printer selection cancelled');
          resolve({ success: false, error: 'User cancelled printer selection' });
        };
        
        // Set up IPC listeners
        this.setupSelectionListeners(
          printerSelectionWindow,
          handleSavedPrinterSelection,
          handleSelectionCancel
        );
        
        // Send saved printer data to the window once it's ready
        setTimeout(() => {
          this.sendSavedPrinterData(matches);
        }, 500); // Delay to ensure window is ready
        
      }).catch(error => {
        console.error('Error importing WindowFactory:', error);
        resolve({ success: false, error: 'Failed to create selection window' });
      });
    });
  }

  /**
   * Validate printer selection data
   */
  private validatePrinterSelection(printer: unknown): boolean {
    return (
      printer !== null &&
      typeof printer === 'object' &&
      Object.prototype.hasOwnProperty.call(printer, 'serialNumber') &&
      typeof (printer as { [key: string]: unknown })['serialNumber'] === 'string'
    );
  }

  /**
   * Setup IPC listeners for printer selection
   */
  private setupSelectionListeners(
    window: BrowserWindow | null,
    onSelection: (event: IpcMainEvent, printer: unknown) => Promise<void>,
    onCancel: () => void
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { ipcMain }: typeof import('electron') = require('electron');
    
    ipcMain.once('printer-selection:select-saved', onSelection);
    ipcMain.once('printer-selection:cancel-saved', onCancel);
    
    // Handle window closed without selection
    if (window) {
      window.on('closed', () => {
        // Clean up listeners if window is closed without selection
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { ipcMain: cleanupIpcMain }: typeof import('electron') = require('electron');
        cleanupIpcMain.removeListener('printer-selection:select-saved', onSelection);
        cleanupIpcMain.removeListener('printer-selection:cancel-saved', onCancel);
      });
    }
  }

  /**
   * Send saved printer data to the selection window
   */
  private sendSavedPrinterData(matches: SavedPrinterMatch[]): void {
    const currentWindow = this.windowManager.getPrinterSelectionWindow();
    if (currentWindow && !currentWindow.isDestroyed()) {
      // Set mode to saved
      currentWindow.webContents.send('printer-selection:mode', 'saved');
      
      // Import saved printer service to prepare data
      import('../services/SavedPrinterService').then(({ getSavedPrinterService }) => {
        const savedPrinterService = getSavedPrinterService();
        const savedPrinterInfos = savedPrinterService.prepareSavedPrinterData(matches);
        const lastUsedSerial = savedPrinterService.getLastUsedPrinter()?.SerialNumber || null;
        
        // Send saved printer data
        currentWindow.webContents.send('printer-selection:receive-saved-printers', savedPrinterInfos, lastUsedSerial);
      }).catch(error => {
        console.error('Error importing SavedPrinterService:', error);
      });
    }
  }
}

// Export singleton getter function
export const getDialogIntegrationService = (): DialogIntegrationService => {
  return DialogIntegrationService.getInstance();
};
