/**
 * IPC handlers for WebUI server control.
 * Provides main process API for starting/stopping the web server and getting status.
 * Integrates with WebUIManager to control server lifecycle from renderer process.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getWebUIManager } from '../../webui/server/WebUIManager';
import { toAppError } from '../../utils/error.utils';

/**
 * Result for WebUI operations
 */
interface WebUIResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Register WebUI IPC handlers
 */
export function registerWebUIHandlers(): void {
  const webUIManager = getWebUIManager();
  
  /**
   * Start the WebUI server
   */
  ipcMain.handle('webui:start', async (_event: IpcMainInvokeEvent): Promise<WebUIResult> => {
    try {
      const started = await webUIManager.start();
      
      if (started) {
        const status = webUIManager.getStatus();
        return {
          success: true,
          data: {
            url: status.url,
            port: status.port
          }
        };
      } else {
        return {
          success: false,
          error: 'WebUI server failed to start'
        };
      }
    } catch (error) {
      const appError = toAppError(error);
      return {
        success: false,
        error: appError.message
      };
    }
  });
  
  /**
   * Stop the WebUI server
   */
  ipcMain.handle('webui:stop', async (_event: IpcMainInvokeEvent): Promise<WebUIResult> => {
    try {
      const stopped = await webUIManager.stop();
      
      return {
        success: stopped,
        error: stopped ? undefined : 'Failed to stop WebUI server'
      };
    } catch (error) {
      const appError = toAppError(error);
      return {
        success: false,
        error: appError.message
      };
    }
  });
  
  /**
   * Get WebUI server status
   */
  ipcMain.handle('webui:get-status', (_event: IpcMainInvokeEvent): WebUIResult => {
    try {
      const status = webUIManager.getStatus();
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      const appError = toAppError(error);
      return {
        success: false,
        error: appError.message
      };
    }
  });
  
  /**
   * Broadcast printer status to WebUI clients
   * This is called from the polling service to forward status updates
   */
  ipcMain.handle('webui:broadcast-status', async (_event: IpcMainInvokeEvent, status: unknown): Promise<WebUIResult> => {
    try {
      if (!webUIManager.isServerRunning()) {
        return {
          success: false,
          error: 'WebUI server is not running'
        };
      }
      
      // Forward status to WebSocket clients
      const httpServer = webUIManager.getHttpServer();
      if (httpServer) {
        httpServer.emit('printer-status-update', { status });
      }
      
      return {
        success: true
      };
    } catch (error) {
      const appError = toAppError(error);
      return {
        success: false,
        error: appError.message
      };
    }
  });
  
  console.log('WebUI IPC handlers registered');
}

/**
 * Unregister WebUI IPC handlers
 */
export function unregisterWebUIHandlers(): void {
  ipcMain.removeAllListeners('webui:start');
  ipcMain.removeAllListeners('webui:stop');
  ipcMain.removeAllListeners('webui:get-status');
  ipcMain.removeAllListeners('webui:broadcast-status');
  
  console.log('WebUI IPC handlers unregistered');
}
