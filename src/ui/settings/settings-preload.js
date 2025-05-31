// src/settings-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
    // Renderer -> Main
    requestConfig: () => ipcRenderer.send('settings:request-config'),
    saveConfig: (config) => ipcRenderer.send('settings:save-config', config),
    closeWindow: () => ipcRenderer.send('settings:close-window'),

    // Main -> Renderer
    receiveConfig: (func) => {
        ipcRenderer.on('settings:receive-config', (event, ...args) => func(...args));
    },

    // Cleanup listeners (good practice)
    removeListeners: () => {
        ipcRenderer.removeAllListeners('settings:receive-config');
    }
});