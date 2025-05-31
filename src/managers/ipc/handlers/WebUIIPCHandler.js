// src/manager/ipc/handlers/WebUIIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles WebUI-related IPC operations
 * Includes port management and WebUI configuration
 */
class WebUIIPCHandler extends IPCHandlerBase {
    constructor(windowManager, configManager) {
        super('webui', windowManager);
        this.configManager = configManager;
    }
    
    /**
     * Initialize WebUI handlers
     */
    initialize() {
        this.registerPortHandlers();
        
        console.log(`[${this.category}] WebUI handlers initialized`);
    }
    
    /**
     * Register port management handlers
     */
    registerPortHandlers() {
        this.registerHandler('get-webui-port', () => {
            try {
                const config = this.configManager.getConfig();
                return config.WebUIPort || 3000;
            } catch (error) {
                console.warn('Error getting WebUI port:', error);
                return 3000; // Default fallback
            }
        }, true); // Invokable handler
    }
}

module.exports = WebUIIPCHandler;
