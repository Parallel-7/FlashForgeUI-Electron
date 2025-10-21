/**
 * @fileoverview CoreWindowFactory handles creation of primary application windows including
 * settings, status, and log dialog windows.
 *
 * This factory module provides creation functions for core application windows that represent
 * primary functionality. All windows are created as modal children of the main window with
 * standardized lifecycle management, development tools integration, and WindowManager state
 * tracking. The module maintains exact backward compatibility with the original WindowFactory
 * implementation while providing consistent patterns for window creation and cleanup.
 *
 * Key Features:
 * - Modal window behavior with parent window relationships to the main window
 * - Single-instance enforcement with focus-on-existing behavior to prevent duplicates
 * - Standardized window dimensions using WINDOW_SIZES constants from WindowTypes
 * - Consistent security configuration with contextIsolation and no nodeIntegration
 * - Automatic WindowManager registration and cleanup on window close
 * - Development tools integration with automatic DevTools opening in development mode
 * - Environment-aware HTML loading from src directory structure
 * - Configurable frame and transparency based on UI configuration settings
 *
 * Core Responsibilities:
 * - Create settings window for application configuration with resizable, frameless design
 * - Create status window for detailed printer status display with resizable layout
 * - Create log dialog window for application logging and debugging information
 * - Enforce single-instance behavior by focusing existing windows when creation is attempted
 * - Register windows with WindowManager for centralized state management
 * - Setup proper lifecycle handlers for cleanup on window close events
 * - Validate parent window existence before creating child windows to prevent errors
 *
 * Window Creation Pattern:
 * 1. Check for existing window and focus if present (single-instance enforcement)
 * 2. Validate parent window exists to prevent creation errors
 * 3. Get standardized dimensions from WINDOW_SIZES constant
 * 4. Create UI preload path for the specific component
 * 5. Create modal window with standard security configuration
 * 6. Load HTML file from src directory structure
 * 7. Setup lifecycle handlers for cleanup on close
 * 8. Setup development tools if in development mode
 * 9. Register window with WindowManager for state tracking
 *
 * Window Specifications:
 * - Settings Window: 600x500 (min 500x400), resizable, frameless, transparent
 * - Status Window: 650x600 (min 500x500), resizable, frameless, configurable transparency
 * - Log Dialog: 800x600 (min 600x400), resizable, frameless, configurable transparency
 *
 * @exports createSettingsWindow - Create settings window for application configuration
 * @exports createStatusWindow - Create status window for detailed printer status
 * @exports createLogDialog - Create log dialog for application logging and debugging
 */

import { getWindowManager } from '../WindowManager';
import {
  getWindowDimensions,
  createUIPreloadPath,
  loadWindowHTML,
  setupWindowLifecycle,
  setupDevTools,
  validateParentWindow,
  focusExistingWindow,
  createModalWindow
} from '../shared/WindowConfig';
import { getUIWindowOptions } from '../../utils/CSSVariables';

/**
 * Create the settings window with modal behavior and parent window relationship
 * Maintains single-instance behavior with focus on existing window
 */
export const createSettingsWindow = (): void => {
  const windowManager = getWindowManager();
  
  // Check if settings window already exists and focus it
  if (windowManager.hasSettingsWindow()) {
    const existingWindow = windowManager.getSettingsWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'settings window')) {
    return;
  }

  // Get standardized dimensions and create modal window
  const dimensions = getWindowDimensions('SETTINGS');
  const preloadPath = createUIPreloadPath('settings');
  
  const settingsWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: true }
  );

  // Load HTML file with error handling
  void loadWindowHTML(settingsWindow, 'settings');

  // Setup window lifecycle with WindowManager integration
  setupWindowLifecycle(
    settingsWindow,
    () => {
      windowManager.setSettingsWindow(null);
    }
  );

  // Setup development tools if in development mode
  setupDevTools(settingsWindow);

  // Register window with WindowManager
  windowManager.setSettingsWindow(settingsWindow);
};

/**
 * Create the status window with proper window configuration and lifecycle
 * Maintains single-instance behavior with focus on existing window
 */
export const createStatusWindow = (): void => {
  const windowManager = getWindowManager();
  
  // Check if status window already exists and focus it
  if (windowManager.hasStatusWindow()) {
    const existingWindow = windowManager.getStatusWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'status window')) {
    return;
  }

  // Get standardized dimensions and create modal window
  const dimensions = getWindowDimensions('STATUS');
  const preloadPath = createUIPreloadPath('status-dialog');
  
  const uiOptions = getUIWindowOptions();
  const statusWindow = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: uiOptions.transparent }
  );

  // Load HTML file with error handling
  void loadWindowHTML(statusWindow, 'status-dialog');

  // Setup window lifecycle with WindowManager integration
  setupWindowLifecycle(
    statusWindow,
    () => {
      windowManager.setStatusWindow(null);
    }
  );

  // Setup development tools if in development mode
  setupDevTools(statusWindow);

  // Register window with WindowManager
  windowManager.setStatusWindow(statusWindow);
};

/**
 * Create the log dialog window with proper window configuration and lifecycle
 * Maintains single-instance behavior with focus on existing window
 */
export const createLogDialog = (): void => {
  const windowManager = getWindowManager();
  
  // Check if log dialog already exists and focus it
  if (windowManager.hasLogDialog()) {
    const existingWindow = windowManager.getLogDialog();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'log dialog')) {
    return;
  }

  // Get standardized dimensions and create modal window
  const dimensions = getWindowDimensions('LOG_DIALOG');
  const preloadPath = createUIPreloadPath('log-dialog');
  
  const uiOptions = getUIWindowOptions();
  const logDialog = createModalWindow(
    mainWindow,
    dimensions,
    preloadPath,
    { resizable: true, frame: false, transparent: uiOptions.transparent }
  );

  // Load HTML file with error handling
  void loadWindowHTML(logDialog, 'log-dialog');

  // Setup window lifecycle with WindowManager integration
  setupWindowLifecycle(
    logDialog,
    () => {
      windowManager.setLogDialog(null);
    }
  );

  // Setup development tools if in development mode
  setupDevTools(logDialog);

  // Register window with WindowManager
  windowManager.setLogDialog(logDialog);
};
