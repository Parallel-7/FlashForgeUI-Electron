// ifs-dialog-preload.ts
// IPC bridge for IFS Dialog communication between main and renderer processes

import { contextBridge, ipcRenderer } from 'electron';

// Valid channels for security
const validReceiveChannels = ['ifs-dialog-init', 'ifs-dialog-update-material-station'];
const validSendChannels = ['ifs-close-window', 'ifs-request-material-station'];

// Define the shape of material station data
interface MaterialSlotData {
  slotId: number;
  materialType: string | null;
  materialColor: string | null;
  isEmpty: boolean;
  isActive: boolean;
}

interface MaterialStationData {
  connected: boolean;
  slots: MaterialSlotData[];
  activeSlot: number | null;
  errorMessage: string | null;
}

interface IFSDialogAPI {
  // Receive data from main process
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
  
  // Send data to main process
  send: (channel: string, ...args: unknown[]) => void;
  
  // Request material station data
  requestMaterialStation: () => void;
  
  // Close the dialog
  closeDialog: () => void;
}

// Expose the IFS dialog API to the renderer process
contextBridge.exposeInMainWorld('ifsDialogAPI', {
  // Receive data from main process
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Send data to main process
  send: (channel: string, ...args: unknown[]): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  // Request current material station data
  requestMaterialStation: (): void => {
    ipcRenderer.send('ifs-request-material-station');
  },

  // Close the dialog
  closeDialog: (): void => {
    ipcRenderer.send('ifs-close-window');
  }
} as IFSDialogAPI);

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('dialog-window-minimize'),
  close: () => ipcRenderer.send('dialog-window-close'),
  closeGeneric: () => ipcRenderer.send('close-current-window')
});

// Type definitions for the global window object
declare global {
  interface Window {
    ifsDialogAPI: IFSDialogAPI;
    windowControls: {
      minimize: () => void;
      close: () => void;
      closeGeneric: () => void;
    };
  }
}

export type { MaterialSlotData, MaterialStationData, IFSDialogAPI }; 