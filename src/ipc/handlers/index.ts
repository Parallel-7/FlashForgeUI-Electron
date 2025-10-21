/**
 * @fileoverview Central registration point for all IPC handlers in the application.
 *
 * Provides unified registration of all domain-specific IPC handler modules:
 * - Connection handlers for printer discovery and connection management
 * - Backend handlers for printer status and data retrieval
 * - Job handlers for job management and file operations
 * - Dialog handlers for application dialogs and window management
 * - Material handlers for material station operations
 * - Control handlers for printer control commands
 * - WebUI handlers for web server control
 * - Camera handlers for camera streaming operations
 * - Printer settings handlers for per-printer configuration
 *
 * Key exports:
 * - AppManagers interface: Required managers for IPC handler initialization
 * - registerAllIpcHandlers(): Main registration function called during app initialization
 *
 * This module serves as the single entry point for IPC handler registration, ensuring
 * consistent initialization order and dependency injection for all handler modules.
 */

import type { ConfigManager } from '../../managers/ConfigManager';
import type { ConnectionFlowManager } from '../../managers/ConnectionFlowManager';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager';
import type { getWindowManager } from '../../windows/WindowManager';

type WindowManager = ReturnType<typeof getWindowManager>;
import { registerConnectionHandlers } from './connection-handlers';
import { registerBackendHandlers } from './backend-handlers';
import { registerJobHandlers } from './job-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import { registerMaterialHandlers } from './material-handlers';
import { registerControlHandlers } from './control-handlers';
import { registerWebUIHandlers } from './webui-handlers';
import { registerCameraHandlers } from './camera-handlers';
import { initializePrinterSettingsHandlers } from './printer-settings-handlers';

/**
 * Application managers required by IPC handlers
 */
export interface AppManagers {
  configManager: ConfigManager;
  connectionManager: ConnectionFlowManager;
  backendManager: PrinterBackendManager;
  windowManager: WindowManager;
}

/**
 * Register all IPC handlers for the application.
 * This function is called once during app initialization.
 */
export function registerAllIpcHandlers(managers: AppManagers): void {
  const { configManager, connectionManager, backendManager, windowManager } = managers;

  // Register domain-specific handlers
  registerConnectionHandlers(connectionManager, windowManager);
  registerBackendHandlers(backendManager, windowManager);
  registerJobHandlers(backendManager, windowManager);
  registerDialogHandlers(configManager, windowManager);
  registerMaterialHandlers(backendManager);
  registerControlHandlers(backendManager);
  registerWebUIHandlers();
  registerCameraHandlers(managers);
  initializePrinterSettingsHandlers();
}

