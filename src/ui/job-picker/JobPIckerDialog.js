// Helper function to process the legacy thumbnail queue
async function processLegacyThumbnailQueue() {
    if (isProcessingLegacyQueue || legacyThumbnailQueue.length === 0) {
        return; // Already processing or nothing to process
    }
    
    isProcessingLegacyQueue = true;
    
    while (legacyThumbnailQueue.length > 0) {
        const request = legacyThumbnailQueue.shift();
        try {
            // Add a small delay between requests to avoid overwhelming the printer
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Process the request
            await request.processor();
        } catch (error) {
            console.error('Error processing legacy thumbnail:', error);
            // Still send the error response if needed
            if (request.event && !request.event.sender.isDestroyed()) {
                request.event.reply('thumbnail-result', {
                    filename: request.filename,
                    thumbnail: null
                });
            }
        }
    }
    
    isProcessingLegacyQueue = false;
}

// src/dialogs/JobPickerDialog.js
const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
require('fs');

const pLimitImport = require('p-limit');
const pLimit = pLimitImport.default || pLimitImport;
const thumbnailCache = require('../../utils/ThumbnailCache');

// Queue for sequential legacy thumbnail loading
let legacyThumbnailQueue = [];
let isProcessingLegacyQueue = false;

const thumbnailConcurrencyLimit = 4; // For modern printers
const limit = pLimit(thumbnailConcurrencyLimit);

class JobPickerDialog {

    constructor(mainWindow, printerClient) {
        this.mainWindow = mainWindow;
        this.printerClient = printerClient;
        this.dialogWindow = null; // Holds the currently active dialog window instance
        
        // Check if client is using legacy API
        this.isLegacy = printerClient ? printerClient.getClientType() === 'legacy' : false;
        console.log(`JobPickerDialog using legacy mode: ${this.isLegacy}`);
    }

    // Method to update client (useful if main app reconnects)
    updateClient(newPrinterClient) {
        this.printerClient = newPrinterClient;
        console.log("JobPickerDialog printer client updated.");
        
        // Check if client is using legacy API
        this.isLegacy = newPrinterClient ? newPrinterClient.getClientType() === 'legacy' : false;
        console.log(`JobPickerDialog using legacy mode: ${this.isLegacy}`);
    }

    async show(isRecentFiles = false) {
        // --- Prevent multiple dialogs ---
        if (this.dialogWindow && !this.dialogWindow.isDestroyed()) {
            console.log("Job Picker Dialog already open. Focusing.");
            this.dialogWindow.focus();
            return; // Don't open a new one
        }

        if (this.dialogWindow?.isDestroyed()) { this.dialogWindow = null; }

        console.log("Creating new Job Picker Dialog.");
        // Create new dialog window
        this.dialogWindow = new BrowserWindow({
            parent: this.mainWindow,
            modal: true,
            width: 700,
            height: 500,
            minWidth: 700,
            minHeight: 500,
            minimizable: false,
            maximizable: false,
            resizable: true,
            frame: false,
            show: false, // Show after setup
            webPreferences: {
                preload: path.join(__dirname, '../../preload.js'), // Main preload
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        const currentDialogId = this.dialogWindow.id; // For logging
        console.log(`Dialog window created (ID: ${currentDialogId}).`);

        // Load HTML
        try {
            await this.dialogWindow.loadFile(path.join(__dirname, 'job-picker.html'));
            console.log(`Dialog HTML loaded (ID: ${currentDialogId}).`);
        } catch(loadError) {
            console.error(`Failed to load dialog HTML (ID: ${currentDialogId}):`, loadError);
            if (!this.dialogWindow.isDestroyed()) this.dialogWindow.close();
            this.dialogWindow = null;
            return;
        }

        // --- Fetch File List ---
        let files = [];
        let fetchError = null;
        if (!this.printerClient) {
            fetchError = "Printer not connected.";
            console.error(fetchError);
        } else {
            try {
            console.log(`Fetching ${isRecentFiles ? 'recent' : 'local'} files... (Dialog ID: ${currentDialogId})`);
            
            // Regardless of client type, always use the adapter methods which now handle
            // both legacy and modern printers with proper fallbacks
            files = isRecentFiles
                ? await this.printerClient.getRecentFiles()
                : await this.printerClient.getLocalFiles();
            
            console.log(`Fetched ${files.length} files. (Dialog ID: ${currentDialogId})`);
        } catch (error) {
                console.error(`Error getting file list (Dialog ID: ${currentDialogId}):`, error);
                fetchError = error.message || 'Failed to retrieve file list.';
                files = [];
            }
        }

        // Check if window closed before sending
        if (this.dialogWindow?.isDestroyed() || this.dialogWindow?.id !== currentDialogId) {
            console.log(`Dialog (ID: ${currentDialogId}) closed before sending file list.`);
            return;
        }

        // Clean up legacy filenames for better display (strip /data/ prefix if present)
        if (this.isLegacy) {
            files = files.map(file => {
                // Remove /data/ prefix if present
                return file.startsWith('/data/') ? file.substring(6) : file;
            });
        }

        console.log(`Sending file list to dialog (ID: ${currentDialogId}).`);
        this.dialogWindow.webContents.send('job-list', {
            isRecentFiles: isRecentFiles,
            files: files,
            dialogTitle: isRecentFiles ? 'Recent Files' : 'Local Files',
            error: fetchError,
            isLegacy: this.isLegacy
        });


        this.dialogWindow.once('closed', () => {
            console.log(`Dialog window (ID: ${currentDialogId}) has been closed.`);
            if (this.dialogWindow && this.dialogWindow.id === currentDialogId) {
                this.dialogWindow = null;
                console.log("Active dialog window reference nulled.");
            }
        });

        this.dialogWindow.show();
        console.log(`Dialog window shown (ID: ${currentDialogId}).`);
    }

    /**
     * Sets up general IPC handlers related to the job picker.
     * Should be called once during application setup.
     */
    setupIpcHandlers() {
        // Handle requests to show the job picker dialog
        ipcMain.on('show-recent-files', () => this.show(true));
        ipcMain.on('show-local-files', () => this.show(false));

        // Handle job selection from the dialog
        ipcMain.on('job-selected', async (event, data) => {
            // --- Verify sender is the active dialog ---
            if (!this.dialogWindow || event.sender !== this.dialogWindow.webContents || this.dialogWindow.isDestroyed()) {
                console.warn("Received 'job-selected' from invalid sender or closed window.");
                return;
            }

            const windowToClose = this.dialogWindow;
            const windowId = windowToClose.id;

            console.log(`Job selected (${data.filename}). Closing dialog (ID: ${windowId}).`);
            if (!windowToClose.isDestroyed()) { windowToClose.close(); }

            // Check printer connection status
            if (!this.printerClient) {
                console.error("Cannot process job selection: Printer client is not available.");
                this.mainWindow.webContents.send('log-message', `Error selecting ${data.filename}: Printer not connected.`);
                return; // Stop processing
            }

            console.log(`Processing selected job: ${data.filename}, StartNow: ${data.startNow}`);
            try {
                // Start the job if "start now" is checked
                if (data.startNow) {
                    this.mainWindow.webContents.send('log-message', `Sending print command for ${data.filename}...`);
                    
                    if (this.isLegacy) {
                        // Use new legacy print support
                        console.log(`Starting legacy print for ${data.filename}`);
                        try {
                            // The startPrint method will handle the path formatting internally
                            // No need to add /data/ prefix as that's only for thumbnail requests
                            const success = await this.printerClient.getRawClient().startJob(data.filename);
                            if (success) {
                                this.mainWindow.webContents.send('log-message', `Print started: ${data.filename}`);
                                console.log(`Legacy print command successful for ${data.filename}.`);
                            } else {
                                this.mainWindow.webContents.send('log-message', `Failed to start print: ${data.filename}`);
                                console.error(`Legacy print command failed for ${data.filename}.`);
                            }
                        } catch (error) {
                            this.mainWindow.webContents.send('log-message', `Error starting print: ${error.message}`);
                            console.error(`Error starting legacy print: ${error.message}`);
                        }
                    } else {
                        await this.printerClient.getRawClient().jobControl.printLocalFile(
                            data.filename,
                            data.leveling
                        );
                        console.log(`Print command successful for ${data.filename}.`);
                    }
                }

                // Notify main window about the job selection details
                this.mainWindow.webContents.send('job-selection-result', {
                    filename: data.filename,
                    leveling: data.leveling,
                    startNow: data.startNow
                });

            } catch (error) {
                console.error(`Error during job selection processing for ${data.filename}:`, error);
                this.mainWindow.webContents.send('log-message', `Error starting job ${data.filename}: ${error.message}`);
                // Optionally show desktop notification
            }
        });


        ipcMain.on('request-thumbnail', (event, filename) => {
            // Handle both modern and legacy printers
            if (this.isLegacy) {
                // The filename might come without /data/ prefix from the UI since we stripped it earlier
                // Make sure we add the prefix if it doesn't exist when sending to the adapter
                const fullFilename = filename.startsWith('/data/') ? filename : `/data/${filename}`;
                
                // First check if thumbnail is in cache
                if (thumbnailCache.has(filename)) {
                    const cachedThumbnail = thumbnailCache.get(filename);
                    console.log(`Using cached thumbnail for ${filename}`);
                    event.reply('thumbnail-result', {
                        filename: filename,
                        thumbnail: cachedThumbnail
                    });
                    return;
                }
                
                // Define a processor function for this request
                const processor = async () => {
                    const senderId = event.sender.id;
                    if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || event.sender.isDestroyed() || this.dialogWindow.isDestroyed()) {
                        return;
                    }
                    
                    if (!this.printerClient) {
                        console.warn(`Cannot fetch legacy thumbnail for ${filename}: Printer client unavailable.`);
                        if (!event.sender.isDestroyed()) {
                            event.reply('thumbnail-result', { filename, thumbnail: null });
                        }
                        return;
                    }
                    
                    try {
                        console.log(`Fetching legacy thumbnail for ${filename}`);
                        // Always send the full path including /data/ to the adapter
                        const base64Thumbnail = await this.printerClient.getLegacyThumbnail(fullFilename);
                        
                        if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || 
                            event.sender.isDestroyed() || this.dialogWindow.isDestroyed()) { 
                            return; 
                        }
                        
                        if (base64Thumbnail) {
                            // Cache the thumbnail for future requests
                            thumbnailCache.set(filename, base64Thumbnail);
                        }
                        
                        event.reply('thumbnail-result', {
                            filename: filename,
                            thumbnail: base64Thumbnail
                        });
                        
                    } catch (error) {
                        console.error(`Error fetching legacy thumbnail for ${filename}:`, error.message);
                        
                        if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || 
                            event.sender.isDestroyed() || this.dialogWindow.isDestroyed()) { 
                            return; 
                        }
                        
                        event.reply('thumbnail-result', {
                            filename: filename,
                            thumbnail: null
                        });
                    }
                };
                
                // Add to the sequential queue instead of immediate processing
                legacyThumbnailQueue.push({
                    filename,
                    fullFilename,
                    event,
                    processor: processor.bind(this)
                });
                
                // Start processing the queue if not already processing
                processLegacyThumbnailQueue();
                
                return;
            }
            
            limit(async () => {
                const senderId = event.sender.id;
                if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || this.dialogWindow.isDestroyed()) {
                    return;
                }
                // Also check if printer client is valid
                if (!this.printerClient) {
                    console.warn(`Cannot fetch thumbnail for ${filename}: Printer client unavailable.`);
                    // Optionally reply with null if needed by renderer logic
                    // event.reply('thumbnail-result', { filename, thumbnail: null });
                    return;
                }

                // First check if thumbnail is in cache
                if (thumbnailCache.has(filename)) {
                    const cachedThumbnail = thumbnailCache.get(filename);
                    console.log(`Using cached thumbnail for ${filename} (5M/Pro)`);
                    event.reply('thumbnail-result', {
                        filename: filename,
                        thumbnail: cachedThumbnail
                    });
                    return;
                }

                // Check if this is a legacy-format filename that needs conversion
                const apiFileName = filename.startsWith('/data/') ? filename.substring(6) : filename;
                
                // console.log(`Fetching thumbnail for ${filename} requested by Window ID: ${senderId}`);
                try {
                    const thumbnailBuffer = await this.printerClient.getRawClient().files.getGCodeThumbnail(apiFileName)


                    if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || this.dialogWindow.isDestroyed()) { return; }


                    const base64Thumbnail = thumbnailBuffer ? thumbnailBuffer.toString('base64') : null;
                    
                    // Cache the thumbnail if it exists
                    if (base64Thumbnail) {
                        thumbnailCache.set(filename, base64Thumbnail);
                    }
                    
                    event.reply('thumbnail-result', {
                        filename: filename,
                        thumbnail: base64Thumbnail
                    });

                } catch (error) {
                    // Log only the error message for brevity unless debugging
                    console.error(`Error fetching thumbnail for ${filename}:`, error.message);


                    if (!this.dialogWindow || senderId !== this.dialogWindow.webContents.id || this.dialogWindow.isDestroyed()) { return; }

                    event.reply('thumbnail-result', {
                        filename: filename,
                        thumbnail: null
                    });
                }
            }); // End of limit() wrapper
        }); // End of 'request-thumbnail' handler


        // Handle closing dialog via Cancel button / IPC message
        ipcMain.on('close-job-picker', (event) => {
            // --- Verify sender is the active dialog ---
            if (this.dialogWindow && event.sender === this.dialogWindow.webContents && !this.dialogWindow.isDestroyed()) {
                console.log(`Closing job picker via IPC from window (ID: ${this.dialogWindow.id}).`);
                this.dialogWindow.close(); // Close the dialog window
            } else {
                console.warn("Received 'close-job-picker' from invalid sender or closed/inactive window.");
            }
        });
    } // End of setupIpcHandlers
}

module.exports = JobPickerDialog;