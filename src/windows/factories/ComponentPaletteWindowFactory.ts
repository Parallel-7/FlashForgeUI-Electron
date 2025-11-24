/**
 * @fileoverview Component Palette window factory
 *
 * Creates and manages the Component Palette BrowserWindow for GridStack dashboard
 * customization. Implements single-instance pattern, proper window positioning,
 * and lifecycle management following FlashForgeUI window factory patterns.
 *
 * Key exports:
 * - createComponentPaletteWindow(): Create or focus palette window
 * - closeComponentPaletteWindow(): Close palette window if exists
 *
 * Window characteristics:
 * - Frameless, transparent design matching FlashForgeUI aesthetic
 * - Always-on-top for easy access during layout editing
 * - Auto-positioned to right of main window with 10px gap
 * - 280x600px fixed size (non-resizable)
 * - Single instance enforcement (focus existing if already open)
 * - Skips taskbar (utility window)
 *
 * Window creation flow:
 * 1. Check for existing palette window, focus if present
 * 2. Validate main window exists before creation
 * 3. Create BrowserWindow with proper dimensions and settings
 * 4. Position relative to main window bounds
 * 5. Load palette HTML from src directory
 * 6. Setup lifecycle handlers for cleanup
 * 7. Register with WindowManager for state tracking
 * 8. Show window when ready
 *
 * Lifecycle management:
 * - Creation: Single-instance enforcement via WindowManager
 * - Open: Focus existing window if already created
 * - Close: Cleanup WindowManager reference and release resources
 * - Parent: Main window (modal: false to allow interaction with both)
 *
 * Usage:
 * ```typescript
 * import {
 *   createComponentPaletteWindow,
 *   closeComponentPaletteWindow
 * } from './ComponentPaletteWindowFactory';
 *
 * // Open palette (or focus if already open)
 * createComponentPaletteWindow();
 *
 * // Close palette programmatically
 * closeComponentPaletteWindow();
 * ```
 *
 * @module windows/factories/ComponentPaletteWindowFactory
 */

import { BrowserWindow } from 'electron';
import { getWindowManager } from '../WindowManager.js';
import {
  createUIPreloadPath,
  loadWindowHTML,
  setupWindowLifecycle,
  setupDevTools,
  validateParentWindow,
  focusExistingWindow,
  createSecureWebPreferences
} from '../shared/WindowConfig.js';
import { WINDOW_SIZES } from '../shared/WindowTypes.js';

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
    resizable: false,
    show: false,
    webPreferences: createSecureWebPreferences(preloadPath)
  });

  // Position window to the right of main window with 10px gap
  const mainBounds = mainWindow.getBounds();
  paletteWindow.setPosition(
    mainBounds.x + mainBounds.width + 10,
    mainBounds.y
  );

  // Load HTML content
  void loadWindowHTML(paletteWindow, 'palette');

  // Setup lifecycle handlers with WindowManager cleanup
  setupWindowLifecycle(
    paletteWindow,
    () => {
      windowManager.setPaletteWindow(null);
    }
  );

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
