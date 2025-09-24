/**
 * DialogWindowFactory handles all modal dialog window creation with user interaction
 * and promise-based results. This module manages complex IPC communication patterns,
 * unique dialog ID generation, and response channel management for input dialogs,
 * material selection dialogs, and confirmation dialogs with proper cleanup and
 * error handling throughout the dialog lifecycle.
 */

import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { getWindowManager } from '../WindowManager';
import {
  InputDialogOptions,
  MaterialMatchingDialogData,
  SingleColorConfirmationDialogData,
  AutoConnectChoiceDialogData,
  ConnectChoiceDialogData,
  PrinterConnectedWarningData,
  createPreloadPath,
  WINDOW_SIZES
} from '../shared/WindowTypes';
import {
  createModalWindow,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
  generateDialogId,
  createResponseChannelName,
  loadWindowHTML
} from '../shared/WindowConfig';

// Interface for window data storage to avoid any types
interface WindowDataStorage<T> {
  readonly resolve: (result: T) => void;
}

// Extend BrowserWindow to include typed window data
interface DialogWindow<T> extends BrowserWindow {
  windowData?: WindowDataStorage<T>;
}

/**
 * Create input dialog with promise-based result handling
 * @param options - Dialog configuration options
 * @returns Promise that resolves with user input or null if cancelled
 */
export const createInputDialog = (options: InputDialogOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (!validateParentWindow(mainWindow, 'input dialog')) {
      resolve(null);
      return;
    }

    // Generate unique dialog ID and response channel
    const dialogId = generateDialogId();
    const responseChannel = createResponseChannelName(dialogId);
    let handlerActive = true;

    // Create the dialog window
    const inputDialogWindow = createModalWindow(
      mainWindow,
      WINDOW_SIZES.INPUT_DIALOG,
      createPreloadPath(path.join(__dirname, '../../ui/input-dialog/input-dialog-preload.js')),
      { resizable: false, frame: false, transparent: true }
    );

    // Set up response handler using handle/invoke pattern
    const handleResponse = async (_event: unknown, result: string | null): Promise<void> => {
      if (!handlerActive) return;

      handlerActive = false;
      ipcMain.removeHandler(responseChannel);

      // Clear window manager reference immediately to prevent duplicate handling
      windowManager.setInputDialogWindow(null);

      // Close dialog window IMMEDIATELY to prevent race conditions
      if (inputDialogWindow && !inputDialogWindow.isDestroyed()) {
        inputDialogWindow.destroy(); // Use destroy() instead of close() for immediate effect
      }

      // Resolve promise with result
      resolve(result);
    };

    ipcMain.handle(responseChannel, handleResponse);

    // Load HTML and setup lifecycle
    void loadWindowHTML(inputDialogWindow, 'input-dialog');

    // Initialize dialog when ready
    inputDialogWindow.webContents.on('did-finish-load', () => {
      if (inputDialogWindow && !inputDialogWindow.isDestroyed()) {
        inputDialogWindow.webContents.send('dialog-init', {
          ...options,
          responseChannel
        });
      }
    });

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      inputDialogWindow,
      () => {
        windowManager.setInputDialogWindow(null);
        // If handler is still active, resolve with null (cancelled)
        if (handlerActive) {
          handlerActive = false;
          ipcMain.removeHandler(responseChannel);
          resolve(null);
        }
      }
    );

    setupDevTools(inputDialogWindow);
    windowManager.setInputDialogWindow(inputDialogWindow);
  });
};

/**
 * Create the material matching dialog window
 * @param data - Dialog initialization data
 * @returns Promise that resolves with material mappings or null if cancelled
 */
export const createMaterialMatchingDialog = (data: MaterialMatchingDialogData): Promise<unknown[] | null> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const jobPickerWindow = windowManager.getJobPickerWindow();
    const parentWindow = jobPickerWindow || windowManager.getMainWindow();
    
    if (!validateParentWindow(parentWindow, 'material matching dialog')) {
      resolve(null);
      return;
    }

    // Store resolve function for later use
    const windowData = { resolve };

    const materialMatchingDialogWindow = createModalWindow(
      parentWindow,
      WINDOW_SIZES.MATERIAL_MATCHING,
      createPreloadPath(path.join(__dirname, '../../ui/material-matching-dialog/material-matching-dialog-preload.js')),
      { resizable: false, frame: false, transparent: true }
    ) as DialogWindow<unknown[] | null>;

    // Store window data for IPC handlers
    materialMatchingDialogWindow.windowData = windowData;

    // Load HTML and setup lifecycle
    void loadWindowHTML(materialMatchingDialogWindow, 'material-matching-dialog');

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      materialMatchingDialogWindow,
      () => {
        windowManager.setMaterialMatchingDialogWindow(null);
        // If not resolved yet, resolve with null (cancelled)
        if (windowData.resolve) {
          windowData.resolve(null);
        }
      },
      () => {
        // Send initialization data to dialog when ready
        materialMatchingDialogWindow.webContents.send('material-matching:init', data);
      }
    );

    setupDevTools(materialMatchingDialogWindow);
    windowManager.setMaterialMatchingDialogWindow(materialMatchingDialogWindow);
  });
};

/**
 * Create the single color confirmation dialog window
 * @param data - Dialog initialization data
 * @returns Promise that resolves with true if confirmed, false if cancelled
 */
export const createSingleColorConfirmationDialog = (data: SingleColorConfirmationDialogData): Promise<boolean> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const jobPickerWindow = windowManager.getJobPickerWindow();
    const parentWindow = jobPickerWindow || windowManager.getMainWindow();
    
    if (!validateParentWindow(parentWindow, 'single color confirmation dialog')) {
      resolve(false);
      return;
    }

    // Store resolve function for later use
    const windowData = { resolve };

    const singleColorConfirmationDialogWindow = createModalWindow(
      parentWindow,
      WINDOW_SIZES.SINGLE_COLOR_CONFIRMATION,
      createPreloadPath(path.join(__dirname, '../../ui/single-color-confirmation-dialog/single-color-confirmation-dialog-preload.js')),
      { resizable: false, frame: false, transparent: true }
    ) as DialogWindow<boolean>;

    // Store window data for IPC handlers
    singleColorConfirmationDialogWindow.windowData = windowData;

    // Load HTML and setup lifecycle
    void loadWindowHTML(singleColorConfirmationDialogWindow, 'single-color-confirmation-dialog');

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      singleColorConfirmationDialogWindow,
      () => {
        windowManager.setSingleColorConfirmationDialogWindow(null);
        // If not resolved yet, resolve with false (cancelled)
        if (windowData.resolve) {
          windowData.resolve(false);
        }
      },
      () => {
        // Send initialization data to dialog when ready
        singleColorConfirmationDialogWindow.webContents.send('single-color-confirm:init', data);
      }
    );

    setupDevTools(singleColorConfirmationDialogWindow);
    windowManager.setSingleColorConfirmationDialogWindow(singleColorConfirmationDialogWindow);
  });
};
/**
 * Create the material info dialog window
 */
export const createMaterialInfoDialog = (materialData: unknown): void => {
  const windowManager = getWindowManager();
  
  // For now, only allow one material info dialog at a time
  if (windowManager.hasMaterialInfoDialogWindow()) {
    windowManager.getMaterialInfoDialogWindow()?.close();
  }

  const jobPickerWindow = windowManager.getJobPickerWindow();
  const parentWindow = jobPickerWindow || windowManager.getMainWindow();
  
  if (!validateParentWindow(parentWindow, 'material info dialog')) {
    return;
  }

  const materialInfoDialogWindow = createModalWindow(
    parentWindow,
    WINDOW_SIZES.MATERIAL_INFO,
    createPreloadPath(path.join(__dirname, '../../ui/material-info-dialog/material-info-dialog-preload.js')),
    { resizable: false, frame: false, transparent: true }
  );

  // Load HTML and setup lifecycle
  void loadWindowHTML(materialInfoDialogWindow, 'material-info-dialog');

  // Setup window lifecycle with cleanup
  setupWindowLifecycle(
    materialInfoDialogWindow,
    () => {
      windowManager.setMaterialInfoDialogWindow(null);
    },
    () => {
      // Send material data to dialog when ready
      materialInfoDialogWindow.webContents.send('material-info-dialog-init', materialData);
    }
  );

  setupDevTools(materialInfoDialogWindow);
  windowManager.setMaterialInfoDialogWindow(materialInfoDialogWindow);
};

/**
 * Create the IFS dialog window for material station display
 */
export const createIFSDialog = (): void => {
  const windowManager = getWindowManager();
  
  if (windowManager.hasIFSDialogWindow()) {
    windowManager.getIFSDialogWindow()?.focus();
    return;
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'IFS dialog')) {
    return;
  }

  const ifsDialogWindow = createModalWindow(
    mainWindow,
    WINDOW_SIZES.IFS_DIALOG,
    createPreloadPath(path.join(__dirname, '../../ui/ifs-dialog/ifs-dialog-preload.js')),
    { resizable: false, frame: false, transparent: true }
  );

  // Load HTML and setup lifecycle
  void loadWindowHTML(ifsDialogWindow, 'ifs-dialog');

  // Setup window lifecycle with cleanup
  setupWindowLifecycle(
    ifsDialogWindow,
    () => {
      windowManager.setIFSDialogWindow(null);
    },
    () => {
      // Send initialization message to dialog when ready
      ifsDialogWindow.webContents.send('ifs-dialog-init');
    }
  );

  setupDevTools(ifsDialogWindow);
  windowManager.setIFSDialogWindow(ifsDialogWindow);
};

// Global handler state for auto-connect choice dialog to prevent duplicate registrations
let globalResponseChannelHandler: ((_event: unknown) => Promise<AutoConnectChoiceDialogData & { responseChannel: string }>) | null = null;

/**
 * Create the auto-connect choice dialog window
 * @param data - Dialog initialization data
 * @returns Promise that resolves with user choice or null if cancelled
 */
export const createAutoConnectChoiceDialog = (data: AutoConnectChoiceDialogData): Promise<string | null> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    if (!validateParentWindow(mainWindow, 'auto-connect choice dialog')) {
      resolve(null);
      return;
    }

    // Generate unique dialog ID and response channel
    const dialogId = generateDialogId();
    const responseChannel = createResponseChannelName(dialogId);
    let handlerActive = true;

    // Create the dialog window
    const autoConnectChoiceDialogWindow = createModalWindow(
      mainWindow,
      WINDOW_SIZES.AUTO_CONNECT_CHOICE,
      createPreloadPath(path.join(__dirname, '../../ui/auto-connect-choice/auto-connect-choice-preload.js')),
      { resizable: false, frame: false, transparent: true }
    );

    // Set up response handler using handle/invoke pattern
    const handleResponse = async (_event: unknown, result: { action: string } | null): Promise<void> => {
      if (!handlerActive) return;
      
      handlerActive = false;
      ipcMain.removeHandler(responseChannel);
      
      // Close dialog window
      if (autoConnectChoiceDialogWindow && !autoConnectChoiceDialogWindow.isDestroyed()) {
        autoConnectChoiceDialogWindow.close();
      }
      
      // Resolve promise with result
      resolve(result?.action || null);
    };

    // Set up response channel provider - only register if not already registered
    const handleGetResponseChannel = async (_event: unknown): Promise<AutoConnectChoiceDialogData & { responseChannel: string }> => {
      return {
        ...data,
        responseChannel
      };
    };

    // Register the unique response handler for this dialog instance
    ipcMain.handle(responseChannel, handleResponse);

    // Register the global response channel provider only if not already registered
    if (!globalResponseChannelHandler) {
      globalResponseChannelHandler = handleGetResponseChannel;
      ipcMain.handle('auto-connect-choice:get-response-channel', globalResponseChannelHandler);
    } else {
      // Update the existing handler to use current dialog data
      globalResponseChannelHandler = handleGetResponseChannel;
      // Remove the old handler and register the new one
      ipcMain.removeHandler('auto-connect-choice:get-response-channel');
      ipcMain.handle('auto-connect-choice:get-response-channel', globalResponseChannelHandler);
    }

    // Load HTML and setup lifecycle
    void loadWindowHTML(autoConnectChoiceDialogWindow, 'auto-connect-choice');

    // Initialize dialog when ready
    autoConnectChoiceDialogWindow.webContents.on('did-finish-load', () => {
      if (autoConnectChoiceDialogWindow && !autoConnectChoiceDialogWindow.isDestroyed()) {
        autoConnectChoiceDialogWindow.webContents.send('auto-connect-choice:init', {
          ...data,
          responseChannel
        });
      }
    });

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      autoConnectChoiceDialogWindow,
      () => {
        windowManager.setAutoConnectChoiceDialogWindow(null);
        // Clean up IPC handlers
        if (handlerActive) {
          handlerActive = false;
          ipcMain.removeHandler(responseChannel);
          
          // Only clean up global handler if it's the current one
          if (globalResponseChannelHandler === handleGetResponseChannel) {
            ipcMain.removeHandler('auto-connect-choice:get-response-channel');
            globalResponseChannelHandler = null;
          }
          
          resolve(null);
        }
      }
    );

    setupDevTools(autoConnectChoiceDialogWindow);
    windowManager.setAutoConnectChoiceDialogWindow(autoConnectChoiceDialogWindow);
  });
};

// Global handler state for connect choice dialog to prevent duplicate registrations
let globalConnectChoiceHandler: ((_event: unknown) => Promise<ConnectChoiceDialogData & { responseChannel: string }>) | null = null;

/**
 * Create the connect choice dialog window
 * @param data - Dialog initialization data
 * @returns Promise that resolves with user choice or null if cancelled
 */
export const createConnectChoiceDialog = (data: ConnectChoiceDialogData): Promise<string | null> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    if (!validateParentWindow(mainWindow, 'connect choice dialog')) {
      resolve(null);
      return;
    }

    // Generate unique dialog ID and response channel
    const dialogId = generateDialogId();
    const responseChannel = createResponseChannelName(dialogId);
    let handlerActive = true;

    // Create the dialog window
    const connectChoiceDialogWindow = createModalWindow(
      mainWindow,
      WINDOW_SIZES.CONNECT_CHOICE,
      createPreloadPath(path.join(__dirname, '../../ui/connect-choice-dialog/connect-choice-dialog-preload.js')),
      { resizable: false, frame: false, transparent: true }
    );

    // Set up response handler using handle/invoke pattern
    const handleResponse = async (_event: unknown, result: { action: string } | null): Promise<void> => {
      if (!handlerActive) return;
      
      handlerActive = false;
      ipcMain.removeHandler(responseChannel);
      
      // Close dialog window
      if (connectChoiceDialogWindow && !connectChoiceDialogWindow.isDestroyed()) {
        connectChoiceDialogWindow.close();
      }
      
      // Resolve promise with result
      resolve(result?.action || null);
    };

    // Set up response channel provider - only register if not already registered
    const handleGetResponseChannel = async (_event: unknown): Promise<ConnectChoiceDialogData & { responseChannel: string }> => {
      return {
        ...data,
        responseChannel
      };
    };

    // Register the unique response handler for this dialog instance
    ipcMain.handle(responseChannel, handleResponse);

    // Register the global response channel provider only if not already registered
    if (!globalConnectChoiceHandler) {
      globalConnectChoiceHandler = handleGetResponseChannel;
      ipcMain.handle('connect-choice:get-response-channel', globalConnectChoiceHandler);
    } else {
      // Update the existing handler to use current dialog data
      globalConnectChoiceHandler = handleGetResponseChannel;
      // Remove the old handler and register the new one
      ipcMain.removeHandler('connect-choice:get-response-channel');
      ipcMain.handle('connect-choice:get-response-channel', globalConnectChoiceHandler);
    }

    // Load HTML and setup lifecycle
    void loadWindowHTML(connectChoiceDialogWindow, 'connect-choice-dialog');

    // Initialize dialog when ready
    connectChoiceDialogWindow.webContents.on('did-finish-load', () => {
      if (connectChoiceDialogWindow && !connectChoiceDialogWindow.isDestroyed()) {
        connectChoiceDialogWindow.webContents.send('connect-choice:init', {
          ...data,
          responseChannel
        });
      }
    });

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      connectChoiceDialogWindow,
      () => {
        windowManager.setConnectChoiceDialogWindow(null);
        // Clean up IPC handlers
        if (handlerActive) {
          handlerActive = false;
          ipcMain.removeHandler(responseChannel);
          
          // Only clean up global handler if it's the current one
          if (globalConnectChoiceHandler === handleGetResponseChannel) {
            ipcMain.removeHandler('connect-choice:get-response-channel');
            globalConnectChoiceHandler = null;
          }
          
          resolve(null);
        }
      }
    );

    setupDevTools(connectChoiceDialogWindow);
    windowManager.setConnectChoiceDialogWindow(connectChoiceDialogWindow);
  });
};

/**
 * Create printer connected warning dialog
 * Shows a warning when user tries to connect while already connected to a printer
 * @param data - Printer warning data including printer name
 * @returns Promise that resolves to boolean (true = continue, false = cancel)
 */
export const createPrinterConnectedWarningDialog = (data: PrinterConnectedWarningData): Promise<boolean> => {
  return new Promise((resolve) => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (!validateParentWindow(mainWindow, 'printer connected warning dialog')) {
      resolve(false);
      return;
    }

    // Create the dialog window
    const printerWarningWindow = createModalWindow(
      mainWindow,
      WINDOW_SIZES.PRINTER_CONNECTED_WARNING,
      createPreloadPath(path.join(__dirname, '../../ui/printer-connected-warning/printer-connected-warning-preload.js')),
      { resizable: false, frame: false, transparent: true }
    );

    let isHandled = false;

    // Set up IPC handlers for continue and cancel actions
    const handleContinue = async (): Promise<void> => {
      if (isHandled) return;
      isHandled = true;

      // Clean up handlers
      ipcMain.removeHandler('printer-connected-warning-continue');
      ipcMain.removeHandler('printer-connected-warning-cancel');

      // Close dialog
      if (printerWarningWindow && !printerWarningWindow.isDestroyed()) {
        printerWarningWindow.close();
      }

      resolve(true);
    };

    const handleCancel = async (): Promise<void> => {
      if (isHandled) return;
      isHandled = true;

      // Clean up handlers
      ipcMain.removeHandler('printer-connected-warning-continue');
      ipcMain.removeHandler('printer-connected-warning-cancel');

      // Close dialog
      if (printerWarningWindow && !printerWarningWindow.isDestroyed()) {
        printerWarningWindow.close();
      }

      resolve(false);
    };

    // Register IPC handlers
    ipcMain.handle('printer-connected-warning-continue', handleContinue);
    ipcMain.handle('printer-connected-warning-cancel', handleCancel);

    // Load HTML and setup lifecycle
    void loadWindowHTML(printerWarningWindow, 'printer-connected-warning');

    // Send dialog data when ready
    printerWarningWindow.webContents.on('did-finish-load', () => {
      if (printerWarningWindow && !printerWarningWindow.isDestroyed()) {
        printerWarningWindow.webContents.send('dialog-init', data);
      }
    });

    // Platform detection for styling
    printerWarningWindow.webContents.on('did-finish-load', () => {
      if (printerWarningWindow && !printerWarningWindow.isDestroyed()) {
        printerWarningWindow.webContents.send('platform-info', process.platform);
      }
    });

    // Setup window lifecycle with cleanup
    setupWindowLifecycle(
      printerWarningWindow,
      () => {
        // Clean up if dialog closed without action
        if (!isHandled) {
          isHandled = true;
          ipcMain.removeHandler('printer-connected-warning-continue');
          ipcMain.removeHandler('printer-connected-warning-cancel');
          resolve(false);
        }
      }
    );

    setupDevTools(printerWarningWindow);
  });
};