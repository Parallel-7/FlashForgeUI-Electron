/**
 * @fileoverview Creates the Component Palette window used during dashboard
 * editing: a frameless, always-on-top picker docked 10px to the right of the
 * main window. It skips the taskbar and is single-instance — creating it
 * while it is open focuses the existing window. Dimensions come from
 * WINDOW_SIZES.COMPONENT_PALETTE.
 */

import { BrowserWindow } from 'electron';
import {
  createSecureWebPreferences,
  createUIPreloadPath,
  focusExistingWindow,
  loadWindowHTML,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
} from '../shared/WindowConfig.js';
import { WINDOW_SIZES } from '../shared/WindowTypes.js';
import { getWindowManager } from '../WindowManager.js';

/**
 * Create the component palette window with always-on-top floating behavior
 * Provides component drag-and-drop interface for dashboard customization
 */
export const createComponentPaletteWindow = (): void => {
  const windowManager = getWindowManager();

  // Check for existing window and focus if present (single-instance enforcement)
  if (windowManager.hasPaletteWindow()) {
    const existingWindow = windowManager.getPaletteWindow();
    if (focusExistingWindow(existingWindow)) {
      return;
    }
  }

  const mainWindow = windowManager.getMainWindow();
  if (!validateParentWindow(mainWindow, 'component palette window')) {
    return;
  }

  // Get standardized dimensions for palette window
  const dimensions = WINDOW_SIZES.COMPONENT_PALETTE;
  const preloadPath = createUIPreloadPath('palette');

  // Create frameless, always-on-top window with solid background
  // Note: parent is set but modal is false to allow interaction with both windows
  const paletteWindow = new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    minWidth: dimensions.minWidth,
    minHeight: dimensions.minHeight,
    parent: mainWindow,
    modal: false,
    frame: false,
    transparent: false,
    backgroundColor: '#2a2a2a',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: createSecureWebPreferences(preloadPath),
  });

  // Position window to the right of main window with 10px gap
  const mainBounds = mainWindow.getBounds();
  paletteWindow.setPosition(mainBounds.x + mainBounds.width + 10, mainBounds.y);

  // Load HTML content
  void loadWindowHTML(paletteWindow, 'palette');

  // Setup lifecycle handlers with WindowManager cleanup
  setupWindowLifecycle(paletteWindow, () => {
    windowManager.setPaletteWindow(null);
  });

  // Setup development tools
  setupDevTools(paletteWindow);

  // Register with WindowManager
  windowManager.setPaletteWindow(paletteWindow);
};

/**
 * Close the component palette window if it exists
 * Provides programmatic window closure with proper cleanup
 */
export const closeComponentPaletteWindow = (): void => {
  const windowManager = getWindowManager();
  const paletteWindow = windowManager.getPaletteWindow();

  if (paletteWindow && !paletteWindow.isDestroyed()) {
    paletteWindow.close();
  }
};
