// src/ui/status-dialog/status-dialog-preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', 
  {
    // Send an event to main process
    send: (channel, data) => {
      // Whitelist channels
      const validChannels = ['status-dialog:close', 'status-dialog:request-stats'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    
    // Receive data from main process
    receive: (channel, func) => {
      // Whitelist channels
      const validChannels = ['status-dialog:receive-stats'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    
    // Remove event listeners
    removeListener: (channel, func) => {
      const validChannels = ['status-dialog:receive-stats'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
);
