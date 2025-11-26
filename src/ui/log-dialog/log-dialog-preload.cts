/**
 * @fileoverview Log Dialog Preload Script
 * 
 * This preload script provides a secure bridge between the main process and the
 * log dialog renderer process. It exposes APIs for:
 * - Requesting current log messages from the main process
 * - Clearing log messages
 * - Receiving real-time log updates
 * - Window control operations
 * 
 * The script follows the project's security pattern of using contextBridge
 * to expose only necessary APIs while maintaining context isolation.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Ensure this file is treated as a module
export {};

// Define the interface for log messages
interface LogMessage {
  timestamp: string;
  message: string;
}

// Expose log dialog API to renderer process
contextBridge.exposeInMainWorld('logDialogAPI', {
  // Request current log messages from main process
  requestLogs: (): Promise<LogMessage[]> => ipcRenderer.invoke('log-dialog-request-logs'),
  
  // Clear all log messages
  clearLogs: (): Promise<boolean> => ipcRenderer.invoke('log-dialog-clear-logs'),
  
  // Close the log dialog window
  closeWindow: (): void => ipcRenderer.send('log-dialog-close-window'),
  
  // Listen for new log messages
  onLogMessage: (callback: (message: LogMessage) => void) => {
    ipcRenderer.on('log-dialog-new-message', (_event, message) => callback(message));
  },
  
  // Remove all listeners
  removeListeners: (): void => {
    ipcRenderer.removeAllListeners('log-dialog-new-message');
  }
,
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});

// Generic window controls for sub-windows (matches IFS dialog interface)
contextBridge.exposeInMainWorld('windowControls', {
  minimize: (): void => ipcRenderer.send('dialog-window-minimize'),
  close: (): void => ipcRenderer.send('dialog-window-close'),
  closeGeneric: (): void => ipcRenderer.send('close-current-window')
});
