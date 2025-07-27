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
});
