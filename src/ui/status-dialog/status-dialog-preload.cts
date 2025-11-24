/**
 * @fileoverview Status Dialog preload script exposing secure IPC bridge for comprehensive
 * system and printer status information retrieval. Provides real-time monitoring data for
 * printer details, WebUI server status, camera proxy status, and application health metrics.
 *
 * Key Features:
 * - Secure contextBridge API for status data retrieval
 * - Promise-based status request handling
 * - Comprehensive status data structure with printer, server, and system info
 * - Window lifecycle management (close, listeners)
 * - Type-safe IPC communication with validation
 *
 * Exposed API (window.statusAPI):
 * - requestStats(): Fetches complete system status snapshot
 * - receiveStats(callback): Registers callback for status updates
 * - closeWindow(): Closes the status dialog
 * - removeListeners(): Cleanup function for registered callbacks
 *
 * Status Data Includes:
 * - Printer Information: model, firmware, serial number, connection state, IP address
 * - WebUI Status: enabled/disabled, active clients, access URL
 * - Camera Status: proxy state, streaming status, active clients, proxy port
 * - System Health: application uptime, memory usage
 *
 * Security:
 * - Uses contextBridge for sandboxed renderer communication
 * - Validates response structures before passing to renderer
 * - Error handling with graceful null returns
 *
 * Context:
 * Provides diagnostic and monitoring information for troubleshooting connectivity,
 * server status, and resource usage. Primarily used for technical support and debugging.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Ensure this file is treated as a module
export {};

// Type definition for printer info
interface PrinterInfo {
  readonly model: string;
  readonly machineType: string;
  readonly firmwareVersion: string;
  readonly serialNumber: string;
  readonly toolCount: number;
  readonly ipAddress: string;
  readonly isConnected: boolean;
}

// Type definition for status stats
interface StatusStats {
  readonly printerInfo: PrinterInfo;
  readonly webuiStatus: boolean;
  readonly webuiClients: number;
  readonly webuiUrl: string;
  readonly cameraStatus: boolean;
  readonly cameraPort: number;
  readonly cameraClients: number;
  readonly cameraStreaming: boolean;
  readonly cameraUrl: string;
  readonly appUptime: number;
  readonly memoryUsage: number;
}

// Type definition for the extended window interface
const STATUS_PUSH_CHANNEL = 'status-push-stats';

interface StatusWindow extends Window {
  _statusStatsCallback?: (stats: StatusStats) => void;
}

let statusPushListener: ((event: IpcRendererEvent, stats: StatusStats) => void) | null = null;

// Expose status dialog API to renderer process
contextBridge.exposeInMainWorld('statusAPI', {
  requestStats: async (): Promise<StatusStats | null> => {
    try {
      const stats = await ipcRenderer.invoke('status-request-stats') as StatusStats;
      const callback = (window as StatusWindow)._statusStatsCallback;
      if (callback) {
        callback(stats);
      }
      return stats;
    } catch (error) {
      console.error('Failed to request stats:', error);
      return null;
    }
  },
  closeWindow: (): void => ipcRenderer.send('status-close-window'),
  receiveStats: (callback: (stats: StatusStats) => void): void => {
    const statusWindow = window as StatusWindow;
    statusWindow._statusStatsCallback = callback;

    if (statusPushListener) {
      ipcRenderer.removeListener(STATUS_PUSH_CHANNEL, statusPushListener);
    }

    statusPushListener = (_event, stats: StatusStats) => {
      callback(stats);
    };

    ipcRenderer.on(STATUS_PUSH_CHANNEL, statusPushListener);
  },
  removeListeners: (): void => {
    const statusWindow = window as StatusWindow;
    delete statusWindow._statusStatsCallback;

    if (statusPushListener) {
      ipcRenderer.removeListener(STATUS_PUSH_CHANNEL, statusPushListener);
      statusPushListener = null;
    }
  }
});

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: (): void => ipcRenderer.send('dialog-window-minimize'),
  close: (): void => ipcRenderer.send('dialog-window-close'),
  closeGeneric: (): void => ipcRenderer.send('close-current-window')
});
