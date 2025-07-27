/**
 * WindowConfig provides shared utility functions for standardized window
 * configuration across all factory modules. This module ensures consistent
 * security settings, window dimensions, development tools setup, and modal
 * window creation patterns throughout the application.
 */

import { BrowserWindow, WebPreferences } from 'electron';
import * as path from 'path';
import { 
  WindowDimensions, 
  PreloadPath, 
  createPreloadPath,
  WINDOW_SIZES 
} from './WindowTypes';

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
    minHeight: sizes.minHeight
  };
};

/**
 * Setup development tools for a window if in development mode
 * Centralizes dev tools configuration logic
 */
export const setupDevTools = (window: BrowserWindow): void => {
  if (process.env.NODE_ENV === 'development') {
    window.webContents.openDevTools();
  }
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
  } = {}
): BrowserWindow => {
  const { resizable = true, frame = false } = options;
  
  return new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    minWidth: dimensions.minWidth,
    minHeight: dimensions.minHeight,
    parent: parentWindow,
    modal: true,
    frame,
    show: false,
    resizable,
    webPreferences: createSecureWebPreferences(preloadPath),
  });
};

/**
 * Create preload path for a specific UI component
 * Ensures consistent preload path construction
 */
export const createUIPreloadPath = (componentName: string): PreloadPath => {
  return createPreloadPath(
    path.join(__dirname, `../../ui/${componentName}/${componentName}-preload.js`)
  );
};

/**
 * Load HTML file for a window with error handling
 * Provides consistent file loading with proper error handling
 */
export const loadWindowHTML = async (
  window: BrowserWindow, 
  componentName: string
): Promise<void> => {
  // HTML files remain in src directory, not copied to lib during compilation
  // From lib/windows/shared/ we need to go up to project root, then to src/ui/
  const htmlPath = path.join(__dirname, `../../../src/ui/${componentName}/${componentName}.html`);
  await window.loadFile(htmlPath).catch(console.error);
};

/**
 * Setup standard window lifecycle handlers
 * Provides consistent window event handling patterns
 */
export const setupWindowLifecycle = (
  window: BrowserWindow,
  onClosed: () => void,
  onReady?: () => void
): void => {
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