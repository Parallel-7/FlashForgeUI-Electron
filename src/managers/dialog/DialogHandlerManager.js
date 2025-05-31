const { ipcMain } = require('electron');
const EventEmitter = require('events');
require('path');

/**
 * DialogHandlerManager
 * 
 * Manages IPC handlers for different dialog types
 * This is a companion class to DialogManager that specifically focuses on
 * registering and managing the IPC event handlers for each dialog type
 */
class DialogHandlerManager extends EventEmitter {
    /**
     * Create a new DialogHandlerManager instance
     * 
     * @param {WindowManager} windowManager - The window manager instance
     * @param {PrinterConnectionManager} printerConnectionManager - The printer connection manager
     */
    constructor(windowManager, printerConnectionManager) {
        super();
        
        this.windowManager = windowManager;
        this.printerConnectionManager = printerConnectionManager;
        
        // Store handlers for cleanup
        this.handlers = {
            jobUploader: new Map(),
            sendCmds: new Map(),
            statusDialog: new Map(),
            generalDialog: new Map()
        };
        
        // Flag to track initialization
        this.initialized = false;
    }
    
    /**
     * Initialize the DialogHandlerManager
     */
    initialize() {
        if (this.initialized) {
            console.warn('DialogHandlerManager already initialized');
            return;
        }
        
        // Register IPC handlers for each dialog type
        this.registerJobUploaderHandlers();
        this.registerSendCmdsHandlers();
        this.registerStatusDialogHandlers();
        this.registerGeneralDialogHandlers();
        
        this.initialized = true;
    }
    
    /**
     * Register a handler for a specific dialog type
     * 
     * @param {string} dialogType - The dialog type (e.g., 'jobUploader')
     * @param {string} channel - The IPC channel
     * @param {Function} handler - The handler function
     * @param {boolean} isInvokable - Whether this is an invokable handler (handle vs on)
     */
    registerHandler(dialogType, channel, handler, isInvokable = false) {
        if (!this.handlers[dialogType]) { this.handlers[dialogType] = new Map(); }
        this.handlers[dialogType].set(channel, { handler,  isInvokable} ); // Store the handler
        if (isInvokable) { ipcMain.handle(channel, handler); }  // Register with ipcMain
        else { ipcMain.on(channel, handler); }
    }

    /**
     * Remove all handlers for a dialog type
     * 
     * @param {string} dialogType - The dialog type
     */
    removeAllHandlers(dialogType) {
        if (!this.handlers[dialogType]) { return; }
        
        for (const [channel, handlerInfo] of this.handlers[dialogType].entries()) {
            if (handlerInfo.isInvokable) { ipcMain.removeHandler(channel); }
            else { ipcMain.removeListener(channel, handlerInfo.handler); }
        }
        
        this.handlers[dialogType].clear();

    }
    
    /**
     * Register handlers for job uploader dialog
     */
    registerJobUploaderHandlers() {
        // Register handlers for the job uploader dialog
        this.registerHandler('jobUploader', 'uploader:browse-file', async (event) => {
            const jobUploaderWindow = this.windowManager.windows.jobUploader;
            if (!jobUploaderWindow || event.sender !== jobUploaderWindow.webContents) { return; }
            
            const result = await require('electron').dialog.showOpenDialog(jobUploaderWindow, {
                title: 'Select G-Code or 3MF File',
                properties: ['openFile'],
                filters: [
                    { name: 'Slicer Files', extensions: ['gcode', 'g', '3mf'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                
                // Send path back to renderer
                event.sender.send('uploader:file-selected', filePath);
                
                // Trigger parsing immediately
                try {
                    console.log(`Parsing file: ${filePath}`);
                    event.sender.send('uploader:show-loading', true);
                    
                    const { parseSlicerFile } = require('slicer-meta');
                    let metadata = await parseSlicerFile(filePath);
                    
                    console.log("Parsing complete.");
                    event.sender.send('uploader:metadata-result', metadata);
                } catch (error) {
                    console.error(`Error parsing slicer file ${filePath}:`, error);
                    event.sender.send('uploader:metadata-result', { error: error.message || 'Parsing failed' });
                } finally {
                    event.sender.send('uploader:show-loading', false);
                }
            } else {
                // Send null if cancelled
                event.sender.send('uploader:file-selected', null);
            }
        });
        
        this.registerHandler('jobUploader', 'uploader:upload-job', async (event, payload) => {
            const jobUploaderWindow = this.windowManager.windows.jobUploader;
            if (!jobUploaderWindow || event.sender !== jobUploaderWindow.webContents) {
                return;
            }
            
            if (!this.printerConnectionManager.getConnectionStatus()) {
                console.error('Upload attempt failed: Printer not connected.');
                const NotificationUtils = require('../../utils/NotificationUtils');
                NotificationUtils.showNotification('Upload Failed', 'Printer is not connected.');
                return;
            }
            
            if (!payload || !payload.filePath) {
                console.error('Upload attempt failed: No file path provided.');
                const NotificationUtils = require('../../utils/NotificationUtils');
                NotificationUtils.showNotification('Upload Failed', 'Invalid file information.');
                return;
            }
            
            console.log(`Attempting to upload: ${payload.filePath}`);
            this.windowManager.getMainWindow()?.webContents.send('log-message', `Uploading ${payload.filePath.split(/[\\/]/).pop()}...`);
            this.windowManager.getMainWindow()?.webContents.send('log-message', 'Status updates paused during file upload to avoid communication conflicts.');
            
            try {
                // Show "Uploading..." state in dialog
                event.sender.send('uploader:show-loading', true);
                
                // Upload the file
                const success = await this.printerConnectionManager.uploadFile(
                    payload.filePath,
                    payload.startNow,
                    payload.autoLevel
                );
                
                const NotificationUtils = require('../../utils/NotificationUtils');
                if (success) {
                    console.log('File upload successful.');
                    NotificationUtils.showNotification('Upload Complete', `${payload.filePath.split(/[\\/]/).pop()} sent to printer.`);
                    this.windowManager.getMainWindow()?.webContents.send('log-message', `Upload successful: ${payload.filePath.split(/[\\/]/).pop()}`);
                    
                    // Send success result
                    event.sender.send('uploader:upload-success', {
                        filePath: payload.filePath,
                        startNow: payload.startNow,
                        autoLevel: payload.autoLevel
                    });
                    
                    if (jobUploaderWindow) jobUploaderWindow.close();
                } else {
                    console.error('File upload failed (API returned false).');
                    NotificationUtils.showNotification('Upload Failed', 'The printer rejected the file upload.');
                    this.windowManager.getMainWindow()?.webContents.send('log-message', `Upload failed: ${payload.filePath.split(/[\\/]/).pop()}`);
                    event.sender.send('uploader:show-loading', false);
                }
                
                // Status updates will automatically resume
                this.windowManager.getMainWindow()?.webContents.send('log-message', 'Status updates resuming after file upload.');
                setTimeout(() => this.printerConnectionManager.sendPrinterDataUpdate(), 1000);
            } catch (error) {
                console.error('Error during file upload:', error);
                const NotificationUtils = require('../../utils/NotificationUtils');
                NotificationUtils.showNotification('Upload Error', `An error occurred: ${error.message}`);
                this.windowManager.getMainWindow()?.webContents.send('log-message', `Upload error for ${payload.filePath.split(/[\\/]/).pop()}: ${error.message}`);
                event.sender.send('uploader:show-loading', false);
            }
        });
        
        this.registerHandler('jobUploader', 'uploader:cancel', (event) => {
            const jobUploaderWindow = this.windowManager.windows.jobUploader;
            if (jobUploaderWindow && event.sender === jobUploaderWindow.webContents) {
                jobUploaderWindow.close();
            }
        });
    }
    
    /**
     * Register handlers for send commands dialog
     */
    registerSendCmdsHandlers() {
        // Register handlers for the send commands dialog
        this.registerHandler('sendCmds', 'send-cmds:send-command', async (event, command) => {
            const sendCmdsWindow = this.windowManager.windows.sendCmds;

            if (!sendCmdsWindow || event.sender !== sendCmdsWindow.webContents) { return { success: false, error: 'Invalid sender' }; }
            if (!this.printerConnectionManager.getConnectionStatus()) { return { success: false, error: 'Printer disconnected' }; }
            
            try {
                const response = await this.printerConnectionManager.sendRawCmd(command);
                return { success: true, response };
            } catch (error) {
                console.error('Error sending command:', error);
                return { success: false, error: error.message || 'Command failed' };
            }
        }, true); // true for invokable handler
        
        this.registerHandler('sendCmds', 'send-cmds:close', (event) => {
            const sendCmdsWindow = this.windowManager.windows.sendCmds;
            if (sendCmdsWindow && event.sender === sendCmdsWindow.webContents) {
                sendCmdsWindow.close();
            }
        });
    }
    
    /**
     * Register handlers for status dialog
     */
    registerStatusDialogHandlers() {
        // Register handlers for the status dialog
        this.registerHandler('statusDialog', 'status-dialog:request-stats', (event) => {
            const statusDialog = this.windowManager.windows.statusDialog;
            if (!statusDialog || event.sender !== statusDialog.webContents) { return; }
            
            // Emit event to get system stats
            this.emit('get-system-stats', (stats) => {
                if (!statusDialog.isDestroyed()) { event.sender.send('status-dialog:receive-stats', stats); }
            });
        });
        
        this.registerHandler('statusDialog', 'status-dialog:close', (event) => {
            const statusDialog = this.windowManager.windows.statusDialog;
            if (statusDialog && event.sender === statusDialog.webContents) { statusDialog.close(); }
        });
    }
    
    /**
     * Register handlers for general dialog operations
     */
    registerGeneralDialogHandlers() {
        // These handlers apply to all dialog types or general dialog operations
        this.registerHandler('generalDialog', 'dialog:get-printer-status', (event) => {
            const connected = this.printerConnectionManager.getConnectionStatus();
            const printerInfo = connected ? this.printerConnectionManager.getPrinterInfo() : null;
            
            event.returnValue = { connected, printerInfo };
        });
    }

    /**
     * Clean up all handlers and resources
     */
    dispose() {
        // Remove all handlers
        for (const dialogType in this.handlers) { this.removeAllHandlers(dialogType); }
        
        // Clear references
        this.windowManager = null;
        this.printerConnectionManager = null;
        this.initialized = false;
    }
}

module.exports = DialogHandlerManager;
