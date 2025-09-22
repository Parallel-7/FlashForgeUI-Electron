/**
 * Central registration point for all IPC handlers.
 * Coordinates the registration of domain-specific handler modules.
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
}
