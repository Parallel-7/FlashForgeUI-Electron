// src/manager/ipc/handlers/IPCHandlerBase.js
const { ipcMain } = require('electron');

/**
 * Base class for IPC handlers providing common functionality and patterns
 */
class IPCHandlerBase {
    /**
     * Create a new IPC handler
     * @param {string} category - Handler category (e.g., 'window', 'printer')
     * @param {WindowManager} windowManager - Window manager instance
     */
    constructor(category, windowManager) {
        this.category = category;
        this.windowManager = windowManager;
        this.registeredHandlers = new Map();
    }
    
    /**
     * Register an IPC handler
     * @param {string} channel - IPC channel name
     * @param {Function} handler - Handler function
     * @param {boolean} isInvokable - Whether handler is invokable (handle vs on)
     */
    registerHandler(channel, handler, isInvokable = false) {
        // Store handler info for cleanup
        this.registeredHandlers.set(channel, {
            handler,
            isInvokable
        });
        
        // Register with ipcMain
        if (isInvokable) {
            ipcMain.handle(channel, handler);
        } else {
            ipcMain.on(channel, handler);
        }
        
        //console.log(`[${this.category}] Registered IPC ${isInvokable ? 'invokable ' : ''}handler: ${channel}`);
    }
    
    /**
     * Remove an IPC handler
     * @param {string} channel - IPC channel name
     */
    removeHandler(channel) {
        const handlerInfo = this.registeredHandlers.get(channel);
        if (!handlerInfo) return;
        
        if (handlerInfo.isInvokable) {
            ipcMain.removeHandler(channel);
        } else {
            ipcMain.removeListener(channel, handlerInfo.handler);
        }
        
        this.registeredHandlers.delete(channel);
        console.log(`[${this.category}] Removed IPC handler: ${channel}`);
    }
    
    /**
     * Get the main window safely
     * @returns {BrowserWindow|null} Main window or null
     */
    getMainWindow() {
        return this.windowManager.getMainWindow();
    }
    
    /**
     * Send a message to the main window
     * @param {string} channel - Channel to send on
     * @param {*} data - Data to send
     */
    sendToMainWindow(channel, data) {
        const mainWindow = this.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        }
    }
    
    /**
     * Send a command response to the main window
     * @param {string} command - Command name
     * @param {boolean} success - Whether command succeeded
     * @param {string} message - Optional message
     */
    sendCommandResponse(command, success, message = '') {
        this.sendToMainWindow('command-response', {
            command,
            success,
            message
        });
    }
    
    /**
     * Send a log message to the main window
     * @param {string} message - Log message
     */
    sendLogMessage(message) {
        this.sendToMainWindow('log-message', message);
    }
    
    /**
     * Execute an async operation with standard error handling
     * @param {string} operation - Operation name for logging
     * @param {Function} asyncFn - Async function to execute
     * @param {string} command - Command name for response (optional)
     */
    async executeWithErrorHandling(operation, asyncFn, command = null) {
        try {
            const result = await asyncFn();
            if (command) {
                this.sendCommandResponse(command, true);
            }
            return result;
        } catch (error) {
            console.error(`[${this.category}] Error ${operation}:`, error);
            
            if (command) {
                this.sendCommandResponse(command, false, error.message);
            }
            
            // Handle legacy printer errors specifically
            if (error.message.includes('not supported')) {
                this.sendLogMessage('Operation not supported on this printer');
            }
            
            return false;
        }
    }
    
    /**
     * Initialize all handlers for this category
     * Must be implemented by subclasses
     */
    initialize() {
        throw new Error('initialize() must be implemented by subclasses');
    }
    
    /**
     * Clean up all registered handlers
     */
    dispose() {
        // Remove all registered handlers
        for (const channel of this.registeredHandlers.keys()) {
            this.removeHandler(channel);
        }
        
        // Clear references
        this.windowManager = null;

    }
}

module.exports = IPCHandlerBase;
