/**
 * @fileoverview WindowConfig provides shared utility functions for standardized window
 * configuration across all factory modules.
 *
 * This utility module serves as the foundation for consistent window creation throughout the application,
 * providing reusable functions for security configuration, dimension standardization, HTML loading,
 * lifecycle management, and IPC communication setup. All factory modules depend on these utilities
 * to ensure consistent behavior, security settings, and error handling patterns across different
 * window types. The module centralizes common patterns to reduce code duplication and maintain
 * consistency as the application evolves.
 *
 * Key Features:
 * - Standardized security configuration with contextIsolation and disabled nodeIntegration
 * - Window dimension resolution from WINDOW_SIZES constants for consistent sizing
 * - Modal window creation with parent window relationships and configurable options
 * - Environment-aware HTML loading with proper error handling and CSS variable injection
 * - Lifecycle event handling with ready-to-show and closed event patterns
 * - Development tools setup with automatic DevTools opening in development mode
 * - Unique dialog ID generation for IPC communication channel isolation
 * - Response channel naming conventions for consistent IPC patterns
 * - Parent window validation to prevent creation errors
 * - Existing window focus behavior for single-instance enforcement
 * - UI configuration integration for frame and transparency settings
 *
 * Core Responsibilities:
 * - Provide secure web preferences factory for all BrowserWindows (preload, contextIsolation, no nodeIntegration)
 * - Generate standardized window dimensions from WINDOW_SIZES constants
 * - Create modal windows with consistent parent relationships and security settings
 * - Load HTML files from src directory structure with environment awareness
 * - Setup standard window lifecycle handlers for ready-to-show and closed events
 * - Configure development tools automatically based on NODE_ENV
 * - Generate unique dialog IDs for IPC channel isolation between dialog instances
 * - Create response channel names following consistent naming conventions
 * - Validate parent window existence before child window creation
 * - Focus existing windows to enforce single-instance behavior
 *
 * Security Configuration:
 * - contextIsolation: true - Isolates renderer context from Electron APIs
 * - nodeIntegration: false - Prevents Node.js API access in renderer
 * - preload scripts: Required for all windows to expose safe IPC APIs
 *
 * Window Creation Options:
 * - resizable: Configurable per window type (default: true)
 * - frame: Configurable based on UI settings or explicit override (default: true)
 * - transparent: Configurable based on UI settings or explicit override (default: false)
 * - useUIConfig: Whether to use RoundedUI setting for frame/transparency (default: true)
 *
 * Lifecycle Event Patterns:
 * - ready-to-show: Show window and execute onReady callback
 * - closed: Execute onClosed callback for cleanup and WindowManager deregistration
 *
 * IPC Communication Utilities:
 * - Dialog ID format: `dialog-${timestamp}-${random9char}`
 * - Response channel format: `dialog-result-${dialogId}`
 *
 * HTML Loading:
 * - Injects CSS variables before loading HTML to ensure availability during CSS parsing
 * - Loads HTML files from src/ui/ directory structure (not copied to lib during build)
 * - Provides error handling with console logging for load failures
 *
 * @exports createSecureWebPreferences - Create standardized secure web preferences
 * @exports getWindowDimensions - Get standardized window dimensions for a window type
 * @exports setupDevTools - Setup development tools for a window
 * @exports createModalWindow - Create a base modal window with common configuration
 * @exports createUIPreloadPath - Create preload path for a specific UI component
 * @exports loadWindowHTML - Load HTML file for a window with error handling
 * @exports setupWindowLifecycle - Setup standard window lifecycle handlers
 * @exports generateDialogId - Generate unique dialog ID for IPC communication
 * @exports createResponseChannelName - Create response channel name for dialog communication
 * @exports validateParentWindow - Validate parent window exists before creating child window
 * @exports focusExistingWindow - Focus existing window if it exists
 */

import { BrowserWindow, WebPreferences } from 'electron';
import * as path from 'path';
import { 
  WindowDimensions, 
  PreloadPath, 
  createPreloadPath,
  WINDOW_SIZES 
} from './WindowTypes';
import { getUIWindowOptions, injectUIStyleVariables } from '../../utils/CSSVariables';

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
    readonly transparent?: boolean;
    readonly useUIConfig?: boolean;
  } = {}
): BrowserWindow => {
  const { resizable = true, frame, transparent, useUIConfig = true } = options;
  
  // Determine final window options with backward compatibility
  let finalFrame: boolean;
  let finalTransparent: boolean;
  
  if (frame !== undefined || transparent !== undefined) {
    // Backward compatibility: use explicit frame/transparent values if provided
    finalFrame = frame !== undefined ? frame : true;
    finalTransparent = transparent !== undefined ? transparent : false;
  } else if (useUIConfig) {
    // New behavior: use UI configuration based on RoundedUI setting
    const uiOptions = getUIWindowOptions();
    finalFrame = uiOptions.frame;
    finalTransparent = uiOptions.transparent;
  } else {
    // Default values
    finalFrame = true;
    finalTransparent = false;
  }
  
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
  componentName: string,
  injectUIConfig: boolean = true
): Promise<void> => {
  // Inject CSS variables before loading HTML to ensure they're available when CSS is parsed
  if (injectUIConfig) {
    injectUIStyleVariables(window);
  }
  
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