// src/printer-selection-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerSelectionApi', {
    // Renderer -> Main
    selectPrinter: (printer) => {
        // Log exactly what is received from the renderer before sending to main
        console.log('Preload - Forwarding printer select:', JSON.stringify(printer));
        ipcRenderer.send('printer-selection:select', printer);
    },
    cancelSelection: () => {
        console.log('Preload - Forwarding printer cancel');
        ipcRenderer.send('printer-selection:cancel');
    },

    // Main -> Renderer
    receivePrinters: (func) => {
        ipcRenderer.on('printer-selection:receive-printers', (event, ...args) => func(...args));
    },

    // Cleanup
    removeListeners: () => {
        ipcRenderer.removeAllListeners('printer-selection:receive-printers');
    }
});