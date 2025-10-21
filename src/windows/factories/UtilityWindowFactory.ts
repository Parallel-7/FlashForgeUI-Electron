/**
 * @fileoverview UtilityWindowFactory handles creation of application feature windows including
 * job management, printer selection, and command interfaces.
 *
 * This factory module provides creation functions for utility windows that support core application
 * functionality such as file management, printer configuration, and command execution. All windows
 * are created as modal children of the main window with standardized lifecycle management, WindowManager
 * state tracking, and consistent patterns for single-instance enforcement with focus-on-existing behavior.
 * The module also handles special initialization requirements like polling coordination for job picker
 * and thumbnail request cleanup.
 *
 * Key Features:
 * - Single-instance enforcement with focus-on-existing behavior to prevent duplicates
 * - Standardized window dimensions using WINDOW_SIZES constants from WindowTypes
 * - Consistent security configuration with contextIsolation and no nodeIntegration
 * - Automatic WindowManager registration and cleanup on window close
 * - Development tools integration with automatic DevTools opening in development mode
 * - Environment-aware HTML loading from src directory structure
 * - Special lifecycle handling for job picker (polling pause/resume, thumbnail cleanup)
 * - Initialization data passing via IPC for windows requiring startup configuration
 *
 * Core Responsibilities:
 * - Create job uploader window for file upload interface with drag-and-drop support
 * - Create job picker window for file selection from printer (local or recent files)
 * - Create printer selection window for printer management and configuration
 * - Create send commands window for direct printer command interface
 * - Enforce single-instance behavior by focusing existing windows when creation is attempted
 * - Register windows with WindowManager for centralized state management
 * - Setup proper lifecycle handlers for cleanup on window close events
 * - Validate parent window existence before creating child windows to prevent errors
 * - Handle special initialization requirements (polling coordination, thumbnail cleanup)
 *
 * Window Creation Pattern:
 * 1. Check for existing window and focus if present (single-instance enforcement)
 * 2. Validate parent window exists to prevent creation errors
 * 3. Perform special pre-creation tasks (e.g., pause polling for job picker)
 * 4. Get standardized dimensions from WINDOW_SIZES constant
 * 5. Create UI preload path for the specific component
 * 6. Create modal window with standard security configuration
 * 7. Load HTML file from src directory structure
 * 8. Setup lifecycle handlers with special cleanup tasks
 * 9. Setup development tools if in development mode
 * 10. Register window with WindowManager for state tracking
 * 11. Send initialization data if required (e.g., isRecentFiles for job picker)
 *
 * Special Handling:
 * - Job Picker: Pauses polling during window lifetime to prevent TCP socket conflicts with thumbnail loading,
 *   resumes polling on close, cancels pending thumbnail requests on close, sends initialization data for
 *   recent vs. local file mode
 * - Job Uploader: Standard modal window with file selection and upload interface
 * - Printer Selection: Resizable window for printer management and configuration
 * - Send Commands: Resizable window for direct printer command execution and debugging
 *
 * Window Specifications:
 * - Job Uploader: 950x720 (min 875x650), non-resizable, frameless, transparent
 * - Job Picker: 600x500 (min 500x400), resizable, frameless, transparent
 * - Printer Selection: 500x400 (min 450x350), resizable, frameless, transparent
 * - Send Commands: 600x500 (min 500x400), resizable, frameless, transparent
 *
 * @exports createJobUploaderWindow - Create job uploader window for file upload
 * @exports createJobPickerWindow - Create job picker window for file selection
 * @exports createPrinterSelectionWindow - Create printer selection window for configuration
 * @exports createSendCommandsWindow - Create send commands window for direct printer control
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
