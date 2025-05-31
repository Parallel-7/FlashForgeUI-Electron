const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const EventEmitter = require('events');

/**
 * DialogManager
 * 
 * Manages all dialog windows for the application
 * Responsible for:
 * - Creating and managing dialog windows
 * - Providing a consistent API for dialog operations
 * - Handling dialog-related IPC events
 * - Ensuring proper cleanup of dialog resources
 */
class DialogManager extends EventEmitter {
    /**
     * Create a new DialogManager instance
     * 
     * @param {WindowManager} windowManager - The window manager instance
     */
    constructor(windowManager) {
        super();
        this.windowManager = windowManager;
        this.activeDialogs = new Map();
        this.ipcHandlers = new Map();
        this.initialized = false;
    }
    
    /**
     * Initialize the DialogManager
     */
    initialize() {
        if (this.initialized) {
            console.warn('DialogManager already initialized');
            return;
        }
        
        this.initialized = true;
    }
    
    /**
     * Register an IPC handler for a dialog
     * 
     * @param {string} channel - The IPC channel
     * @param {Function} handler - The handler function
     * @param {boolean} [isInvokable=false] - Whether this handler is invokable (handle vs on)
     */
    registerIPCHandler(channel, handler, isInvokable = false) {
        // Store the handler for later cleanup
        this.ipcHandlers.set(channel, {
            handler,
            isInvokable
        });
        
        // Register the handler with ipcMain
        if (isInvokable) {
            ipcMain.handle(channel, handler);
        } else {
            ipcMain.on(channel, handler);
        }
        
        console.log(`DialogManager registered IPC ${isInvokable ? 'invokable ' : ''}handler for ${channel}`);
    }
    
    /**
     * Remove an IPC handler
     * 
     * @param {string} channel - The IPC channel
     */
    removeIPCHandler(channel) {
        const handlerInfo = this.ipcHandlers.get(channel);
        if (!handlerInfo) {
            return;
        }
        
        // Remove the handler based on its type
        if (handlerInfo.isInvokable) {
            ipcMain.removeHandler(channel);
        } else {
            ipcMain.removeListener(channel, handlerInfo.handler);
        }
        
        // Remove from our map
        this.ipcHandlers.delete(channel);
        
        console.log(`DialogManager removed IPC handler for ${channel}`);
    }
    
    /**
     * Show an input dialog with the given options
     * 
     * @param {Object} options - Dialog options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} [options.defaultValue=''] - Default input value
     * @param {string} [options.inputType='text'] - Input type (text, password, etc.)
     * @param {string} [options.placeholder=''] - Placeholder text
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<string|null>} User input or null if canceled
     */
    showInputDialog(options, parentWindow = null) {
        const { title, message, defaultValue = '', inputType = 'text', placeholder = '' } = options;
        
        return new Promise((resolve) => {
            // Generate a unique ID for this dialog
            const dialogId = `dialog-${Date.now()}`;
            const resultChannel = `dialog-result-${dialogId}`;
            
            // Use parent window or fallback to main window
            const parent = parentWindow || this.windowManager.getMainWindow();
            
            const dialogWindow = new BrowserWindow({
                width: 400,
                height: 250,
                parent: parent,
                modal: true,
                show: false,
                frame: false,
                resizable: false,
                webPreferences: {
                    preload: path.join(__dirname, '../../ui/dialog/dialog-preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });
            
            // Store the dialog window
            this.activeDialogs.set(dialogId, dialogWindow);
            
            dialogWindow.loadFile(path.join(__dirname, '../../ui/dialog/dialog.html'));
            
            // Listener for the specific response
            const resultHandler = (event, result) => {
                if (event.sender !== dialogWindow.webContents) return;
                
                console.log(`Dialog ${dialogId} result:`, result);
                if (!dialogWindow.isDestroyed()) {
                    dialogWindow.close();
                }
                resolve(result); // Resolve with the value or null
            };
            
            // Register the result handler
            this.registerIPCHandler(resultChannel, resultHandler);
            
            dialogWindow.webContents.on('did-finish-load', () => {
                // Send initialization data including the unique response channel
                dialogWindow.webContents.send('dialog-init', {
                    title,
                    message,
                    defaultValue,
                    inputType,
                    placeholder,
                    responseChannel: resultChannel // Tell dialog where to send result
                });
                dialogWindow.show();
            });
            
            dialogWindow.on('closed', () => {
                // Clean up
                this.removeIPCHandler(resultChannel);
                this.activeDialogs.delete(dialogId);
                
                // If the dialog is closed without a response, resolve with null
                resolve(null);
            });
        });
    }
    
    /**
     * Show a confirmation dialog
     * 
     * @param {Object} options - Dialog options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} [options.okButtonText='OK'] - Text for the OK button
     * @param {string} [options.cancelButtonText='Cancel'] - Text for the Cancel button
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<boolean>} true if confirmed, false if canceled
     */
    showConfirmationDialog(options, parentWindow = null) {
        const { title, message, okButtonText = 'OK', cancelButtonText = 'Cancel' } = options;
        
        // Customize the input dialog for confirmation
        return this.showInputDialog({
            title,
            message,
            defaultValue: '',
            inputType: 'hidden', // Hide the input field
            placeholder: '',
            okButtonText,
            cancelButtonText
        }, parentWindow).then(result => result !== null);
    }
    
    /**
     * Show a message dialog
     * 
     * @param {Object} options - Dialog options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} [options.type='info'] - Dialog type (info, warning, error)
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<void>}
     */
    showMessageDialog(options, parentWindow = null) {
        const { title, message, type = 'info' } = options;
        
        return this.showInputDialog({
            title,
            message,
            inputType: 'hidden', // Hide the input field
            type
        }, parentWindow).then(() => {});
    }
    
    /**
     * Show a file selection dialog
     * 
     * @param {Object} options - Dialog options
     * @param {string} options.title - Dialog title
     * @param {Array<Object>} [options.filters=[]] - File filters
     * @param {boolean} [options.multiSelections=false] - Allow multiple selections
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<string[]|null>} Selected file paths or null if canceled
     */
    showFileDialog(options, parentWindow = null) {
        const { title, filters = [], multiSelections = false } = options;
        
        // Use parent window or fallback to main window
        const parent = parentWindow || this.windowManager.getMainWindow();
        
        return dialog.showOpenDialog(parent, {
            title,
            properties: [
                'openFile',
                ...(multiSelections ? ['multiSelections'] : [])
            ],
            filters
        }).then(result => {
            if (result.canceled) {
                return null;
            }
            return result.filePaths;
        });
    }
    
    /**
     * Show a file save dialog
     * 
     * @param {Object} options - Dialog options
     * @param {string} options.title - Dialog title
     * @param {string} [options.defaultPath=''] - Default path
     * @param {Array<Object>} [options.filters=[]] - File filters
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<string|null>} Selected file path or null if canceled
     */
    showFileSaveDialog(options, parentWindow = null) {
        const { title, defaultPath = '', filters = [] } = options;
        
        // Use parent window or fallback to main window
        const parent = parentWindow || this.windowManager.getMainWindow();
        
        return dialog.showSaveDialog(parent, {
            title,
            defaultPath,
            filters
        }).then(result => {
            if (result.canceled) {
                return null;
            }
            return result.filePath;
        });
    }

    /**
     * Show the job uploader dialog
     * 
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {Promise<Object|null>} Upload result or null if canceled
     */
    showJobUploaderDialog(parentWindow = null) {
        // Create the job uploader window directly
        const parent = parentWindow || this.windowManager.getMainWindow();
        
        const jobUploaderWindow = new BrowserWindow({
            width: 950,
            height: 550,
            minWidth: 950,
            minHeight: 550,
            parent: parent,
            modal: true,
            show: false,
            frame: false,
            resizable: true,
            webPreferences: {
                preload: path.join(__dirname, '../../ui/job-uploader/job-uploader-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        
        jobUploaderWindow.loadFile(path.join(__dirname, '../../ui/job-uploader/job-uploader.html'));
        
        jobUploaderWindow.once('ready-to-show', () => {
            jobUploaderWindow.show();
        });
        
        return new Promise((resolve) => {
            // Add event listeners for upload success or cancel
            const uploadSuccessHandler = (event, result) => {
                if (event.sender !== jobUploaderWindow.webContents) return;
                resolve(result);
            };
            
            const uploadCancelHandler = (event) => {
                if (event.sender !== jobUploaderWindow.webContents) return;
                resolve(null);
            };
            
            // Register handlers
            this.registerIPCHandler('uploader:upload-success', uploadSuccessHandler);
            this.registerIPCHandler('uploader:cancel', uploadCancelHandler);
            
            // Store the window in the windowManager for other components to access
            if (this.windowManager.windows) {
                this.windowManager.windows.jobUploader = jobUploaderWindow;
            }
            
            // Clean up when the window is closed
            jobUploaderWindow.on('closed', () => {
                this.removeIPCHandler('uploader:upload-success');
                this.removeIPCHandler('uploader:cancel');
                
                // Reset the window reference in windowManager
                if (this.windowManager.windows) {
                    this.windowManager.windows.jobUploader = null;
                }
                
                resolve(null); // If closed without resolution
            });
        });
    }
    
    /**
     * Show the command terminal dialog
     * 
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {BrowserWindow} The command terminal window
     */
    showCommandTerminalDialog(parentWindow = null) {
        // Create the send commands window directly
        const parent = parentWindow || this.windowManager.getMainWindow();
        
        const sendCmdsWindow = new BrowserWindow({
            width: 600,
            height: 500,
            minWidth: 500,
            minHeight: 400,
            parent: parent,
            modal: false,
            show: false,
            frame: false,
            resizable: true,
            webPreferences: {
                preload: path.join(__dirname, '../../ui/send-cmds/send-cmds-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        
        sendCmdsWindow.loadFile(path.join(__dirname, '../../ui/send-cmds/send-cmds.html'));
        
        sendCmdsWindow.once('ready-to-show', () => {
            sendCmdsWindow.show();
        });
        
        // Store the window in the windowManager for other components to access
        if (this.windowManager.windows) {
            this.windowManager.windows.sendCmds = sendCmdsWindow;
        }
        
        // Clean up when the window is closed
        sendCmdsWindow.on('closed', () => {
            // Reset the window reference in windowManager
            if (this.windowManager.windows) {
                this.windowManager.windows.sendCmds = null;
            }
        });
        
        return sendCmdsWindow;
    }
    
    /**
     * Show the status dialog
     * 
     * @param {BrowserWindow} [parentWindow=null] - Parent window (defaults to main window)
     * @returns {BrowserWindow} The status dialog window
     */
    showStatusDialog(parentWindow = null) {
        // Create the status dialog window directly
        const parent = parentWindow || this.windowManager.getMainWindow();
        
        const statusDialog = new BrowserWindow({
            width: 480,
            height: 600,
            minWidth: 450,
            minHeight: 550,
            parent: parent,
            modal: false,
            show: false,
            frame: false,
            resizable: true,
            webPreferences: {
                preload: path.join(__dirname, '../../ui/status-dialog/status-dialog-preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        
        statusDialog.loadFile(path.join(__dirname, '../../ui/status-dialog/status-dialog.html'));
        
        statusDialog.once('ready-to-show', () => {
            statusDialog.show();
        });
        
        // Store the window in the windowManager for other components to access
        if (this.windowManager.windows) {
            this.windowManager.windows.statusDialog = statusDialog;
        }
        
        // Clean up when the window is closed
        statusDialog.on('closed', () => {
            // Reset the window reference in windowManager
            if (this.windowManager.windows) {
                this.windowManager.windows.statusDialog = null;
            }
        });
        
        return statusDialog;
    }
    
    /**
     * Close all active dialogs
     */
    closeAllDialogs() {
        for (const [, dialogWindow] of this.activeDialogs.entries()) {
            if (dialogWindow && !dialogWindow.isDestroyed()) {
                dialogWindow.close();
            }
        }
        this.activeDialogs.clear();
    }
    
    /**
     * Dispose of all resources and clean up
     */
    dispose() {
        // Close all dialogs
        this.closeAllDialogs();
        
        // Remove all IPC handlers
        for (const [channel, handlerInfo] of this.ipcHandlers.entries()) {
            if (handlerInfo.isInvokable) {
                ipcMain.removeHandler(channel);
            } else {
                ipcMain.removeListener(channel, handlerInfo.handler);
            }
        }
        this.ipcHandlers.clear();
        
        // Clear references
        this.windowManager = null;
        
        this.initialized = false;
    }
}

module.exports = DialogManager;
