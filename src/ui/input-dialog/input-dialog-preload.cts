/**
 * @fileoverview Preload script for generic input dialog with secure IPC communication.
 *
 * Provides secure bridge for modal input dialogs supporting text, password, and hidden input modes.
 * Each dialog instance receives unique response channel for isolated communication. Handles
 * initialization options including title, message, placeholder, and default values. Supports
 * submit/cancel actions with promise-based result handling.
 *
 * Key exports:
 * - dialogAPI: Secure API for dialog initialization and result submission
 * - DialogInitOptions: Configuration interface for dialog customization
 * - Unique response channels per dialog instance for multi-dialog support
 */

// input-dialog-preload.ts
// IPC bridge for Input Dialog communication between main and renderer processes

import { contextBridge, ipcRenderer } from 'electron';

// Store the unique response channel for this dialog instance
let responseChannel: string | null = null;

// Valid channels for security
const validReceiveChannels = ['dialog-init'];

// Define the shape of dialog initialization options
interface DialogInitOptions {
    title?: string;
    message?: string;
    defaultValue?: string;
    inputType?: 'text' | 'password' | 'hidden';
    placeholder?: string;
    responseChannel: string;
}

// API exposed to renderer process
interface DialogAPI {
    receive: (channel: string, func: (options: DialogInitOptions) => void) => void;
    submit: (result: string) => Promise<void>;
    cancel: () => Promise<void>;
}

// Expose the dialog API to the renderer process
contextBridge.exposeInMainWorld('dialogAPI', {
    // Receive initialization data from main process
    receive: (channel: string, func: (options: DialogInitOptions) => void): void => {
        if (validReceiveChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, options: DialogInitOptions) => {
                // Store the unique response channel for this dialog instance
                if (options && options.responseChannel) {
                    responseChannel = options.responseChannel;
                }
                func(options);
            });
        }
    },

    // Submit result to main process
    submit: async (result: string): Promise<void> => {
        if (responseChannel) {
            try {
                await ipcRenderer.invoke(responseChannel, result);
            } catch (error) {
                console.error('Failed to submit dialog result:', error);
                throw error;
            }
        } else {
            const error = new Error('Dialog response channel not set!');
            console.error(error.message);
            throw error;
        }
    },

    // Cancel dialog (send null result)
    cancel: async (): Promise<void> => {
        if (responseChannel) {
            try {
                await ipcRenderer.invoke(responseChannel, null);
            } catch (error) {
                console.error('Failed to cancel dialog:', error);
                throw error;
            }
        } else {
            const error = new Error('Dialog response channel not set!');
            console.error(error.message);
            throw error;
        }
    }
} as DialogAPI);

// Export type for use in renderer
export { DialogInitOptions, DialogAPI };
