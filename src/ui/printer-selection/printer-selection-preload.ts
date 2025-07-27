// printer-selection-preload.ts
// IPC bridge for Printer Selection Dialog communication between main and renderer processes
// Extended to support both discovered and saved printer selection modes

import { contextBridge, ipcRenderer } from 'electron';

// Interface for discovered printer information
interface PrinterInfo {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly model?: string;
    readonly status?: string;
    readonly firmwareVersion?: string;
}

// Interface for saved printer information with additional metadata
interface SavedPrinterInfo {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly lastConnected: string; // ISO date string
    readonly isOnline: boolean; // Whether found during network discovery
    readonly ipAddressChanged: boolean; // Whether IP changed from saved
    readonly currentIpAddress?: string; // Current IP if different from saved
}

// Selection dialog mode
type SelectionMode = 'discovered' | 'saved';

// Valid IPC channels are defined directly in the event listeners below

// API exposed to renderer process
interface PrinterSelectionAPI {
    selectPrinter: (printer: PrinterInfo | SavedPrinterInfo) => void;
    cancelSelection: () => void;
    receivePrinters: (func: (printers: PrinterInfo[]) => void) => void;
    receiveSavedPrinters: (func: (printers: SavedPrinterInfo[], lastUsedSerial: string | null) => void) => void;
    receiveMode: (func: (mode: SelectionMode) => void) => void;
    onConnecting: (func: (printerName: string) => void) => void;
    onConnectionFailed: (func: (error: string) => void) => void;
    onDiscoveryStarted: (func: () => void) => void;
    onDiscoveryError: (func: (data: { error: string; message: string }) => void) => void;
    removeListeners: () => void;
}

// Expose the printer selection API to the renderer process
contextBridge.exposeInMainWorld('printerSelectionAPI', {
    // Renderer to Main Process
    selectPrinter: (printer: PrinterInfo | SavedPrinterInfo): void => {
        console.log('Preload - Forwarding printer select:', JSON.stringify(printer));
        ipcRenderer.send('printer-selection:select', printer);
    },

    cancelSelection: (): void => {
        console.log('Preload - Forwarding printer cancel');
        ipcRenderer.send('printer-selection:cancel');
    },

    // Main Process to Renderer - Discovered Printers
    receivePrinters: (func: (printers: PrinterInfo[]) => void): void => {
        ipcRenderer.on('printer-selection:receive-printers', (event, printers: PrinterInfo[]) => {
            func(printers);
        });
    },

    // Main Process to Renderer - Saved Printers
    receiveSavedPrinters: (func: (printers: SavedPrinterInfo[], lastUsedSerial: string | null) => void): void => {
        ipcRenderer.on('printer-selection:receive-saved-printers', (event, printers: SavedPrinterInfo[], lastUsedSerial: string | null) => {
            func(printers, lastUsedSerial);
        });
    },

    // Main Process to Renderer - Selection Mode
    receiveMode: (func: (mode: SelectionMode) => void): void => {
        ipcRenderer.on('printer-selection:mode', (event, mode: SelectionMode) => {
            func(mode);
        });
    },

    onConnecting: (func: (printerName: string) => void): void => {
        ipcRenderer.on('printer-selection:connecting', (event, printerName: string) => {
            func(printerName);
        });
    },

    onConnectionFailed: (func: (error: string) => void): void => {
        ipcRenderer.on('printer-selection:connection-failed', (event, error: string) => {
            func(error);
        });
    },

    onDiscoveryStarted: (func: () => void): void => {
        ipcRenderer.on('printer-selection:discovery-started', () => {
            func();
        });
    },

    onDiscoveryError: (func: (data: { error: string; message: string }) => void): void => {
        ipcRenderer.on('printer-selection:discovery-error', (event, data: { error: string; message: string }) => {
            func(data);
        });
    },

    // Cleanup
    removeListeners: (): void => {
        ipcRenderer.removeAllListeners('printer-selection:receive-printers');
        ipcRenderer.removeAllListeners('printer-selection:receive-saved-printers');
        ipcRenderer.removeAllListeners('printer-selection:mode');
        ipcRenderer.removeAllListeners('printer-selection:connecting');
        ipcRenderer.removeAllListeners('printer-selection:connection-failed');
        ipcRenderer.removeAllListeners('printer-selection:discovery-started');
        ipcRenderer.removeAllListeners('printer-selection:discovery-error');
    }
} as PrinterSelectionAPI);

// Generic window controls for sub-windows
contextBridge.exposeInMainWorld('windowControls', {
    minimize: () => ipcRenderer.send('dialog-window-minimize'),
    close: () => ipcRenderer.send('dialog-window-close'),
    closeGeneric: () => ipcRenderer.send('close-current-window')
});

// Export types for use in renderer
export { PrinterInfo, SavedPrinterInfo, SelectionMode, PrinterSelectionAPI };
