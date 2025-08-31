/**
 * CoreWindowFactory handles creation of primary application windows including
 * settings and status windows. These windows represent core application
 * functionality and typically have modal behavior relative to the main window.
 * All functions maintain exact compatibility with the original WindowFactory
 * implementation while following consistent patterns for window lifecycle management.
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