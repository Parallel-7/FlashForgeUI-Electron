const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

/**
 * WindowManager handles creation and management of all application windows
 */
class WindowManager {
  constructor() {
    this.windows = {
      main: null,
      settings: null,
      printerSelection: null,
      jobUploader: null,
      sendCmds: null,
      statusDialog: null
    };
    
    // Keep references to event handlers for cleanup
    this._eventHandlers = new Map();
  }
  
  /**
   * Create and return the main application window
   * @param {Object} options Additional options for window configuration
   * @returns {BrowserWindow} The main window instance
   */
  createMainWindow(options = {}) {
    // Return existing window if already created
    if (this.windows.main) {
      this.windows.main.focus();
      return this.windows.main;
    }
    
    const defaultOptions = {
      width: 900,
      height: 880,
      minWidth: 900,
      minHeight: 880,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      alwaysOnTop: false
    };
    
    // Merge default options with provided options
    const windowOptions = { ...defaultOptions, ...options };
    
    // Create the browser window
    const mainWindow = new BrowserWindow(windowOptions);
    this.windows.main = mainWindow;
    
    // Setup window event handlers
    mainWindow.on('closed', () => {
      this.windows.main = null;
      // Close other windows when main window is closed
      this.closeAllWindows();
    });
    
    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    
    // Return the window instance
    return mainWindow;
  }
  
  /**
   * Show the settings window
   * @returns {BrowserWindow} The settings window instance
   */
  showSettingsWindow() {
    if (this.windows.settings) {
      this.windows.settings.focus();
      return this.windows.settings;
    }
    
    this.windows.settings = new BrowserWindow({
      width: 650,
      height: 450,
      parent: this.windows.main,
      modal: true,
      show: false,
      frame: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    this.windows.settings.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));
    
    this.windows.settings.once('ready-to-show', () => {
      this.windows.settings.show();
    });
    
    this.windows.settings.on('closed', () => {
      this.windows.settings = null;
    });
    
    return this.windows.settings;
  }
  
  /**
   * Show the printer selection window
   * @param {Array} printers List of discovered printers
   * @returns {Promise<Object>} Selected printer or null if canceled
   */
  showPrinterSelectionWindow(printers) {
    return new Promise((resolve) => {
      if (this.windows.printerSelection) {
        this.windows.printerSelection.focus();
        this.windows.printerSelection.webContents.send('printer-selection:receive-printers', printers);
        return;
      }
      
      this.windows.printerSelection = new BrowserWindow({
        width: 550,
        height: 400,
        parent: this.windows.main,
        modal: true,
        show: false,
        frame: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        webPreferences: {
          preload: path.join(__dirname, '../../ui/printer-selection/printer-selection-preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      
      this.windows.printerSelection.loadFile(path.join(__dirname, '../../ui/printer-selection/printer-selection.html'));
      
      let resolved = false; // Prevent multiple resolves
      
      const selectionHandler = (event, selectedPrinter) => {
        console.log('Main - IPC "printer-selection:select" event received.');
        console.log('Main - IPC data type:', typeof selectedPrinter);
        console.log('Main - IPC data received:', selectedPrinter);
        if (!resolved) {
          resolved = true;
          if (this.windows.printerSelection) this.windows.printerSelection.close();
          resolve(selectedPrinter);
        }
      };
      
      const cancelHandler = () => {
        if (!resolved) {
          resolved = true;
          console.log('Printer selection cancelled via IPC.');
          if (this.windows.printerSelection) this.windows.printerSelection.close();
          resolve(null); // Resolve with null for cancellation
        }
      };
      
      // Listen for selection or cancellation from the window
      ipcMain.once('printer-selection:select', selectionHandler);
      ipcMain.once('printer-selection:cancel', cancelHandler);
      
      // Store handler references for cleanup
      this._eventHandlers.set('printer-selection:select', selectionHandler);
      this._eventHandlers.set('printer-selection:cancel', cancelHandler);
      
      this.windows.printerSelection.webContents.on('did-finish-load', () => {
        console.log('Sending printers to selection window:', printers);
        this.windows.printerSelection.webContents.send('printer-selection:receive-printers', printers);
        this.windows.printerSelection.show();
      });
      
      this.windows.printerSelection.on('closed', () => {
        console.log('Printer selection window closed.');
        // Clean up listeners if window closed manually
        ipcMain.removeListener('printer-selection:select', selectionHandler);
        ipcMain.removeListener('printer-selection:cancel', cancelHandler);
        this._eventHandlers.delete('printer-selection:select');
        this._eventHandlers.delete('printer-selection:cancel');
        this.windows.printerSelection = null;
        if (!resolved) { // Resolve with null if closed without selection/cancel
          resolved = true;
          resolve(null);
        }
      });
    });
  }

  /**
   * Show the status dialog window
   * @returns {BrowserWindow} The status dialog window instance
   */
  showStatusDialog() {
    if (this.windows.statusDialog) {
      this.windows.statusDialog.focus();
      return this.windows.statusDialog;
    }
    
    this.windows.statusDialog = new BrowserWindow({
      width: 480,
      height: 600,
      minWidth: 450,
      minHeight: 550,
      parent: this.windows.main,
      modal: false,
      show: false,
      frame: false,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, '../../ui/status-dialog/status-dialog-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    this.windows.statusDialog.loadFile(path.join(__dirname, '../../ui/status-dialog/status-dialog.html'));
    
    this.windows.statusDialog.once('ready-to-show', () => {
      this.windows.statusDialog.show();
    });
    
    // Set up close handler for status dialog
    const statusDialogCloseHandler = (event) => {
      if (event.sender === this.windows.statusDialog?.webContents) {
        if (this.windows.statusDialog) {
          this.windows.statusDialog.close();
        }
      }
    };
    
    // Register the handler
    ipcMain.on('status-dialog:close', statusDialogCloseHandler);
    this._eventHandlers.set('status-dialog:close', statusDialogCloseHandler);
    
    // Add listener for stats requests
    const statusDialogStatsHandler = (event) => {
      if (event.sender === this.windows.statusDialog?.webContents) {
        // This function needs to be implemented in the main index.js
        // as it depends on application state (cameraService, webUIServer, etc.)
        // We'll just respond with empty data here
        event.sender.send('status-dialog:receive-stats', {
          webUI: { running: false, port: 0, clients: 0 },
          camera: { running: false, streaming: false, port: 0, clients: 0, url: null },
          system: { uptime: 0, memory: 0 }
        });
      }
    };
    
    ipcMain.on('status-dialog:request-stats', statusDialogStatsHandler);
    this._eventHandlers.set('status-dialog:request-stats', statusDialogStatsHandler);
    
    this.windows.statusDialog.on('closed', () => {
      // Clean up IPC handlers
      ipcMain.removeListener('status-dialog:close', statusDialogCloseHandler);
      ipcMain.removeListener('status-dialog:request-stats', statusDialogStatsHandler);
      this._eventHandlers.delete('status-dialog:close');
      this._eventHandlers.delete('status-dialog:request-stats');
      this.windows.statusDialog = null;
    });
    
    return this.windows.statusDialog;
  }
  
  /**
   * Show an input dialog with the given options
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @param {string} defaultValue Default input value
   * @param {string} inputType Input type (text, password, etc.)
   * @param {string} placeholder Placeholder text
   * @returns {Promise<string|null>} User input or null if canceled
   */
  showInputDialog(title, message, defaultValue = '', inputType = 'text', placeholder = '') {
    return new Promise((resolve) => {
      const dialogId = `dialog-${Date.now()}`; // Unique ID for response listener
      const resultChannel = `dialog-result-${dialogId}`;
      
      const dialogWindow = new BrowserWindow({
        width: 400,
        height: 250,
        parent: this.windows.main,
        modal: true,
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
          preload: path.join(__dirname, '../../ui/dialog/dialog-preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      
      dialogWindow.loadFile(path.join(__dirname, '../../ui/dialog/dialog.html'));
      
      // Listener for the specific response
      const resultHandler = (event, result) => {
        console.log(`Dialog ${dialogId} result:`, result);
        if (!dialogWindow.isDestroyed()) {
          dialogWindow.close();
        }
        resolve(result); // Resolve with the value or null
      };
      
      ipcMain.once(resultChannel, resultHandler);
      
      // Store handler reference for cleanup
      this._eventHandlers.set(resultChannel, resultHandler);
      
      dialogWindow.webContents.on('did-finish-load', () => {
        // Send initialization data including the unique response channel
        dialogWindow.webContents.send('dialog-init', {
          title,
          message,
          defaultValue,
          inputType,
          placeholder,
          responseChannel: resultChannel // Tell dialog where to send result
        });
        dialogWindow.show();
      });
      
      dialogWindow.on('closed', () => {
        // Ensure listener is removed if window closed manually
        ipcMain.removeListener(resultChannel, resultHandler);
        this._eventHandlers.delete(resultChannel);
      });
    });
  }
  
  /**
   * Show a confirmation dialog
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @returns {Promise<string>} 'ok' if confirmed, 'cancel' if canceled
   */
  async showConfirmationDialog(title, message) {
    // Re-use the input dialog logic but customize for simple OK/Cancel
    const result = await this.showInputDialog(
      title,
      message,
      '', // No default value needed
      'hidden', // Hide the input field
      ''
    );
    return result !== null ? 'ok' : 'cancel';
  }
  
  /**
   * Get the main window instance
   * @returns {BrowserWindow|null} The main window or null if not created
   */
  getMainWindow() {
    return this.windows.main;
  }

  /**
   * Close all windows including the main window
   */
  closeAllWindows() {
    Object.values(this.windows).forEach(window => {
      if (window) window.close();
    });
  }
  
  /**
   * Clean up event handlers and references
   */
  dispose() {
    // Remove all registered event handlers
    for (const [event, handler] of this._eventHandlers.entries()) {
      ipcMain.removeListener(event, handler);
    }
    this._eventHandlers.clear();
    
    // Close all windows
    this.closeAllWindows();
  }
}

module.exports = WindowManager;
