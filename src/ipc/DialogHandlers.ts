/**
 * Dialog handlers for loading overlay and printer selection window enhancements.
 * Most handlers have been moved to domain-specific modules in src/ipc/handlers/.
 */

import { ipcMain } from 'electron';
import { getWindowManager } from '../windows/WindowManager';
import { getPrinterConnectionManager } from '../managers/ConnectionFlowManager';
import { getLoadingManager } from '../managers/LoadingManager';

/**
 * Setup dialog-specific handlers and enhancements
 */
export const setupDialogHandlers = (): void => {
  const windowManager = getWindowManager();
  const connectionManager = getPrinterConnectionManager();

  // Set up connection manager with input dialog handler
  connectionManager.setInputDialogHandler(async (options) => {
    const { createInputDialog } = await import('../windows/WindowFactory');
    return createInputDialog(options);
  });

  // Enhanced connect choice dialog initialization
  const setupConnectChoiceEnhancement = (): void => {
    // Override the 'open-printer-selection' handler with connect choice dialog
    ipcMain.removeAllListeners('open-printer-selection');
    ipcMain.on('open-printer-selection', async () => {
      // Check if already connected and show confirmation
      if (connectionManager.isConnected()) {
        const currentDetails = connectionManager.getCurrentDetails();
        const printerName = currentDetails?.Name || 'Unknown Printer';

        try {
          // Use custom themed dialog instead of built-in dialog
          const { createPrinterConnectedWarningDialog } = await import('../windows/factories/DialogWindowFactory');
          const userWantsToContinue = await createPrinterConnectedWarningDialog({ printerName });

          if (!userWantsToContinue) {
            return; // User cancelled
          }
        } catch (error) {
          console.error('Error showing printer connected warning dialog:', error);
          return; // Default to cancel on error
        }
      }

      // Show connect choice dialog instead of directly starting connection flow
      try {
        console.log('Connect button pressed - showing connection choice dialog');
        const { createConnectChoiceDialog } = await import('../windows/WindowFactory');
        
        // Show the connect choice dialog
        const userChoice = await createConnectChoiceDialog({});
        
        if (userChoice === 'enter-ip') {
          console.log('User chose to enter IP manually');
          // Show input dialog for IP entry
          const { createInputDialog } = await import('../windows/WindowFactory');
          const ipAddress = await createInputDialog({
            title: 'Enter Printer IP',
            message: 'Enter the IP address of your FlashForge printer:',
            placeholder: '192.168.1.100',
            inputType: 'text'
          });
          
          if (ipAddress) {
            // Connect directly to the provided IP
            console.log(`Connecting directly to IP: ${ipAddress}`);
            const result = await connectionManager.connectDirectlyToIP(ipAddress);
            if (result.success) {
              console.log('Manual IP connection completed successfully');
            } else {
              console.log('Manual IP connection failed:', result.error);
            }
          }
          
        } else if (userChoice === 'scan-network') {
          console.log('User chose to scan network');
          // Start the network discovery flow (existing behavior)
          const result = await connectionManager.startConnectionFlow({ checkForActiveConnection: false });
          
          if (result.success) {
            console.log('Network scan connection flow completed successfully');
          } else if (result.error && !result.error.includes('cancelled')) {
            console.log('Network scan connection flow failed:', result.error);
          }
          
        } else {
          console.log('User cancelled connection choice dialog');
        }
        
      } catch (error) {
        console.error('Connect choice dialog error:', error);
      }
    });
  };


  // Loading overlay handlers
  const setupLoadingHandlers = (): void => {
    const loadingManager = getLoadingManager();

    ipcMain.on('loading-show', (_, options: { message: string; canCancel?: boolean; showProgress?: boolean }) => {
      loadingManager.show(options);
    });

    ipcMain.on('loading-hide', () => {
      loadingManager.hide();
    });

    ipcMain.on('loading-show-success', (_, data: { message: string; autoHideAfter?: number }) => {
      loadingManager.showSuccess(data.message, data.autoHideAfter);
    });

    ipcMain.on('loading-show-error', (_, data: { message: string; autoHideAfter?: number }) => {
      loadingManager.showError(data.message, data.autoHideAfter);
    });

    ipcMain.on('loading-set-progress', (_, data: { progress: number }) => {
      loadingManager.setProgress(data.progress);
    });

    ipcMain.on('loading-update-message', (_, data: { message: string }) => {
      loadingManager.updateMessage(data.message);
    });

    ipcMain.on('loading-cancel-request', () => {
      loadingManager.handleCancelRequest();
    });

    // Setup loading manager event forwarding to renderer
    loadingManager.on('loading-state-changed', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-state-changed', eventData);
      }
    });

    loadingManager.on('loading-show', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-show', eventData);
      }
    });

    loadingManager.on('loading-hide', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-hide', eventData);
      }
    });

    loadingManager.on('loading-success', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-success', eventData);
      }
    });

    loadingManager.on('loading-error', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-error', eventData);
      }
    });

    loadingManager.on('loading-progress', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-progress', eventData);
      }
    });

    loadingManager.on('loading-message-updated', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-message-updated', eventData);
      }
    });

    loadingManager.on('loading-cancelled', (eventData) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-cancelled', eventData);
      }
    });
  };

  // Initialize handlers
  setupConnectChoiceEnhancement();
  setupLoadingHandlers();
};
