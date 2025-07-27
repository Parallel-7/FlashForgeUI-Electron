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

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('dialog-window-minimize'),
  close: () => ipcRenderer.send('dialog-window-close'),
  closeGeneric: () => ipcRenderer.send('close-current-window')
});