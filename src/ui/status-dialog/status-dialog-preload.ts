/**
 * Status dialog preload script that exposes secure APIs for status information
 * and window controls to the renderer process. Handles printer status stats
 * and provides callback mechanisms for real-time updates.
 */

import { contextBridge, ipcRenderer } from 'electron';

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
interface StatusWindow extends Window {
  _statusStatsCallback?: (stats: StatusStats) => void;
}

// Expose status dialog API to renderer process
contextBridge.exposeInMainWorld('statusAPI', {
  requestStats: async (): Promise<StatusStats | null> => {
    try {
      const stats = await ipcRenderer.invoke('status-request-stats') as StatusStats;
      return stats;
    } catch (error) {
      console.error('Failed to request stats:', error);
      return null;
    }
  },
  closeWindow: (): void => ipcRenderer.send('status-close-window'),
  receiveStats: (callback: (stats: StatusStats) => void): void => {
    // Store the callback for use with requestStats
    (window as StatusWindow)._statusStatsCallback = callback;
  },
  removeListeners: (): void => {
    delete (window as StatusWindow)._statusStatsCallback;
  }
});

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: (): void => ipcRenderer.send('dialog-window-minimize'),
  close: (): void => ipcRenderer.send('dialog-window-close'),
  closeGeneric: (): void => ipcRenderer.send('close-current-window')
});