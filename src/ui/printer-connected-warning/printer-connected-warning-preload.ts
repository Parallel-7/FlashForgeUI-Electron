/**
 * @fileoverview Preload script for Printer Connected Warning Dialog
 *
 * Provides secure IPC communication bridge between the main process and the
 * printer connected warning dialog renderer process. Handles dialog initialization
 * and user response communication using Electron's contextBridge API.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Interface for printer connected warning data
interface PrinterConnectedWarningData {
    readonly printerName: string;
    readonly responseChannel: string;
}

// Expose secure dialog API to renderer process
contextBridge.exposeInMainWorld('printerWarningDialogAPI', {
    /**
     * Receive dialog initialization data from main process
     * @param channel The IPC channel to listen on
     * @param func Callback function to handle received data
     */
    receive: (channel: string, func: (data: PrinterConnectedWarningData) => void): void => {
        // Validate channel name for security
        if (channel === 'dialog-init') {
            ipcRenderer.once(channel, (_event, data: PrinterConnectedWarningData) => {
                func(data);
            });
        } else {
            console.error('Printer connected warning preload: Invalid channel:', channel);
        }
    },

    /**
     * Send continue response to main process (user chose to continue)
     * @returns Promise that resolves when message is sent
     */
    continue: async (): Promise<void> => {
        return ipcRenderer.invoke('printer-connected-warning-continue') as Promise<void>;
    },

    /**
     * Send cancel response to main process (user chose to cancel)
     * @returns Promise that resolves when message is sent
     */
    cancel: async (): Promise<void> => {
        return ipcRenderer.invoke('printer-connected-warning-cancel') as Promise<void>;
    }
});

// Handle platform information for styling
ipcRenderer.once('platform-info', (_event, platform: string) => {
    // Add platform class to body for platform-specific styling
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add(`platform-${platform}`);
    });
});

// Log preload completion for debugging
console.log('Printer connected warning dialog preload script loaded');