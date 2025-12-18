/**
 * @fileoverview Factory for creating component dialog windows
 *
 * Creates modal dialog windows that display individual grid components.
 * Each component is rendered in its own dialog with full real-time functionality,
 * receiving polling updates just like grid-based components.
 *
 * Dialog specifications:
 * - Size: Component-specific (e.g., 500x400 for temperature controls)
 * - Modal: true (blocks main window)
 * - Frameless: true
 * - Transparent: true
 * - Resizable: true
 *
 * Communication pattern:
 * - Dialog receives componentId on creation
 * - Component is instantiated in dialog renderer
 * - Dialog listens to same 'polling-update' channel as main window
 * - ComponentManager in dialog distributes updates to component
 *
 * @author FlashForgeUI Team
 * @module windows/factories/ComponentDialogWindowFactory
 */

import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWindowManager } from '../WindowManager.js';
import {
  createWindowWidth,
  createWindowHeight,
  createWindowMinWidth,
  createWindowMinHeight,
} from '../shared/WindowTypes.js';
import {
  createModalWindow,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
  loadWindowHTML,
  createUIPreloadPath,
} from '../shared/WindowConfig.js';
import { getLogService, type LogMessage } from '../../services/LogService.js';

const _dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Component dialog size configuration
 * Maps component IDs to their preferred dialog dimensions
 */
const COMPONENT_DIALOG_SIZES: Record<
  string,
  { width: number; height: number }
> = {
  'temperature-controls': { width: 500, height: 400 },
  'camera-preview': { width: 960, height: 720 },
  'job-stats': { width: 700, height: 600 },
  'printer-status': { width: 550, height: 450 },
  'model-preview': { width: 840, height: 720 },
  'additional-info': { width: 500, height: 400 },
  'log-panel': { width: 850, height: 650 },
  'controls-grid': { width: 600, height: 500 },
  'filtration-controls': { width: 500, height: 400 },
  // Default size for unknown components
  default: { width: 600, height: 500 },
};

/**
 * Create component dialog window
 *
 * Opens a modal dialog displaying a single grid component with full functionality.
 * The component receives real-time polling updates and works identically to its
 * grid counterpart.
 *
 * @param componentId - ID of component to display
 * @returns BrowserWindow instance
 *
 * @example
 * ```typescript
 * import { createComponentDialog } from './ComponentDialogWindowFactory';
 *
 * // Open temperature controls dialog
 * const dialog = createComponentDialog('temperature-controls');
 * ```
 */
export function createComponentDialog(componentId: string): BrowserWindow {
  const windowManager = getWindowManager();
  const mainWindow = windowManager.getMainWindow();

  if (!validateParentWindow(mainWindow, 'component dialog')) {
    throw new Error('Main window not available for component dialog');
  }

  // Get size for this component
  const size =
    COMPONENT_DIALOG_SIZES[componentId] || COMPONENT_DIALOG_SIZES.default;

  // Create modal dialog
  const dialogWindow = createModalWindow(
    mainWindow,
    {
      width: createWindowWidth(size.width),
      height: createWindowHeight(size.height),
      minWidth: createWindowMinWidth(size.width - 100),
      minHeight: createWindowMinHeight(size.height - 100),
    },
    createUIPreloadPath('component-dialog'),
    {
      resizable: true,
      frame: false,
    }
  );

  let logServiceCleanup: (() => void) | null = null;

  if (componentId === 'log-panel') {
    const logService = getLogService();

    const handleLogMessage = (entry: LogMessage) => {
      if (!dialogWindow.isDestroyed()) {
        dialogWindow.webContents.send('log-dialog-new-message', entry);
      }
    };

    const handleLogsCleared = () => {
      if (!dialogWindow.isDestroyed()) {
        dialogWindow.webContents.send('log-dialog-cleared');
      }
    };

    logService.on('message-added', handleLogMessage);
    logService.on('messages-cleared', handleLogsCleared);

    logServiceCleanup = () => {
      logService.off('message-added', handleLogMessage);
      logService.off('messages-cleared', handleLogsCleared);
    };
  }

  // Load dialog HTML
  void loadWindowHTML(dialogWindow, 'component-dialog');

  // Send component ID once loaded
  dialogWindow.webContents.once('did-finish-load', () => {
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      dialogWindow.webContents.send('component-dialog:init', componentId);
    }
  });

  // Track in window manager
  windowManager.setComponentDialogWindow(dialogWindow);

  // Setup lifecycle with cleanup
  setupWindowLifecycle(dialogWindow, () => {
    windowManager.setComponentDialogWindow(null);
    if (logServiceCleanup) {
      logServiceCleanup();
      logServiceCleanup = null;
    }
  });

  setupDevTools(dialogWindow);

  return dialogWindow;
}
