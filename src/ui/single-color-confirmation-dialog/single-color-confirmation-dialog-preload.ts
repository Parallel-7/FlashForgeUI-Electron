// Single Color Confirmation Dialog Preload Script
// Provides secure IPC bridge for single color print confirmation

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions
interface SingleColorConfirmInitData {
  readonly fileName: string;
  readonly leveling: boolean;
}

interface MaterialStationStatus {
  readonly connected: boolean;
  readonly slots: readonly {
    readonly slotId: number;
    readonly materialType: string | null;
    readonly materialColor: string | null;
    readonly isEmpty: boolean;
  }[];
  readonly activeSlot: number;
  readonly overallStatus: string;
  readonly errorMessage: string | null;
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('singleColorConfirmAPI', {
  // Listen for initialization data
  onInit: (callback: (data: SingleColorConfirmInitData) => void) => {
    ipcRenderer.on('single-color-confirm:init', (_event, data: SingleColorConfirmInitData) => {
      callback(data);
    });
  },
  
  // Close the dialog
  closeDialog: () => {
    ipcRenderer.send('single-color-confirm:close');
  },
  
  // Confirm print with leveling option
  confirmPrint: (leveling: boolean) => {
    ipcRenderer.send('single-color-confirm:confirm', { leveling });
  },
  
  // Get material station status
  getMaterialStationStatus: (): Promise<MaterialStationStatus | null> => {
    return ipcRenderer.invoke('get-material-station-status');
  }
});
