/**
 * @fileoverview Send Commands Dialog preload script providing secure IPC bridge for sending raw printer
 * commands from the renderer process to the main process. Exposes a sandboxed API that allows the dialog
 * to communicate with the connected printer via IPC channels while maintaining security boundaries.
 *
 * Key Features:
 * - Secure contextBridge API exposure for command transmission
 * - Type-safe command result handling with success/error responses
 * - Input validation to prevent invalid command types
 * - Error handling and response format validation
 * - Window lifecycle management (close, cleanup)
 *
 * Exposed API (window.sendCmdsApi):
 * - sendCommand(command: string): Sends raw command to printer, returns CommandResult
 * - close(): Closes the send commands dialog window
 * - removeListeners(): Cleanup function for IPC event listeners
 *
 * Security:
 * - Uses contextBridge for safe main-to-renderer communication
 * - Validates command input types before transmission
 * - Sanitizes and validates IPC response structures
 */

// src/ui/send-cmds/send-cmds-preload.ts

import { contextBridge, ipcRenderer } from 'electron';

// Define types for command communication
interface CommandResult {
    readonly success: boolean;
    readonly response?: string;
    readonly error?: string;
}

// Create a secure bridge to expose limited IPC functionality to renderer
contextBridge.exposeInMainWorld('sendCmdsApi', {
    // Send a command to the main process
    sendCommand: async (command: string): Promise<CommandResult> => {
        if (typeof command !== 'string') {
            return { success: false, error: 'Invalid command type' };
        }
        
        try {
            const result: unknown = await ipcRenderer.invoke('send-cmds:send-command', command);
            
            // Validate the result has the expected structure
            if (typeof result === 'object' && result !== null && 
                'success' in result && typeof (result as { success: unknown }).success === 'boolean') {
                return result as CommandResult;
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMessage };
        }
    },
    
    // Close the send commands window
    close: (): void => {
        ipcRenderer.send('send-cmds:close');
    },
    
    // Clear listeners when window is closed (cleanup function)
    removeListeners: (): void => {
        ipcRenderer.removeAllListeners('send-cmds:command-result');
    }
,
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});

