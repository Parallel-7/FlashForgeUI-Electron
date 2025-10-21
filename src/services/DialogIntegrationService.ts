/**
 * @fileoverview Service for integrating printer selection dialogs with connection workflows.
 *
 * Manages user interaction through dialogs during printer connection:
 * - Printer selection dialog creation and management
 * - Disconnect confirmation prompts
 * - Dialog IPC communication setup
 * - User choice handling (discovered vs saved printers)
 * - Dialog lifecycle management (creation, data population, cleanup)
 *
 * Key exports:
 * - DialogIntegrationService class: Dialog integration coordinator
 * - getDialogIntegrationService(): Singleton accessor
 *
 * This service bridges the gap between connection workflows and user interaction,
 * presenting discovered and saved printers in a selection dialog and handling user
 * choices to complete connection establishment.
 */

import { EventEmitter } from 'events';
import type { IpcMainEvent, BrowserWindow } from 'electron';
import { getWindowManager } from '../windows/WindowManager';
import { SavedPrinterMatch, DiscoveredPrinter, ConnectionResult, StoredPrinterDetails } from '../types/printer';

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

    // Dynamic import to avoid circular dependencies
    return import('../windows/factories/DialogWindowFactory').then(async ({ createPrinterConnectedWarningDialog }) => {
      return await createPrinterConnectedWarningDialog({ printerName });
    }).catch(error => {
      console.error('Error importing DialogWindowFactory:', error);
      return false; // Default to cancel on error
    });
  }

  /**
   * Show printer selection dialog for discovered printers
   * Creates and displays the printer selection window in discovered mode
   */
  public async showPrinterSelectionDialog(printers: DiscoveredPrinter[]): Promise<DiscoveredPrinter | null> {
    return new Promise((resolve) => {
      // Dynamic import to avoid circular dependencies
      import('../windows/WindowFactory').then(({ createPrinterSelectionWindow }) => {
        createPrinterSelectionWindow();
        const printerSelectionWindow = this.windowManager.getPrinterSelectionWindow();
        
        // Set up one-time event handlers for this specific selection session
        const handlePrinterSelection = async (_: IpcMainEvent, printer: unknown): Promise<void> => {
          console.log('Discovered printer selected:', printer);
          
          try {
            // Use comprehensive validation with proper error handling
            const validatedPrinter = this.validateDiscoveredPrinterData(printer);
            if (!validatedPrinter) {
              console.error('Failed to validate discovered printer data');
              resolve(null);
              return;
            }
            
            resolve(validatedPrinter);
            
          } catch (error) {
            console.error('Error handling discovered printer selection:', error);
            resolve(null);
          } finally {
            // Always clean up - close window and remove listeners
            this.cleanupDiscoveredSelectionListeners();
            const currentWindow = this.windowManager.getPrinterSelectionWindow();
            if (currentWindow && !currentWindow.isDestroyed()) {
              currentWindow.close();
            }
          }
        };
        
        const handleSelectionCancel = (): void => {
          console.log('Discovered printer selection cancelled');
          resolve(null);
        };
        
        // Set up IPC listeners
        this.setupDiscoveredSelectionListeners(
          printerSelectionWindow,
          handlePrinterSelection,
          handleSelectionCancel
        );
        
        // Send discovered printer data to the window once it's ready
        setTimeout(() => {
          this.sendDiscoveredPrinterData(printers);
        }, 500); // Delay to ensure window is ready
        
      }).catch(error => {
        console.error('Error importing WindowFactory:', error);
        resolve(null);
      });
    });
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

            // Now TypeScript knows printer has serialNumber property
            const printerSerial = printer.serialNumber;

            // Close dialog immediately so user can see the loading dialog
            this.cleanupSavedSelectionListeners();
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
   * Show auto-connect choice dialog when discovery fails
   * Creates and displays the auto-connect choice dialog
   */
  public async showAutoConnectChoiceDialog(
    lastUsedPrinter: StoredPrinterDetails | null,
    savedPrinterCount: number
  ): Promise<string | null> {
    // Dynamic import to avoid circular dependencies
    return import('../windows/factories/DialogWindowFactory').then(async ({ createAutoConnectChoiceDialog }) => {
      const dialogData = {
        lastUsedPrinter: lastUsedPrinter ? {
          name: lastUsedPrinter.Name,
          serialNumber: lastUsedPrinter.SerialNumber
        } : null,
        savedPrinterCount
      };
      
      return await createAutoConnectChoiceDialog(dialogData);
    }).catch(error => {
      console.error('Error importing DialogWindowFactory:', error);
      return null;
    });
  }

  /**
   * Validate printer selection data
   */
  private validatePrinterSelection(printer: unknown): printer is { serialNumber: string } {
    return (
      printer !== null &&
      typeof printer === 'object' &&
      Object.prototype.hasOwnProperty.call(printer, 'serialNumber') &&
      typeof (printer as { [key: string]: unknown })['serialNumber'] === 'string'
    );
  }

  /**
   * Validate discovered printer selection data
   */
  private validateDiscoveredPrinterSelection(
    printer: unknown
  ): printer is { name?: string; ipAddress: string; serialNumber?: string; model?: string } {
    return (
      printer !== null &&
      typeof printer === 'object' &&
      Object.prototype.hasOwnProperty.call(printer, 'ipAddress') &&
      typeof (printer as { [key: string]: unknown })['ipAddress'] === 'string'
    );
  }

  /**
   * Validate and safely convert discovered printer data with comprehensive runtime validation
   */
  private validateDiscoveredPrinterData(data: unknown): DiscoveredPrinter | null {
    if (!data || typeof data !== 'object') {
      console.error('Invalid printer data: not an object');
      return null;
    }

    const printerData = data as Record<string, unknown>;

    // Validate required ipAddress field
    if (!printerData.ipAddress || typeof printerData.ipAddress !== 'string') {
      console.error('Invalid printer data: missing or invalid ipAddress');
      return null;
    }

    // Validate and set defaults for other fields
    const name = typeof printerData.name === 'string' ? printerData.name : 'Unknown';
    const serialNumber = typeof printerData.serialNumber === 'string' ? printerData.serialNumber : '';
    const model = typeof printerData.model === 'string' ? printerData.model : undefined;
    const status = typeof printerData.status === 'string' ? printerData.status : undefined;
    const firmwareVersion = typeof printerData.firmwareVersion === 'string' ? printerData.firmwareVersion : undefined;

    return {
      name,
      ipAddress: printerData.ipAddress,
      serialNumber,
      model,
      status,
      firmwareVersion
    };
  }

  // Store current listeners for cleanup
  private currentSavedSelectionListener: ((event: IpcMainEvent, printer: unknown) => Promise<void>) | null = null;
  private currentSavedCancelListener: (() => void) | null = null;
  private currentDiscoveredSelectionListener: ((event: IpcMainEvent, printer: unknown) => Promise<void>) | null = null;
  private currentDiscoveredCancelListener: (() => void) | null = null;

  /**
   * Setup IPC listeners for saved printer selection
   */
  private setupSelectionListeners(
    window: BrowserWindow | null,
    onSelection: (event: IpcMainEvent, printer: unknown) => Promise<void>,
    onCancel: () => void
  ): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { ipcMain }: typeof import('electron') = require('electron');
      
      // Clean up any existing listeners first
      this.cleanupSavedSelectionListeners();
      
      // Store references for cleanup
      this.currentSavedSelectionListener = onSelection;
      this.currentSavedCancelListener = onCancel;
      
      ipcMain.once('printer-selection:select-saved', onSelection);
      ipcMain.once('printer-selection:cancel-saved', onCancel);
      
      // Handle window closed without selection
      if (window) {
        window.on('closed', () => {
          this.cleanupSavedSelectionListeners();
        });
      }
    } catch (error) {
      console.error('Error setting up saved selection listeners:', error);
      // Ensure cleanup even if setup fails
      this.cleanupSavedSelectionListeners();
    }
  }

  /**
   * Clean up saved printer selection IPC listeners
   */
  private cleanupSavedSelectionListeners(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { ipcMain }: typeof import('electron') = require('electron');
      
      if (this.currentSavedSelectionListener) {
        ipcMain.removeListener('printer-selection:select-saved', this.currentSavedSelectionListener);
        this.currentSavedSelectionListener = null;
      }
      
      if (this.currentSavedCancelListener) {
        ipcMain.removeListener('printer-selection:cancel-saved', this.currentSavedCancelListener);
        this.currentSavedCancelListener = null;
      }
    } catch (error) {
      console.error('Error cleaning up saved selection listeners:', error);
    }
  }

  /**
   * Setup IPC listeners for discovered printer selection
   */
  private setupDiscoveredSelectionListeners(
    window: BrowserWindow | null,
    onSelection: (event: IpcMainEvent, printer: unknown) => Promise<void>,
    onCancel: () => void
  ): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { ipcMain }: typeof import('electron') = require('electron');
      
      // Clean up any existing listeners first
      this.cleanupDiscoveredSelectionListeners();
      
      // Store references for cleanup
      this.currentDiscoveredSelectionListener = onSelection;
      this.currentDiscoveredCancelListener = onCancel;
      
      ipcMain.once('printer-selection:select', onSelection);
      ipcMain.once('printer-selection:cancel', onCancel);
      
      // Handle window closed without selection
      if (window) {
        window.on('closed', () => {
          this.cleanupDiscoveredSelectionListeners();
        });
      }
    } catch (error) {
      console.error('Error setting up discovered selection listeners:', error);
      // Ensure cleanup even if setup fails
      this.cleanupDiscoveredSelectionListeners();
    }
  }

  /**
   * Clean up discovered printer selection IPC listeners
   */
  private cleanupDiscoveredSelectionListeners(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { ipcMain }: typeof import('electron') = require('electron');
      
      if (this.currentDiscoveredSelectionListener) {
        ipcMain.removeListener('printer-selection:select', this.currentDiscoveredSelectionListener);
        this.currentDiscoveredSelectionListener = null;
      }
      
      if (this.currentDiscoveredCancelListener) {
        ipcMain.removeListener('printer-selection:cancel', this.currentDiscoveredCancelListener);
        this.currentDiscoveredCancelListener = null;
      }
    } catch (error) {
      console.error('Error cleaning up discovered selection listeners:', error);
    }
  }

  /**
   * Send discovered printer data to the selection window
   */
  private sendDiscoveredPrinterData(printers: DiscoveredPrinter[]): void {
    const currentWindow = this.windowManager.getPrinterSelectionWindow();
    if (currentWindow && !currentWindow.isDestroyed()) {
      // Set mode to discovered
      currentWindow.webContents.send('printer-selection:mode', 'discovered');
      
      // Convert to PrinterInfo format expected by the renderer
      const printerInfos = printers.map(printer => ({
        name: printer.name,
        ipAddress: printer.ipAddress,
        serialNumber: printer.serialNumber,
        model: printer.model,
        status: 'Available',
        firmwareVersion: undefined
      }));
      
      // Send discovered printer data
      currentWindow.webContents.send('printer-selection:receive-printers', printerInfos);
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
        
        // Add comprehensive null checks for SavedPrinterMatch.discoveredPrinter
        const validMatches = matches.filter(match => {
          if (!match || !match.savedDetails) {
            console.warn('Invalid saved printer match:', match);
            return false;
          }
          // Note: discoveredPrinter can be null for offline printers - this is expected
          return true;
        });
        
        const savedPrinterInfos = savedPrinterService.prepareSavedPrinterData(validMatches);
        const lastUsedPrinter = savedPrinterService.getLastUsedPrinter();
        const lastUsedSerial = lastUsedPrinter?.SerialNumber || null;
        
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

