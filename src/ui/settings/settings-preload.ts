/**
 * @fileoverview Settings Dialog preload script providing secure IPC bridges for both global
 * application configuration and per-printer settings management. Exposes dual APIs for reading
 * and updating settings stored in config.json and per-printer printer_details.json files.
 *
 * Key Features:
 * - Dual API exposure: settingsAPI for global config, printerSettingsAPI for per-printer settings
 * - Type-safe configuration read/write operations
 * - Window lifecycle management (minimize, close)
 * - Secure contextBridge implementation for sandboxed renderer
 * - Unified window controls for dialog management
 *
 * Exposed APIs:
 * - window.settingsAPI: Global application settings (config.json)
 *   - requestConfig(): Loads current configuration
 *   - saveConfig(config): Persists configuration changes
 *   - receiveConfig(callback): Listens for configuration updates
 *   - closeWindow(): Closes settings dialog
 *
 * - window.printerSettingsAPI: Per-printer settings (printer_details.json)
 *   - get(): Retrieves active printer's settings
 *   - update(settings): Saves printer-specific settings
 *   - getPrinterName(): Returns active printer's display name
 *
 * - window.windowControls: Generic window operations
 *   - minimize/close/closeGeneric: Window state management
 */

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
  },
  testSpoolmanConnection: (url: string) => ipcRenderer.invoke('spoolman:test-connection', url)
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

contextBridge.exposeInMainWorld('autoUpdateAPI', {
  checkForUpdates: async (): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('check-for-updates');
  },
  getStatus: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('get-update-status');
  },
  setUpdateChannel: async (channel: 'stable' | 'alpha'): Promise<{ success: boolean }> => {
    return await ipcRenderer.invoke('set-update-channel', channel);
  }
});

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('dialog-window-minimize'),
  close: () => ipcRenderer.send('dialog-window-close'),
  closeGeneric: () => ipcRenderer.send('close-current-window')
});
