// src/manager/ipc/handlers/JobIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles job management IPC operations
 * Includes file operations, uploads, thumbnails, and command dialogs
 */
class JobIPCHandler extends IPCHandlerBase {
    constructor(windowManager, printerConnectionManager, eventEmitter) {
        super('job', windowManager);
        this.printerConnectionManager = printerConnectionManager;
        this.eventEmitter = eventEmitter;
    }
    
    /**
     * Initialize all job management handlers
     */
    initialize() {
        this.registerJobDialogHandlers();
        this.registerFileHandlers();
        this.registerThumbnailHandlers();
        this.registerCommandHandlers();
        
        console.log(`[${this.category}] Job management handlers initialized`);
    }
    
    /**
     * Check if printer is connected and send error if not
     * @returns {boolean} True if connected, false otherwise
     */
    checkPrinterConnection() {
        if (!this.printerConnectionManager.getConnectionStatus()) {
            this.sendLogMessage('Error: Printer not connected');
            return false;
        }
        return true;
    }
    
    /**
     * Register job dialog handlers
     */
    registerJobDialogHandlers() {
        this.registerHandler('upload-job-dialog', () => {
            if (!this.printerConnectionManager.getConnectionStatus()) {
                this.sendLogMessage('Error: Printer not connected. Cannot upload.');
                return;
            }
            this.eventEmitter('show-job-uploader-window');
        });
        
        this.registerHandler('show-recent-files', () => {
            if (!this.checkPrinterConnection()) return;
            this.eventEmitter('show-recent-files');
        });
        
        this.registerHandler('show-local-files', () => {
            if (!this.checkPrinterConnection()) return;
            this.eventEmitter('show-local-files');
        });
    }
    
    /**
     * Register file handling operations
     */
    registerFileHandlers() {
        // File handlers can be added here as needed
        // Currently handled by separate dialog classes
    }
    
    /**
     * Register thumbnail handling
     */
    registerThumbnailHandlers() {
        this.registerHandler('request-legacy-thumbnail', async (event, filename) => {
            if (!this.printerConnectionManager.getConnectionStatus()) {
                console.warn('Cannot fetch legacy thumbnail: Printer not connected');
                return;
            }
            
            const printerClient = this.printerConnectionManager.getPrinterClient();
            if (printerClient.getClientType() !== 'legacy') {
                console.warn('Not a legacy printer, thumbnail request ignored');
                return;
            }
            
            console.log(`Main process received request for legacy thumbnail: ${filename}`);
            
            try {
                // Ensure filename has proper prefix for legacy systems
                const fullFilename = filename.startsWith('/data/') ? filename : `/data/${filename}`;
                
                // Get thumbnail from printer
                const thumbnailBuffer = await this.printerConnectionManager.getLegacyThumbnail(fullFilename);
                
                // Convert to base64 if available
                let base64Thumbnail = null;
                if (thumbnailBuffer) {
                    base64Thumbnail = thumbnailBuffer.toString('base64');
                }
                
                // Send response back to renderer
                event.reply('legacy-thumbnail-result', {
                    filename: filename,
                    thumbnail: base64Thumbnail
                });
                
            } catch (error) {
                console.error(`Error fetching legacy thumbnail for main UI: ${error.message}`);
                event.reply('legacy-thumbnail-result', {
                    filename: filename,
                    thumbnail: null,
                    error: error.message
                });
            }
        });
    }
    
    /**
     * Register command dialog handlers
     */
    registerCommandHandlers() {
        this.registerHandler('show-command-dialog', () => {
            console.log('Received show-command-dialog IPC message');
            this.sendLogMessage('Opening command terminal...');
            this.eventEmitter('show-send-cmds-window');
        });
        
        this.registerHandler('show-send-cmds', () => {
            console.log('Received show-send-cmds IPC message');
            this.sendLogMessage('Opening command terminal...');
            this.eventEmitter('show-send-cmds-window');
        });
    }
}

module.exports = JobIPCHandler;
