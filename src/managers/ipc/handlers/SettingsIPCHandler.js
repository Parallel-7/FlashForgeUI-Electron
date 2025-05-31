// src/manager/ipc/handlers/SettingsIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');
const { ipcMain } = require('electron');

/**
 * Handles settings and configuration IPC operations
 * Includes configuration management, settings window, and status dialog
 */
class SettingsIPCHandler extends IPCHandlerBase {
    constructor(windowManager, configManager, eventEmitter) {
        super('settings', windowManager);
        this.configManager = configManager;
        this.eventEmitter = eventEmitter;
    }
    
    /**
     * Initialize all settings handlers
     */
    initialize() {
        this.registerSettingsWindowHandlers();
        this.registerConfigHandlers();
        this.registerStatusDialogHandlers();
        
        console.log(`[${this.category}] Settings handlers initialized`);
    }
    
    /**
     * Register settings window handlers
     */
    registerSettingsWindowHandlers() {
        this.registerHandler('open-settings-window', () => {
            this.windowManager.showSettingsWindow();
        });
        
        this.registerHandler('settings:close-window', (event) => {
            if (this.windowManager.windows.settings && 
                event.sender === this.windowManager.windows.settings.webContents) {
                this.windowManager.windows.settings.close();
            }
        });
    }
    
    /**
     * Register configuration management handlers
     */
    registerConfigHandlers() {
        this.registerHandler('settings:request-config', (event) => {
            // Ensure request comes from settings window
            if (event.sender === this.windowManager.windows.settings?.webContents) {
                const currentConfig = this.configManager.getConfig();
                
                // Add default Web UI settings if not present
                this.ensureWebUIDefaults(currentConfig);
                
                event.sender.send('settings:receive-config', currentConfig);
            }
        });
        
        this.registerHandler('settings:save-config', (event, updatedConfig) => {
            if (event.sender === this.windowManager.windows.settings?.webContents) {
                this.handleConfigSave(updatedConfig);
            }
        });
    }
    
    /**
     * Register status dialog handlers
     */
    registerStatusDialogHandlers() {
        this.registerHandler('open-status-dialog', () => {
            const statusDialog = this.windowManager.showStatusDialog();
            
            // Request system stats and handle the response
            this.eventEmitter('get-system-stats', (stats) => {
                this.setupStatusDialogHandlers(statusDialog, stats);
            });
        });
    }
    
    /**
     * Ensure WebUI default settings exist
     * @param {Object} config - Configuration object to modify
     */
    ensureWebUIDefaults(config) {
        if (config.WebUIEnabled === undefined) {
            config.WebUIEnabled = true;
        }
        if (config.WebUIPort === undefined) {
            config.WebUIPort = 3000;
        }
        if (config.WebUIPassword === undefined) {
            config.WebUIPassword = 'changeme';
        }
    }
    
    /**
     * Handle configuration save with change detection
     * @param {Object} updatedConfig - New configuration
     */
    handleConfigSave(updatedConfig) {
        const currentConfig = this.configManager.getConfig();
        
        // Detect what changed
        const changes = this.detectConfigChanges(currentConfig, updatedConfig);
        
        // Update configuration
        this.configManager.updateConfig(updatedConfig);
        
        // Apply immediate changes
        this.applyImmediateChanges(updatedConfig);
        
        // Emit events for services that need to restart
        this.handleServiceRestarts(changes, updatedConfig);
        
        console.log("Config updated and saved.");
    }
    
    /**
     * Detect what configuration changes occurred
     * @param {Object} currentConfig - Current configuration
     * @param {Object} updatedConfig - New configuration
     * @returns {Object} Object describing what changed
     */
    detectConfigChanges(currentConfig, updatedConfig) {
        return {
            webUIEnabled: currentConfig.WebUIEnabled !== updatedConfig.WebUIEnabled,
            webUIPort: currentConfig.WebUIPort !== updatedConfig.WebUIPort,
            webUIPassword: currentConfig.WebUIPassword !== updatedConfig.WebUIPassword,
            cameraProxyPort: currentConfig.CameraProxyPort !== updatedConfig.CameraProxyPort
        };
    }
    
    /**
     * Apply configuration changes that take effect immediately
     * @param {Object} updatedConfig - New configuration
     */
    applyImmediateChanges(updatedConfig) {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(updatedConfig.AlwaysOnTop);
        }
    }
    
    /**
     * Handle service restarts based on configuration changes
     * @param {Object} changes - What changed
     * @param {Object} updatedConfig - New configuration
     */
    handleServiceRestarts(changes, updatedConfig) {
        // Handle camera proxy port changes
        if (changes.cameraProxyPort) {
            this.eventEmitter('camera-settings-changed', updatedConfig);
        }
        
        // Handle WebUI setting changes
        if (changes.webUIEnabled || changes.webUIPort || changes.webUIPassword) {
            this.eventEmitter('webui-settings-changed', updatedConfig);
        }
    }
    
    /**
     * Set up status dialog event handlers
     * @param {BrowserWindow} statusDialog - Status dialog window
     * @param {Object} stats - Initial system stats
     */
    setupStatusDialogHandlers(statusDialog, stats) {
        // Handler for stats requests
        const statsHandler = (event) => {
            if (event.sender === statusDialog.webContents) {
                // Get fresh stats for each request
                this.eventEmitter('get-system-stats', (freshStats) => {
                    event.sender.send('status-dialog:receive-stats', freshStats);
                });
            }
        };
        
        // Register temporary handler
        ipcMain.on('status-dialog:request-stats', statsHandler);
        
        // Send initial stats
        statusDialog.webContents.send('status-dialog:receive-stats', stats);
        
        // Clean up when dialog closes
        statusDialog.once('closed', () => {
            ipcMain.removeListener('status-dialog:request-stats', statsHandler);
        });
    }
}

module.exports = SettingsIPCHandler;
