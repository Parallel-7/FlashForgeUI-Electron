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
      { resizable: false }
    );

    // Set up response handler using handle/invoke pattern
    const handleResponse = async (_event: unknown, result: string | null): Promise<void> => {
      if (!handlerActive) return;
      
      handlerActive = false;
      ipcMain.removeHandler(responseChannel);
      
      // Close dialog window
      if (inputDialogWindow && !inputDialogWindow.isDestroyed()) {
        inputDialogWindow.close();
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
      createPreloadPath(path.join(__dirname, '../../ui/material-matching-dialog/material-matching-dialog-preload.js'))
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
      { resizable: false }
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
    createPreloadPath(path.join(__dirname, '../../ui/material-info-dialog/material-info-dialog-preload.js'))
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
    createPreloadPath(path.join(__dirname, '../../ui/ifs-dialog/ifs-dialog-preload.js'))
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
      { resizable: false, frame: false }
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