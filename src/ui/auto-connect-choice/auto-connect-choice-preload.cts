/**
 * @fileoverview Auto-connect choice dialog preload script - Provides secure IPC bridge
 * between main process and renderer for auto-connect choice dialog communication.
 * Exposes dialog initialization and response APIs while maintaining security isolation.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Auto-connect choice option type
export interface AutoConnectChoiceOption {
  action: 'connect-last-used' | 'show-saved-printers' | 'manual-ip' | 'cancel';
  data?: unknown;
}

// Dialog initialization data interface
export interface AutoConnectChoiceData {
  lastUsedPrinter?: {
    name: string;
    serialNumber: string;
  } | null;
  savedPrinterCount: number;
  responseChannel: string;
}

// Define the API that will be exposed to the renderer process
const autoConnectChoiceAPI = {
  // Listen for dialog initialization
  onDialogInit: (callback: (data: AutoConnectChoiceData) => void): void => {
    ipcRenderer.on('auto-connect-choice:init', (_, data: AutoConnectChoiceData) => {
      callback(data);
    });
  },

  // Send user choice back to main process
  sendChoice: async (choice: AutoConnectChoiceOption): Promise<void> => {
    const data = await ipcRenderer.invoke('auto-connect-choice:get-response-channel') as AutoConnectChoiceData;
    await ipcRenderer.invoke(data.responseChannel, choice);
  },

  // Request dialog close
  closeDialog: (): void => {
    ipcRenderer.send('auto-connect-choice:close');
  },

  // Remove all listeners when dialog is destroyed
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('auto-connect-choice:init');
  },

  // Listen for theme changes
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('autoConnectChoiceAPI', autoConnectChoiceAPI);

// Type declaration for the exposed API
declare global {
  interface Window {
    autoConnectChoiceAPI: typeof autoConnectChoiceAPI;
  }
}
