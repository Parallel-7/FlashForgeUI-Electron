// src/manager/ipc/handlers/DialogIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles dialog-related IPC operations
 * Includes input dialogs, confirmation dialogs, message dialogs, and file dialogs
 */
class DialogIPCHandler extends IPCHandlerBase {
    constructor(windowManager, dialogManager) {
        super('dialog', windowManager);
        this.dialogManager = dialogManager;
    }
    
    /**
     * Initialize all dialog handlers
     */
    initialize() {
        this.registerInputDialogHandlers();
        this.registerMessageDialogHandlers();
        this.registerFileDialogHandlers();
        
        console.log(`[${this.category}] Dialog handlers initialized`);
    }
    
    /**
     * Register input and confirmation dialog handlers
     */
    registerInputDialogHandlers() {
        this.registerHandler('show-input-dialog', async (event, dialogOptions) => {
            const result = await this.dialogManager.showInputDialog(dialogOptions);
            
            const mainWindow = this.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('dialog-response', result);
            }
        });
        
        this.registerHandler('show-confirmation-dialog', async (event, dialogOptions) => {
            const result = await this.dialogManager.showConfirmationDialog(dialogOptions);
            
            const mainWindow = this.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('dialog-confirmation-response', result);
            }
        });
    }
    
    /**
     * Register message dialog handlers
     */
    registerMessageDialogHandlers() {
        this.registerHandler('show-message-dialog', async (event, dialogOptions) => {
            await this.dialogManager.showMessageDialog(dialogOptions);
        });
    }
    
    /**
     * Register file dialog handlers
     */
    registerFileDialogHandlers() {
        this.registerHandler('show-file-dialog', async (event, dialogOptions) => {
            const result = await this.dialogManager.showFileDialog(dialogOptions);
            event.reply('file-dialog-response', result);
        });
        
        this.registerHandler('show-file-save-dialog', async (event, dialogOptions) => {
            const result = await this.dialogManager.showFileSaveDialog(dialogOptions);
            event.reply('file-save-dialog-response', result);
        });
    }
}

module.exports = DialogIPCHandler;
