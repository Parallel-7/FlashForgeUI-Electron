/**
 * @fileoverview Preload script for IFS (Intelligent Filament System) material station dialog.
 *
 * Establishes secure IPC bridge between main and renderer processes for displaying AD5X printer
 * material station status. Exposes controlled API for receiving material slot data, requesting
 * updates, and managing dialog lifecycle. Includes window control functions for dialog management.
 * Uses Electron's contextBridge for security isolation.
 *
 * Key exports:
 * - ifsDialogAPI: Secure API for material station data communication
 * - MaterialStationData: Type definitions for slot status and configuration
 * - Window controls: Minimize/close dialog functionality
 */

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
const ifsDialogAPI: IFSDialogAPI = {
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
};

contextBridge.exposeInMainWorld('api', {
  dialog: {
    ifs: ifsDialogAPI
  }
});

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('dialog-window-minimize'),
  close: () => ipcRenderer.send('dialog-window-close'),
  closeGeneric: () => ipcRenderer.send('close-current-window')
});

export type { MaterialSlotData, MaterialStationData, IFSDialogAPI }; 
