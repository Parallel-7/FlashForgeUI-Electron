/**
 * @fileoverview IPC handlers for printer context management.
 *
 * Provides IPC communication layer for multi-printer context management,
 * enabling the renderer process to manage multiple simultaneous printer connections.
 *
 * Key exports:
 * - setupPrinterContextHandlers(): Registers all printer context IPC handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getPrinterContextManager } from '../managers/PrinterContextManager';
import type { PrinterDetails } from '../types/printer';

/**
 * Set up all printer context IPC handlers
 */
export function setupPrinterContextHandlers(): void {
  console.log('Setting up printer context IPC handlers...');

  const contextManager = getPrinterContextManager();

  // Get all printer contexts
  ipcMain.handle('printer-contexts:get-all', async (_event: IpcMainInvokeEvent) => {
    try {
      const contexts = contextManager.getAllContextsInfo();
      return contexts;
    } catch (error) {
      console.error('Failed to get all printer contexts:', error);
      return [];
    }
  });

  // Get active printer context
  ipcMain.handle('printer-contexts:get-active', async (_event: IpcMainInvokeEvent) => {
    try {
      const activeContext = contextManager.getActiveContext();
      if (!activeContext) {
        return null;
      }

      // Convert to serializable info
      return contextManager.getAllContextsInfo().find(ctx => ctx.id === activeContext.id) || null;
    } catch (error) {
      console.error('Failed to get active printer context:', error);
      return null;
    }
  });

  // Switch to a printer context
  ipcMain.handle('printer-contexts:switch', async (_event: IpcMainInvokeEvent, contextId: string) => {
    try {
      if (typeof contextId !== 'string') {
        throw new Error('Invalid context ID');
      }

      contextManager.switchContext(contextId);
      console.log(`Switched to printer context: ${contextId}`);
    } catch (error) {
      console.error('Failed to switch printer context:', error);
      throw error;
    }
  });

  // Remove a printer context (disconnect and cleanup)
  ipcMain.handle('printer-contexts:remove', async (_event: IpcMainInvokeEvent, contextId: string) => {
    try {
      if (typeof contextId !== 'string') {
        throw new Error('Invalid context ID');
      }

      // Import ConnectionFlowManager to properly disconnect
      const { getPrinterConnectionManager } = require('../managers/ConnectionFlowManager') as typeof import('../managers/ConnectionFlowManager');
      const connectionManager = getPrinterConnectionManager();

      // Disconnect the printer (this will also remove the context)
      await connectionManager.disconnectContext(contextId);
      console.log(`Disconnected and removed printer context: ${contextId}`);
    } catch (error) {
      console.error('Failed to remove printer context:', error);
      throw error;
    }
  });

  // Create a new printer context
  ipcMain.handle('printer-contexts:create', async (_event: IpcMainInvokeEvent, printerDetails: unknown) => {
    try {
      // Validate printer details
      if (!printerDetails || typeof printerDetails !== 'object') {
        throw new Error('Invalid printer details');
      }

      const contextId = contextManager.createContext(printerDetails as PrinterDetails);
      console.log(`Created printer context: ${contextId}`);
      return contextId;
    } catch (error) {
      console.error('Failed to create printer context:', error);
      throw error;
    }
  });

  console.log('Printer context IPC handlers registered successfully');
}

/**
 * Set up connection state IPC handlers with context support
 */
export function setupConnectionStateHandlers(): void {
  console.log('Setting up connection state IPC handlers...');

  // Import dynamically to avoid circular dependencies
  const { getConnectionStateManager } = require('../services/ConnectionStateManager') as typeof import('../services/ConnectionStateManager');
  const contextManager = getPrinterContextManager();

  // Check if connected (with optional context ID)
  ipcMain.handle('connection-state:is-connected', async (_event: IpcMainInvokeEvent, contextId?: string) => {
    try {
      const connectionStateManager = getConnectionStateManager();
      const targetContextId = contextId || contextManager.getActiveContextId() || '';
      return connectionStateManager.isConnected(targetContextId);
    } catch (error) {
      console.error('Failed to check connection state:', error);
      return false;
    }
  });

  // Get connection state (with optional context ID)
  ipcMain.handle('connection-state:get-state', async (_event: IpcMainInvokeEvent, contextId?: string) => {
    try {
      const connectionStateManager = getConnectionStateManager();
      const targetContextId = contextId || contextManager.getActiveContextId() || '';
      return connectionStateManager.getState(targetContextId);
    } catch (error) {
      console.error('Failed to get connection state:', error);
      return { state: 'disconnected' };
    }
  });

  console.log('Connection state IPC handlers registered successfully');
}

/**
 * Set up camera IPC handlers with context support
 */
export function setupCameraContextHandlers(): void {
  console.log('Setting up camera context IPC handlers...');

  // Import camera service getter
  const { getCameraProxyService } = require('../services/CameraProxyService') as typeof import('../services/CameraProxyService');

  // Get camera stream URL (with optional context ID)
  ipcMain.handle('camera:get-stream-url', async (_event: IpcMainInvokeEvent, contextId?: string) => {
    try {
      const cameraProxyService = getCameraProxyService();
      if (contextId) {
        return cameraProxyService.getStreamUrlForContext(contextId);
      } else {
        return cameraProxyService.getCurrentStreamUrl();
      }
    } catch (error) {
      console.error('Failed to get camera stream URL:', error);
      return null;
    }
  });

  console.log('Camera context IPC handlers registered successfully');
}

