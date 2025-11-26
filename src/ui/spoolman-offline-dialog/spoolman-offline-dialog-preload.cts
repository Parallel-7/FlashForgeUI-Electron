/**
 * @fileoverview Preload script for Spoolman offline dialog.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spoolmanOfflineAPI', {
  retryConnection: async (): Promise<{ connected: boolean; error?: string }> => {
    return await ipcRenderer.invoke('spoolman:retry-connection') as { connected: boolean; error?: string };
  },
  onStatusUpdate: (callback: (message: string) => void): void => {
    ipcRenderer.on('spoolman-offline:update-status', (_event, message: string) => {
      callback(message);
    });
  }
,
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});

declare global {
  interface Window {
    spoolmanOfflineAPI: {
      retryConnection: () => Promise<{ connected: boolean; error?: string }>;
      onStatusUpdate: (callback: (message: string) => void) => void;
    };
  }
}
