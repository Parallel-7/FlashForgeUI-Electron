/**
 * @fileoverview Log Dialog Preload Script
 */

import { contextBridge, ipcRenderer } from 'electron';

interface LogMessage {
  timestamp: string;
  message: string;
}

const logDialogAPI = {
  requestLogs: (): Promise<LogMessage[]> => ipcRenderer.invoke('log-dialog-request-logs'),
  clearLogs: (): Promise<boolean> => ipcRenderer.invoke('log-dialog-clear-logs'),
  closeWindow: (): void => ipcRenderer.send('log-dialog-close-window'),
  onLogMessage: (callback: (message: LogMessage) => void) => {
    ipcRenderer.on('log-dialog-new-message', (_event, message) => callback(message));
  },
  removeListeners: (): void => {
    ipcRenderer.removeAllListeners('log-dialog-new-message');
  },
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
} as const;

contextBridge.exposeInMainWorld('api', {
  dialog: {
    log: logDialogAPI
  }
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: (): void => ipcRenderer.send('dialog-window-minimize'),
  close: (): void => ipcRenderer.send('dialog-window-close'),
  closeGeneric: (): void => ipcRenderer.send('close-current-window')
});

export {};
