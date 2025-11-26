/**
 * @fileoverview Single Color Confirmation Dialog preload script providing secure IPC bridge
 * for confirming single-color print jobs on printers with material station (IFS) support.
 * Exposes APIs for displaying active material slot information and collecting print confirmation
 * with optional bed leveling setting.
 *
 * Key Features:
 * - Secure contextBridge API for material station status retrieval
 * - Print job initialization data handling (file name, leveling preference)
 * - Material slot information display (type, color, empty status)
 * - Dialog confirmation/cancellation workflow
 * - Type-safe IPC communication with structured data interfaces
 *
 * Exposed API (window.singleColorConfirmAPI):
 * - onInit(callback): Receives file name and initial leveling preference
 * - getMaterialStationStatus(): Fetches current material station state and active slot
 * - confirmPrint(leveling): Sends confirmation with leveling option to start print
 * - closeDialog(): Cancels and closes the dialog
 *
 * Data Flow:
 * 1. Dialog receives init data (file name, default leveling state)
 * 2. Fetches material station status to identify active slot
 * 3. Displays active slot material information to user
 * 4. User confirms or cancels, optionally toggling leveling
 *
 * Context:
 * Used exclusively for AD5X and other material-station-equipped printers to ensure
 * users verify the correct material is loaded before starting single-color prints.
 */

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
const singleColorConfirmDialogAPI = {
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
,
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
} as const;

contextBridge.exposeInMainWorld('api', {
  dialog: {
    singleColor: singleColorConfirmDialogAPI
  }
});

