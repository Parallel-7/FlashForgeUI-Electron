// src/manager/ipc/IPCManager.js - Refactored with modular handlers
const EventEmitter = require('events');
const cameraService = require('../camera/CameraService');

// Import specialized handlers
const WindowIPCHandler = require('./handlers/WindowIPCHandler');
const PrinterIPCHandler = require('./handlers/PrinterIPCHandler');
const JobIPCHandler = require('./handlers/JobIPCHandler');
const SettingsIPCHandler = require('./handlers/SettingsIPCHandler');
const DialogIPCHandler = require('./handlers/DialogIPCHandler');
const WebUIIPCHandler = require('./handlers/WebUIIPCHandler');
const CameraIPCHandler = require('./handlers/CameraIPCHandler');

/**
 * IPCManager - Orchestrates specialized IPC handlers
 * 
 * Manages all IPC (Inter-Process Communication) handlers through composition
 * of specialized handler classes. Each handler manages a specific domain.
 * 
 * Benefits of this approach:
 * - Single responsibility per handler
 * - Better error isolation
 * - Easier testing and maintenance
 * - Consistent patterns across handlers
 */
class IPCManager extends EventEmitter {
    /**
     * Create a new IPCManager instance
     * 
     * @param {WindowManager} windowManager - The window manager instance
     * @param {PrinterConnectionManager} printerConnectionManager - The printer connection manager instance
     * @param {Object} configManager - The config manager instance
     * @param {DialogManager} dialogManager - The dialog manager instance
     */
    constructor(windowManager, printerConnectionManager, configManager, dialogManager) {
        super();
        
        // Store dependencies
        this.windowManager = windowManager;
        this.printerConnectionManager = printerConnectionManager;
        this.configManager = configManager;
        this.dialogManager = dialogManager;
        
        // Create specialized handlers
        this.handlers = {
            window: new WindowIPCHandler(windowManager),
            printer: new PrinterIPCHandler(windowManager, printerConnectionManager),
            job: new JobIPCHandler(windowManager, printerConnectionManager, this.emit.bind(this)),
            settings: new SettingsIPCHandler(windowManager, configManager, this.emit.bind(this)),
            dialog: new DialogIPCHandler(windowManager, dialogManager),
            webui: new WebUIIPCHandler(windowManager, configManager),
            camera: new CameraIPCHandler(windowManager, configManager, cameraService)
        };
        
        // Track initialization state
        this.initialized = false;
    }
    
    /**
     * Initialize all IPC handlers
     */
    initialize() {
        if (this.initialized) {
            console.warn('IPCManager already initialized');
            return;
        }
        
        // Initialize all handlers
        Object.values(this.handlers).forEach(handler => {
            handler.initialize();
        });
        
        this.initialized = true;
    }

    /**
     * Get all registered handlers count for diagnostics
     * @returns {Object} Handler counts by category
     */
    getHandlerCounts() {
        const counts = {};
        Object.entries(this.handlers).forEach(([category, handler]) => {
            counts[category] = handler.registeredHandlers.size;
        });
        return counts;
    }

    /**
     * Dispose of all handlers and cleanup resources
     */
    dispose() {
        if (!this.initialized) {
            return;
        }
        
        // Dispose all handlers
        Object.values(this.handlers).forEach(handler => {
            handler.dispose();
        });
        
        // Clear references
        this.handlers = {};
        this.windowManager = null;
        this.printerConnectionManager = null;
        this.configManager = null;
        this.dialogManager = null;
        
        this.initialized = false;
    }
}

module.exports = IPCManager;
