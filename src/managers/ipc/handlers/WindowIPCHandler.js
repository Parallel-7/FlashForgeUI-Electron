// src/manager/ipc/handlers/WindowIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles window control IPC operations (minimize, maximize, close)
 */
class WindowIPCHandler extends IPCHandlerBase {
    constructor(windowManager) {
        super('window', windowManager);
    }
    
    /**
     * Initialize window control handlers
     */
    initialize() {
        this.registerHandler('window-minimize', () => {
            const mainWindow = this.getMainWindow();
            if (mainWindow) {
                mainWindow.minimize();
            }
        });
        
        this.registerHandler('window-maximize', () => {
            const mainWindow = this.getMainWindow();
            if (!mainWindow) return;
            
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        });
        
        this.registerHandler('window-close', () => {
            const mainWindow = this.getMainWindow();
            if (mainWindow) {
                mainWindow.close();
            }
        });
        
        console.log(`[${this.category}] Window control handlers initialized`);
    }
}

module.exports = WindowIPCHandler;
