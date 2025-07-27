// Material Info Dialog Preload Script
// Provides secure IPC bridge between renderer and main process

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for material info dialog data
export interface MaterialInfoDialogData {
    readonly fileName: string;
    readonly toolDatas: readonly {
        readonly toolId: number;
        readonly materialName: string;
        readonly materialColor: string;
        readonly filamentWeight: number;
        readonly slotId: number;
    }[];
    readonly totalFilamentWeight?: number;
    readonly useMatlStation?: boolean;
}

/**
 * Secure API interface exposed to renderer process
 */
const materialInfoDialogAPI = {
    /**
     * Listen for initialization data from main process
     */
    onInit: (callback: (data: MaterialInfoDialogData) => void): void => {
        ipcRenderer.on('material-info-dialog-init', (_event, data) => {
            callback(data);
        });
    },

    /**
     * Close the material info dialog
     */
    closeDialog: (): void => {
        console.log('Material info dialog preload: Sending close dialog request');
        ipcRenderer.send('close-material-info-dialog');
    }
} as const;

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('materialInfoDialogAPI', materialInfoDialogAPI); 