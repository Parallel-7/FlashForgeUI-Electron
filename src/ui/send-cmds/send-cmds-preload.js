// src/ui/send-cmds/send-cmds-preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Create a secure bridge to expose limited IPC functionality to renderer
contextBridge.exposeInMainWorld('sendCmdsApi', {
    // Send a command to the main process
    sendCommand: (command) => {
        if (typeof command !== 'string') return false;
        return ipcRenderer.invoke('send-cmds:send-command', command);
    },
    
    // Close the send commands window
    close: () => {
        ipcRenderer.send('send-cmds:close');
    },
    
    // Receive command results
    // Clear listeners when window is closed
    removeListeners: () => {
        ipcRenderer.removeAllListeners('send-cmds:command-result');
    }
});
