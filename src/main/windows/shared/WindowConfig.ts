/**
 * @fileoverview WindowConfig holds the helpers every window factory shares:
 * secure web preferences, WINDOW_SIZES-based dimensions, modal window
 * creation, HTML loading, lifecycle wiring, and dialog IPC channel naming.
 *
 * Security invariant: createSecureWebPreferences() gives every window
 * contextIsolation: true and nodeIntegration: false, with the preload script
 * as the only bridge to main-process APIs. Keep it that way for every window.
 */

import { is } from '@electron-toolkit/utils';
import { app, BrowserWindow, WebPreferences } from 'electron';
import path from 'path';
import { getUIWindowOptions, injectUIStyleVariables } from '../../utils/CSSVariables.js';
import { createPreloadPath, PreloadPath, WINDOW_SIZES, WindowDimensions } from './WindowTypes.js';

/**
 * Create standardized secure web preferences for all windows
 * Ensures consistent security settings across the application
 */
export const createSecureWebPreferences = (preloadPath: PreloadPath): WebPreferences => {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
  };
};

/**
 * Get standardized window dimensions for a specific window type
 * Provides consistent sizing across the application
 */
export const getWindowDimensions = (windowType: keyof typeof WINDOW_SIZES): WindowDimensions => {
  const sizes = WINDOW_SIZES[windowType];
  return {
    width: sizes.width,
    height: sizes.height,
    minWidth: sizes.minWidth,
    minHeight: sizes.minHeight,
  };
};

/**
 * Setup development tools for a window
 */
export const setupDevTools = (_window: BrowserWindow): void => {
  // Intentional no-op, kept for API compatibility. Callers that want DevTools
  // (e.g. the main window) open them explicitly.
};

/**
 * Create a base modal window with common configuration
 * Provides consistent modal window behavior and setup
 */
export const createModalWindow = (
  parentWindow: BrowserWindow,
  dimensions: WindowDimensions,
  preloadPath: PreloadPath,
  options: {
    readonly resizable?: boolean;
    readonly frame?: boolean;
    readonly transparent?: boolean;
    readonly useUIConfig?: boolean;
  } = {}
): BrowserWindow => {
  const { resizable = true, frame, transparent, useUIConfig = true } = options;

  const uiOptions = useUIConfig ? getUIWindowOptions() : { frame: true, transparent: false };
  const finalFrame = frame !== undefined ? frame : uiOptions.frame;
  const finalTransparent = transparent !== undefined ? transparent : uiOptions.transparent;

  const window = new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    minWidth: dimensions.minWidth,
    minHeight: dimensions.minHeight,
    parent: parentWindow,
    modal: true,
    frame: finalFrame,
    show: false,
    resizable,
    transparent: finalTransparent,
    webPreferences: createSecureWebPreferences(preloadPath),
  });

  return window;
};

/**
 * Create preload path for a specific UI component
 * Ensures consistent preload path construction
 */
export const createUIPreloadPath = (componentName: string): PreloadPath => {
  // In production, preloads are bundled to out/preload/name-preload.js
  // In development, we also reference the build output because electron-vite handles it
  return createPreloadPath(path.join(app.getAppPath(), 'out', 'preload', `${componentName}-preload.js`));
};

/**
 * Load HTML file for a window with error handling
 * Provides consistent file loading with proper error handling
 */
export const loadWindowHTML = async (
  window: BrowserWindow,
  componentName: string,
  injectUIConfig: boolean = true
): Promise<void> => {
  // Inject CSS variables before loading HTML to ensure they're available when CSS is parsed
  if (injectUIConfig) {
    injectUIStyleVariables(window);
  }

  try {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // In development, load from dev server
      // URL structure matches src directory: src/ui/component/component.html
      const url = `${process.env['ELECTRON_RENDERER_URL']}/src/ui/${componentName}/${componentName}.html`;
      await window.loadURL(url);
    } else {
      // In production, HTML files are in out/renderer/src/ui/component/component.html
      // due to how we configured rollup input options
      const htmlPath = path.join(
        app.getAppPath(),
        'out',
        'renderer',
        'src',
        'ui',
        componentName,
        `${componentName}.html`
      );
      await window.loadFile(htmlPath);
    }
  } catch (error) {
    console.error(`Failed to load HTML for ${componentName}:`, error);
  }
};

/**
 * Setup standard window lifecycle handlers
 * Provides consistent window event handling patterns
 */
export const setupWindowLifecycle = (window: BrowserWindow, onClosed: () => void, onReady?: () => void): void => {
  window.once('ready-to-show', () => {
    window.show();
    if (onReady) {
      onReady();
    }
  });

  window.on('closed', onClosed);
};

/**
 * Generate unique dialog ID for IPC communication
 * Ensures unique identifiers for dialog windows
 */
export const generateDialogId = (): string => {
  return `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create response channel name for dialog communication
 * Provides consistent channel naming for IPC
 */
export const createResponseChannelName = (dialogId: string): string => {
  return `dialog-result-${dialogId}`;
};

/**
 * Validate parent window exists before creating child window
 * Prevents window creation errors and provides consistent error handling
 */
export const validateParentWindow = (
  parentWindow: BrowserWindow | null,
  windowType: string
): parentWindow is BrowserWindow => {
  if (!parentWindow) {
    console.error(`Cannot create ${windowType}: parent window not found`);
    return false;
  }
  return true;
};

/**
 * Focus existing window if it exists, otherwise return false
 * Provides consistent single-instance window behavior
 */
export const focusExistingWindow = (window: BrowserWindow | null): boolean => {
  if (window && !window.isDestroyed()) {
    window.focus();
    return true;
  }
  return false;
};
