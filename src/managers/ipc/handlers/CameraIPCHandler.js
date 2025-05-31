// src/manager/ipc/handlers/CameraIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles camera-related IPC operations
 * Includes camera proxy port management and configuration
 */
class CameraIPCHandler extends IPCHandlerBase {
    constructor(windowManager, configManager, cameraService) {
        super('camera', windowManager);
        this.configManager = configManager;
        this.cameraService = cameraService;
    }
    
    /**
     * Initialize camera handlers
     */
    initialize() {
        this.registerCameraPortHandlers();
        this.registerStreamManagementHandlers();
        
        console.log(`[${this.category}] Camera handlers initialized`);
    }
    
    /**
     * Register camera port management handlers
     */
    registerCameraPortHandlers() {
        this.registerHandler('get-camera-proxy-port', (event) => {
            try {
                const config = this.configManager.getConfig();
                event.returnValue = config.CameraProxyPort || 8181;
            } catch (error) {
                console.warn('Error getting camera proxy port:', error);
                event.returnValue = 8181; // Default fallback
            }
        });
    }
    
    /**
     * Register camera stream management handlers
     */
    registerStreamManagementHandlers() {
        // Manual stream restoration handler
        this.registerHandler('restore-camera-stream', async (event) => {
            try {
                if (!this.cameraService) {
                    console.warn('Camera service not available for restoration');
                    event.reply('restore-camera-stream-response', { success: false, error: 'Camera service not available' });
                    return;
                }
                
                console.log('Manual camera stream restoration requested via IPC');
                const success = await this.cameraService.restoreStream();
                
                event.reply('restore-camera-stream-response', { 
                    success: success,
                    message: success ? 'Camera stream restoration successful' : 'Camera stream restoration failed'
                });
                
                // Also send log message to UI
                this.sendToAll('log-message', success ? 
                    'Camera stream restoration completed successfully' : 
                    'Camera stream restoration failed - check console for details');
                    
            } catch (error) {
                console.error('Error in camera stream restoration:', error);
                event.reply('restore-camera-stream-response', { 
                    success: false, 
                    error: error.message 
                });
                this.sendToAll('log-message', `Camera restoration error: ${error.message}`);
            }
        });
    }
}

module.exports = CameraIPCHandler;
