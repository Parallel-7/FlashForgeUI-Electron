/**
 * UtilityWindowFactory handles creation of application feature windows including
 * job management, printer selection, and command interfaces. This module provides
 * consistent patterns for single-instance windows with focus behavior, proper
 * WindowManager integration, and standardized lifecycle management for utility
 * windows that support core application functionality.
 */

import { getWindowManager } from '../WindowManager';
import {
  getWindowDimensions,
  createUIPreloadPath,
  loadWindowHTML,
  setupWindowLifecycle,
  setupDevTools,
  createModalWindow,
  focusExistingWindow,
  validateParentWindow
} from '../shared/WindowConfig';
import { getUIWindowOptions } from '../../utils/CSSVariables';
import { JobPickerInitData } from '../shared/WindowTypes';
import { getMainProcessPollingCoordinator } from '../../services/MainProcessPollingCoordinator';
import { getThumbnailRequestQueue } from '../../services/ThumbnailRequestQueue';

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
  
  const jobUploaderWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: false, frame: false, transparent: true }
  );

  // Load HTML content
  void loadWindowHTML(jobUploaderWindow, 'job-uploader');

  // Setup lifecycle handlers
  setupWindowLifecycle(
    jobUploaderWindow,
    () => windowManager.setJobUploaderWindow(null)
  );

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
  
  const jobPickerWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: true }
  );

  // Load HTML content
  void loadWindowHTML(jobPickerWindow, 'job-picker');

  // Setup lifecycle handlers with initialization data
  setupWindowLifecycle(
    jobPickerWindow,
    () => {
      // Cancel pending thumbnail requests
      const thumbnailQueue = getThumbnailRequestQueue();
      thumbnailQueue.cancelAll();
      console.log('[JobPicker] Cancelled pending thumbnail requests on window close');
      
      // Resume polling when job picker closes
      pollingCoordinator.resumePolling();
      windowManager.setJobPickerWindow(null);
    },
    () => {
      // Send initialization data to the job picker
      // The renderer will handle fetching the actual job data
      const initData: JobPickerInitData = { isRecentFiles };
      jobPickerWindow.webContents.send('job-picker-init', initData);
    }
  );

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
  
  const printerSelectionWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: true }
  );

  // Load HTML content
  void loadWindowHTML(printerSelectionWindow, 'printer-selection');

  // Setup lifecycle handlers
  setupWindowLifecycle(
    printerSelectionWindow,
    () => windowManager.setPrinterSelectionWindow(null)
  );

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
  
  const sendCommandsWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: true }
  );

  // Load HTML content
  void loadWindowHTML(sendCommandsWindow, 'send-cmds');

  // Setup lifecycle handlers
  setupWindowLifecycle(
    sendCommandsWindow,
    () => windowManager.setSendCommandsWindow(null)
  );

  // Setup development tools
  setupDevTools(sendCommandsWindow);

  // Register with WindowManager
  windowManager.setSendCommandsWindow(sendCommandsWindow);
};