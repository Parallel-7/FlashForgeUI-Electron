/**
 * @fileoverview UtilityWindowFactory creates the feature windows: job
 * uploader, job picker, printer selection, send commands, and the SFTP file
 * manager. Each is a modal child of the main window, registered with
 * WindowManager, and single-instance — creating one while it is open just
 * focuses the existing window.
 *
 * Job picker quirk: while it is open, main-process polling is paused to avoid
 * TCP socket conflicts with thumbnail loading, and pending thumbnail requests
 * are cancelled when it closes.
 */

import { getMainProcessPollingCoordinator } from '../../services/MainProcessPollingCoordinator.js';
import { getThumbnailRequestQueue } from '../../services/ThumbnailRequestQueue.js';
import {
  createModalWindow,
  createUIPreloadPath,
  focusExistingWindow,
  getWindowDimensions,
  loadWindowHTML,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
} from '../shared/WindowConfig.js';
import { JobPickerInitData } from '../shared/WindowTypes.js';
import { getWindowManager } from '../WindowManager.js';

/**
 * Create the job uploader window with modal behavior and WindowManager integration
 * Provides file upload interface with proper parent window relationship
 */
export const createJobUploaderWindow = (): void => {
  const windowManager = getWindowManager();

  // Check for existing window and focus if present
  if (windowManager.hasJobUploaderWindow()) {
    const existingWindow = windowManager.getJobUploaderWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'job uploader window')) {
    return;
  }

  // Create window with standardized configuration
  const dimensions = getWindowDimensions('JOB_UPLOADER');
  const preloadPath = createUIPreloadPath('job-uploader');

  const jobUploaderWindow = createModalWindow(mainWindow, dimensions, preloadPath, { resizable: false, frame: false });

  // Load HTML content
  void loadWindowHTML(jobUploaderWindow, 'job-uploader');

  // Setup lifecycle handlers
  setupWindowLifecycle(jobUploaderWindow, () => windowManager.setJobUploaderWindow(null));

  // Setup development tools
  setupDevTools(jobUploaderWindow);

  // Register with WindowManager
  windowManager.setJobUploaderWindow(jobUploaderWindow);
};

/**
 * Create the job picker window with parameter handling and initialization data
 * Provides file selection interface with proper data initialization via IPC
 * @param isRecentFiles - Whether to show recent files or local files
 */
export const createJobPickerWindow = (isRecentFiles: boolean = false): void => {
  const windowManager = getWindowManager();
  const pollingCoordinator = getMainProcessPollingCoordinator();

  // Check for existing window and focus if present
  if (windowManager.hasJobPickerWindow()) {
    const existingWindow = windowManager.getJobPickerWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'job picker window')) {
    return;
  }

  // Pause polling to prevent TCP socket conflicts during thumbnail loading
  pollingCoordinator.pausePolling();

  // Create window with standardized configuration
  const dimensions = getWindowDimensions('JOB_PICKER');
  const preloadPath = createUIPreloadPath('job-picker');

  const jobPickerWindow = createModalWindow(mainWindow, dimensions, preloadPath, { resizable: true, frame: false });

  // Load HTML content
  void loadWindowHTML(jobPickerWindow, 'job-picker');

  // Send initialization data to the job picker when ready
  jobPickerWindow.webContents.on('did-finish-load', () => {
    if (jobPickerWindow && !jobPickerWindow.isDestroyed()) {
      const initData: JobPickerInitData = { isRecentFiles };
      jobPickerWindow.webContents.send('job-picker-init', initData);
    }
  });

  // Setup lifecycle handlers with special cleanup tasks
  setupWindowLifecycle(jobPickerWindow, () => {
    // Cancel pending thumbnail requests
    const thumbnailQueue = getThumbnailRequestQueue();
    thumbnailQueue.cancelAll();
    console.log('[JobPicker] Cancelled pending thumbnail requests on window close');

    // Resume polling when job picker closes
    pollingCoordinator.resumePolling();
    windowManager.setJobPickerWindow(null);
  });

  // Setup development tools
  setupDevTools(jobPickerWindow);

  // Register with WindowManager
  windowManager.setJobPickerWindow(jobPickerWindow);
};

/**

 * Create the printer selection window with resizable window configuration
 * Provides printer management interface with proper WindowManager state tracking
 */
export const createPrinterSelectionWindow = (): void => {
  const windowManager = getWindowManager();

  // Check for existing window and focus if present
  if (windowManager.hasPrinterSelectionWindow()) {
    const existingWindow = windowManager.getPrinterSelectionWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'printer selection window')) {
    return;
  }

  // Create window with standardized configuration
  const dimensions = getWindowDimensions('PRINTER_SELECTION');
  const preloadPath = createUIPreloadPath('printer-selection');

  const printerSelectionWindow = createModalWindow(mainWindow, dimensions, preloadPath, {
    resizable: true,
    frame: false,
  });

  // Load HTML content
  void loadWindowHTML(printerSelectionWindow, 'printer-selection');

  // Setup lifecycle handlers
  setupWindowLifecycle(printerSelectionWindow, () => windowManager.setPrinterSelectionWindow(null));

  // Setup development tools
  setupDevTools(printerSelectionWindow);

  // Register with WindowManager
  windowManager.setPrinterSelectionWindow(printerSelectionWindow);
};

/**
 * Create the send commands window with proper parent window handling
 * Provides command interface with maintained error handling and WindowManager state tracking
 */
export const createSendCommandsWindow = (): void => {
  const windowManager = getWindowManager();

  // Check for existing window and focus if present
  if (windowManager.hasSendCommandsWindow()) {
    const existingWindow = windowManager.getSendCommandsWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'send commands window')) {
    return;
  }

  // Create window with standardized configuration
  const dimensions = getWindowDimensions('SEND_COMMANDS');
  const preloadPath = createUIPreloadPath('send-cmds');

  const sendCommandsWindow = createModalWindow(mainWindow, dimensions, preloadPath, { resizable: true, frame: false });

  // Load HTML content
  void loadWindowHTML(sendCommandsWindow, 'send-cmds');

  // Setup lifecycle handlers
  setupWindowLifecycle(sendCommandsWindow, () => windowManager.setSendCommandsWindow(null));

  // Setup development tools
  setupDevTools(sendCommandsWindow);

  // Register with WindowManager
  windowManager.setSendCommandsWindow(sendCommandsWindow);
};

/**
 * Create the SFTP file manager window for browsing printer storage
 * Provides thumbnail grid with delete/rename support for internal + USB storage
 */
export const createFileManagerWindow = (): void => {
  const windowManager = getWindowManager();

  // Check for existing window and focus if present
  if (windowManager.hasFileManagerWindow()) {
    const existingWindow = windowManager.getFileManagerWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'file manager window')) {
    return;
  }

  // Create window with standardized configuration
  const dimensions = getWindowDimensions('FILE_MANAGER');
  const preloadPath = createUIPreloadPath('file-manager');

  const fileManagerWindow = createModalWindow(mainWindow, dimensions, preloadPath, { resizable: true, frame: false });

  // Load HTML content
  void loadWindowHTML(fileManagerWindow, 'file-manager');

  // Setup lifecycle handlers
  setupWindowLifecycle(fileManagerWindow, () => windowManager.setFileManagerWindow(null));

  // Setup development tools
  setupDevTools(fileManagerWindow);

  // Register with WindowManager
  windowManager.setFileManagerWindow(fileManagerWindow);
};
