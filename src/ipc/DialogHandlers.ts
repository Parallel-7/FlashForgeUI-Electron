/**
 * Dialog handlers for loading overlay and printer selection window enhancements.
 * Most handlers have been moved to domain-specific modules in src/ipc/handlers/.
 */

import { ipcMain, dialog } from 'electron';
import { getWindowManager } from '../windows/WindowManager';
import { getPrinterConnectionManager } from '../managers/ConnectionFlowManager';
import { createPrinterSelectionWindow } from '../windows/WindowFactory';
import { getLoadingManager } from '../managers/LoadingManager';
import type { DiscoveredPrinter } from '../types/printer';

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

  // Enhanced printer selection window initialization with real discovery
  const setupPrinterSelectionEnhancement = (): void => {
    // Override the 'open-printer-selection' handler with enhanced version
    ipcMain.removeAllListeners('open-printer-selection');
    ipcMain.on('open-printer-selection', async () => {
      // Check if already connected and show confirmation
      if (connectionManager.isConnected()) {
        const currentDetails = connectionManager.getCurrentDetails();
        const printerName = currentDetails?.Name || 'Unknown Printer';
        
        const response = await dialog.showMessageBox({
          type: 'warning',
          title: 'Printer Connected',
          message: `You are currently connected to ${printerName}`,
          detail: 'Scanning for printers may interfere with ongoing operations. Do you want to continue?',
          buttons: ['Cancel', 'Continue Scan'],
          defaultId: 0,
          cancelId: 0
        });

        if (response.response === 0) {
          return; // User cancelled
        }
      }

      // Manual Connect button should go directly to the connection flow
      // This bypasses the old printer selection dialog completely
      try {
        console.log('Manual connect button pressed - starting direct connection flow');
        const result = await connectionManager.startConnectionFlow({ checkForActiveConnection: false });
        
        if (result.success) {
          console.log('Manual connection flow completed successfully');
        } else if (result.error && !result.error.includes('cancelled')) {
          // Only show error if it's not a user cancellation
          console.log('Manual connection flow failed:', result.error);
        }
      } catch (error) {
        console.error('Manual connection flow error:', error);
      }
    });
  };

  // Enhanced printer selection window creation
  const enhancedCreatePrinterSelectionWindow = async (shouldDisconnect: boolean = false): Promise<void> => {
    // If we need to disconnect first, do it before creating the window
    if (shouldDisconnect && connectionManager.isConnected()) {
      try {
        // Show loading overlay on main window while disconnecting
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('loading-show', {
            message: 'Disconnecting from current printer...',
            canCancel: false
          });
        }
        
        // Disconnect from current printer
        await connectionManager.disconnect();
        
        // Hide loading overlay
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('loading-hide', {});
        }
      } catch (error) {
        console.error('Failed to disconnect before scanning:', error);
        // Continue anyway - don't block the user
      }
    }
    
    createPrinterSelectionWindow();
    
    // Start real printer discovery after window is ready
    setTimeout(async () => {
      const printerSelectionWindow = windowManager.getPrinterSelectionWindow();
      if (printerSelectionWindow && !printerSelectionWindow.isDestroyed()) {
        try {
          // Send initial discovery started event immediately
          printerSelectionWindow.webContents.send('printer-selection:discovery-started');
          
          // Listen for discovery events
          const onDiscoveryStarted = () => {
            const window = windowManager.getPrinterSelectionWindow();
            if (window && !window.isDestroyed()) {
              window.webContents.send('printer-selection:discovery-started');
            }
          };
          
          const onDiscoveryCompleted = (printers: DiscoveredPrinter[]) => {
            const window = windowManager.getPrinterSelectionWindow();
            if (window && !window.isDestroyed()) {
              window.webContents.send('printer-selection:receive-printers', printers);
            }
            // Clean up listeners
            connectionManager.removeListener('discovery-started', onDiscoveryStarted);
            connectionManager.removeListener('discovery-completed', onDiscoveryCompleted);
          };
          
          connectionManager.on('discovery-started', onDiscoveryStarted);
          connectionManager.on('discovery-completed', onDiscoveryCompleted);
          
          // Start the full connection flow with enhanced fallback logic
          void connectionManager.startConnectionFlow({ checkForActiveConnection: false }).then((result) => {
            // Connection flow completed - result contains success/failure info
            if (!result.success && result.error) {
              console.log('Connection flow completed with result:', result);
              const window = windowManager.getPrinterSelectionWindow();
              if (window && !window.isDestroyed()) {
                // Check if this is a "user cancelled" scenario vs actual error
                if (result.error.includes('User cancelled') || result.error.includes('cancelled')) {
                  // User cancelled during the flow - don't show error
                  console.log('Connection flow cancelled by user');
                } else {
                  // Send error event for genuine failures
                  window.webContents.send('printer-selection:discovery-error', {
                    error: result.error,
                    message: 'Connection flow completed but no printer was connected. You can still select a printer manually.'
                  });
                }
              }
            }
            // If result.success is true, it means a printer was connected automatically
            // and the window will be closed by the connection success handlers
          }).catch(error => {
            console.error('Connection flow error:', error);
            const window = windowManager.getPrinterSelectionWindow();
            if (window && !window.isDestroyed()) {
              // Send error event for unexpected failures
              window.webContents.send('printer-selection:discovery-error', {
                error: error instanceof Error ? error.message : 'Connection flow failed',
                message: 'Failed to start connection flow. Please check your network connection and try again.'
              });
            }
          });
          
        } catch (error) {
          console.error('Discovery initialization error:', error);
          const window = windowManager.getPrinterSelectionWindow();
          if (window && !window.isDestroyed()) {
            window.webContents.send('printer-selection:discovery-error', {
              error: error instanceof Error ? error.message : 'Discovery initialization failed',
              message: 'Failed to initialize printer discovery. Please try again.'
            });
          }
        }
      }
    }, 300); // Slightly shorter delay since we handle errors better now
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
  setupPrinterSelectionEnhancement();
  setupLoadingHandlers();
};
