// src/ui/settings/settings-preload.ts

import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig } from '../../types/config';

// Ensure this file is treated as a module
export {};

// Expose settings API to renderer process
contextBridge.exposeInMainWorld('settingsAPI', {
  requestConfig: () => ipcRenderer.invoke('settings-request-config'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('settings-save-config', config),
  closeWindow: () => ipcRenderer.send('settings-close-window'),
  receiveConfig: (callback: (config: AppConfig) => void) => {
    ipcRenderer.on('settings-config-data', (_event, config) => callback(config));
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('settings-config-data');
  }
});

// Expose printer settings API (reusing same implementation as main preload)
contextBridge.exposeInMainWorld('printerSettingsAPI', {
  get: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('printer-settings:get');
  },

  update: async (settings: unknown): Promise<boolean> => {
    const result: unknown = await ipcRenderer.invoke('printer-settings:update', settings);
    return typeof result === 'boolean' ? result : false;
  },

  getPrinterName: async (): Promise<string | null> => {
    const result: unknown = await ipcRenderer.invoke('printer-settings:get-printer-name');
    return typeof result === 'string' ? result : null;
  }
});

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('dialog-window-minimize'),
  close: () => ipcRenderer.send('dialog-window-close'),
  closeGeneric: () => ipcRenderer.send('close-current-window')
});