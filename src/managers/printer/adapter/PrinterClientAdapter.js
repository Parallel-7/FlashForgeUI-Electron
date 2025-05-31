// src/utils/PrinterClientAdapter.js
const { FiveMClient, FlashForgeClient, MachineState, MachineStatus, MoveMode } = require('ff-api');
const configManager = require('../../ConfigManager');
require('fs');
const path = require('path');

const { EventEmitter } = require('events');

/**
 * Command mapping configuration for different client types
 * Centralizes all client type differences in one place
 */
const COMMAND_MAPPING = {
    // Printer control commands
    'homeAxes': {
        fivem: { path: 'control', method: 'homeAxes' },
        legacy: { path: '', method: 'homeAxes' },
        legacySupported: true
    },
    
    // LED control commands
    'setLedOn': {
        fivem: { path: 'control', method: 'setLedOn' },
        legacy: { path: '', method: 'ledOn' },
        legacySupported: true,
        customLedsFallback: { fivem: { path: 'tcpClient', method: 'ledOn' } }
    },
    'setLedOff': {
        fivem: { path: 'control', method: 'setLedOff' },
        legacy: { path: '', method: 'ledOff' },
        legacySupported: true,
        customLedsFallback: { fivem: { path: 'tcpClient', method: 'ledOff' } }
    },
    
    // Temperature control commands
    'setExtruderTemp': {
        fivem: { path: 'tempControl', method: 'setExtruderTemp' },
        legacy: { path: '', method: 'setExtruderTemp' },
        legacySupported: true
    },
    'cancelExtruderTemp': {
        fivem: { path: 'tempControl', method: 'cancelExtruderTemp' },
        legacy: { path: '', method: 'cancelExtruderTemp' },
        legacySupported: true
    },
    'setBedTemp': {
        fivem: { path: 'tempControl', method: 'setBedTemp' },
        legacy: { path: '', method: 'setBedTemp' },
        legacySupported: true
    },
    'cancelBedTemp': {
        fivem: { path: 'tempControl', method: 'cancelBedTemp' },
        legacy: { path: '', method: 'cancelBedTemp' },
        legacySupported: true
    },
    
    // Job control commands
    'pausePrintJob': {
        fivem: { path: 'jobControl', method: 'pausePrintJob' },
        legacy: { path: '', method: 'pauseJob' },
        legacySupported: true
    },
    'resumePrintJob': {
        fivem: { path: 'jobControl', method: 'resumePrintJob' },
        legacy: { path: '', method: 'resumeJob' },
        legacySupported: true
    },
    'cancelPrintJob': {
        fivem: { path: 'jobControl', method: 'cancelPrintJob' },
        legacy: { path: '', method: 'stopJob' },
        legacySupported: true
    },
    'clearPlatform': {
        fivem: { path: 'jobControl', method: 'clearPlatform' },
        legacy: null,
        legacySupported: false,
        unsupportedMessage: 'Clear platform not supported on legacy printers'
    },
    
    // Filtration control commands (5M/Pro only)
    'setExternalFiltrationOn': {
        fivem: { path: 'control', method: 'setExternalFiltrationOn' },
        legacy: null,
        legacySupported: false,
        unsupportedMessage: 'External filtration not supported on legacy printers'
    },
    'setInternalFiltrationOn': {
        fivem: { path: 'control', method: 'setInternalFiltrationOn' },
        legacy: null,
        legacySupported: false,
        unsupportedMessage: 'Internal filtration not supported on legacy printers'
    },
    'setFiltrationOff': {
        fivem: { path: 'control', method: 'setFiltrationOff' },
        legacy: null,
        legacySupported: false,
        unsupportedMessage: 'Filtration control not supported on legacy printers'
    },
    
    // File operations
    'getRecentFiles': {
        fivem: { path: 'files', method: 'getRecentFileList' },
        legacy: { path: '', method: 'getFileListAsync', postProcess: 'sliceFirst10' },
        legacySupported: true
    },
    'getLocalFiles': {
        fivem: { path: 'files', method: 'getLocalFileList' },
        legacy: { path: '', method: 'getFileListAsync' },
        legacySupported: true
    },
    
    // Upload operations (complex, handled separately)
    'uploadFile': {
        fivem: { path: 'jobControl', method: 'uploadFile' },
        legacy: null,
        legacySupported: true,
        requiresCustomLogic: true
    }
};

/**
 * Adapter class that provides a unified interface for different printer client implementations
 * (FiveMClient for modern 5M/Pro printers and FlashForgeClient for legacy printers)
 * @extends EventEmitter
 */
class PrinterClientAdapter extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.clientType = null; // 'fivem' or 'legacy'
        this.isPro = false;
        this.ipAddress = '';
        this.serialNumber = '';
        this.checkCode = '123';
        this.printerName = '';
        this.isUploadInProgress = false; // Flag to track when a file upload is in progress
        this.uploadLock = null; // Promise used as a lock during uploads
        this._lastMachineState = null; // Track last state for change detection
        this._lastBedTemp = null; // Track last bed temp for change detection
        this._lastExtruderTemp = null; // Track last extruder temp for change detection
    }

    /**
     * Check if it's safe to send commands to the printer
     * @returns {Promise<boolean>} Whether commands can be sent
     */
    async canSendCommands() {
        if (this.isUploadInProgress) {
            console.log('Command blocked: File upload in progress');
            this.emit('command-blocked', 'File upload in progress');
            return false;
        }
        return true;
    }

    /**
     * Execute a command using the client type delegation system
     * @param {string} commandName Command name from COMMAND_MAPPING
     * @param {...any} args Arguments to pass to the command
     * @returns {Promise<any>} Command result
     */
    async executeCommand(commandName, ...args) {
        if (!this.client) {
            throw new Error('Printer not connected');
        }

        const mapping = COMMAND_MAPPING[commandName];
        if (!mapping) {
            throw new Error(`Unknown command: ${commandName}`);
        }

        // Check if command is supported on this client type
        if (!mapping.legacySupported && this.clientType === 'legacy') {
            const message = mapping.unsupportedMessage || `${commandName} not supported on legacy printers`;
            throw new Error(message);
        }

        const clientConfig = mapping[this.clientType];
        if (!clientConfig) {
            throw new Error(`Command ${commandName} not configured for ${this.clientType}`);
        }

        // Handle special LED commands with custom LEDs fallback
        if ((commandName === 'setLedOn' || commandName === 'setLedOff') && this.clientType === 'fivem') {
            const customLeds = configManager.get('CustomLeds');
            if (customLeds && mapping.customLedsFallback) {
                const fallbackConfig = mapping.customLedsFallback.fivem;
                const client = this.client[fallbackConfig.path];
                return await client[fallbackConfig.method](...args);
            }
        }

        // Execute the command
        const client = clientConfig.path ? this.client[clientConfig.path] : this.client;
        const result = await client[clientConfig.method](...args);

        // Handle post-processing
        if (clientConfig.postProcess === 'sliceFirst10') {
            return result.slice(0, 10);
        }

        return result;
    }

    /**
     * Execute a command with full error handling and event emission
     * @param {string} commandName Command name from COMMAND_MAPPING
     * @param {...any} args Arguments to pass to the command
     * @returns {Promise<any>} Command result or false on error
     */
    async executeCommandWithHandling(commandName, ...args) {
        if (!await this.canSendCommands()) {
            return false;
        }

        try {
            const result = await this.executeCommand(commandName, ...args);
            this.emit('command-executed', { command: commandName, result });
            return result;
        } catch (error) {
            this.emit('command-failed', { 
                command: commandName, 
                error: error.message,
                unsupported: error.message.includes('not supported')
            });
            
            // Don't emit general error for unsupported operations
            if (!error.message.includes('not supported')) {
                this.emit('error', error);
            }
            
            return false;
        }
    }

    /**
     * Send a raw command to the printer
     * @param {string} command Command string to send
     * @returns {Promise<string>} Command response or empty string on error
     */
    async sendRawCmd(command) {
        if (!this.client) {
            this.emit('error', new Error('Printer not connected'));
            return '';
        }
        
        if (!await this.canSendCommands()) {
            this.emit('error', new Error('Cannot send command: Upload in progress'));
            return '';
        }
        
        try {
            let response;
            if (this.clientType === "legacy") {
                response = await this.client.sendRawCmd(command);
            } else {
                response = await this.client.tcpClient.sendRawCmd(command);
            }
            
            this.emit('command-executed', { 
                command: 'sendRawCmd', 
                rawCommand: command, 
                response 
            });
            
            return response;
        } catch (error) {
            this.emit('command-failed', { 
                command: 'sendRawCmd', 
                rawCommand: command, 
                error: error.message 
            });
            
            this.emit('error', error);
            return '';
        }
    }

    /**
     * Helper to acquire a lock during uploads
     * @returns {Promise<Function>} Resolver function to release the lock
     */
    async acquireUploadLock() {
        if (this.uploadLock) {
            await this.uploadLock;
        }
        
        let lockResolver;
        this.uploadLock = new Promise(resolve => {
            lockResolver = resolve;
        });
        
        return lockResolver;
    }

    /**
     * Connect to a printer
     * @param {string} ipAddress Printer IP address
     * @param {string} serialNumber Printer serial number
     * @param {boolean} legacyMode Whether this is a legacy printer
     * @param {string} printerName Printer name
     * @param {string} checkCode Check code for authorization (5M/Pro only)
     * @returns {Promise<boolean>} Whether connection was successful
     */
    async connect(ipAddress, serialNumber, legacyMode, printerName, checkCode = '') {
        this.ipAddress = ipAddress;
        this.serialNumber = serialNumber;
        this.printerName = printerName;
        
        this.emit('connecting', { 
            ipAddress, 
            serialNumber, 
            printerName, 
            legacyMode 
        });
        
        const forceLegacyAPI = configManager.get('ForceLegacyAPI');

        try {
            if (!legacyMode && !forceLegacyAPI) {
                if (!checkCode) {
                    const error = new Error('Check code is required for 5M/Pro printers');
                    this.emit('connection-failed', error);
                    return false;
                }
                
                this.checkCode = checkCode;
                this.clientType = 'fivem';
                this.client = new FiveMClient(ipAddress, serialNumber, checkCode);
                
                const initialized = await this.client.initialize();
                if (!initialized) {
                    const error = new Error(`Failed to initialize client for ${ipAddress}`);
                    this.emit('connection-failed', error);
                    console.error(error.message);
                    return false;
                }

                const controlOk = await this.client.initControl();
                if (!controlOk) {
                    const error = new Error(`Failed to initialize control for ${ipAddress}`);
                    this.emit('connection-failed', error);
                    console.error(error.message);
                    return false;
                }
                
                this.emit('connected', {
                    ipAddress,
                    serialNumber,
                    printerName,
                    clientType: this.clientType
                });
                
                return true;
            } else {
                this.clientType = 'legacy';
                this.client = new FlashForgeClient(ipAddress);
                
                const controlOk = await this.client.initControl();
                if (!controlOk) {
                    const error = new Error(`Failed to initialize FlashForgeClient for ${ipAddress}`);
                    this.emit('connection-failed', error);
                    console.error(error.message);
                    return false;
                }
                
                console.log(`Connected to printer ${this.printerName} using legacy API`);
                
                this.emit('connected', {
                    ipAddress,
                    serialNumber,
                    printerName,
                    clientType: this.clientType
                });
                
                return true;
            }
        } catch (error) {
            this.emit('connection-failed', error);
            console.error(`Error connecting to printer: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Dispose of printer client resources
     */
    dispose() {
        if (this.client) {
            this.client.dispose();
            this.client = null;
            this.emit('disconnected');
        }
    }
    
    /**
     * Get printer info in a consistent format
     * @returns {Promise<Object|null>} Printer info object or null if error
     */
    async getPrinterInfo() {
        if (!this.client) {
            this.emit('error', new Error('Printer not connected'));
            return null;
        }
        
        // Skip if upload in progress
        if (!await this.canSendCommands()) {
            const uploadInfo = {
                Name: this.printerName || '-',
                SerialNumber: this.serialNumber || '-',
                MachineState: MachineState.Busy,
                Status: 'Uploading File',
                PrintProgressInt: 0,
                PrintBed: { current: 0, set: 0 },
                Extruder: { current: 0, set: 0 },
            };
            
            this.emit('printer-info-updated', uploadInfo);
            return uploadInfo;
        }
        
        try {
            let info;
            
            if (this.clientType === 'fivem') {
                info = await this.client.info.get();
            } else {
                // For legacy clients, construct compatible info object from TCP API
                const tcpInfo = await this.client.getPrinterInfo();
                const tempInfo = await this.client.getTempInfo();
                const printStatus = await this.client.getPrintStatus();
                const endstopStatus = await this.client.getEndstopInfo();
                
                if (!tcpInfo) {
                    this.emit('error', new Error('Failed to get printer info'));
                    return null;
                }
                
                const machineState = this.mapEndstopStatusToMachineState(endstopStatus);
                const currentFile = endstopStatus?._CurrentFile || '';
                
                info = {
                    Name: tcpInfo.Name,
                    FirmwareVersion: tcpInfo.FirmwareVersion,
                    MacAddress: tcpInfo.MacAddress,
                    SerialNumber: this.serialNumber,
                    MachineType: tcpInfo.TypeName,
                    MachineState: machineState,
                    Status: this.getMachineStatusText(endstopStatus),
                    PrintFileName: currentFile,
                    JobName: currentFile,
                    PrintProgressInt: printStatus?.getPrintPercent() || 0,
                    JobTimeRemaining: '',
                    CurrentPrintLayer: printStatus?._layerCurrent,
                    TotalPrintLayers: printStatus?._layerTotal,
                    PrintBed: {
                        current: tempInfo ? tempInfo.getBedTemp().getCurrent() : 0,
                        set: tempInfo ? tempInfo.getBedTemp().getSet() : 0
                    },
                    Extruder: {
                        current: tempInfo ? tempInfo.getExtruderTemp().getCurrent() : 0,
                        set: tempInfo ? tempInfo.getExtruderTemp().getSet() : 0
                    },
                    CameraStreamUrl: `http://${this.ipAddress}:8080/?action=stream`,
                    FormattedTotalRunTime: 'Not available',
                    CoolingFanSpeed: 'Not available',
                    ChamberFanSpeed: 'Not available',
                };
            }
            
            // Emit events for state changes
            if (this._lastMachineState !== info.MachineState) {
                this.emit('machine-state-changed', info.MachineState, this._lastMachineState, info);
                this._lastMachineState = info.MachineState;
            }
            
            const bedTemp = info.PrintBed?.current;
            const extruderTemp = info.Extruder?.current;
            
            if (this._lastBedTemp !== bedTemp) {
                this.emit('bed-temperature-changed', bedTemp, this._lastBedTemp);
                this._lastBedTemp = bedTemp;
            }
            
            if (this._lastExtruderTemp !== extruderTemp) {
                this.emit('extruder-temperature-changed', extruderTemp, this._lastExtruderTemp);
                this._lastExtruderTemp = extruderTemp;
            }
            
            this.emit('printer-info-updated', info);
            return info;
        } catch (error) {
            this.emit('error', error);
            console.error('Error getting printer info:', error);
            return null;
        }
    }
    
    /**
     * Map endstop status to machine state enum
     * @param {Object} endstopStatus Endstop status object
     * @returns {MachineState} Machine state enum value
     */
    mapEndstopStatusToMachineState(endstopStatus) {
        if (!endstopStatus) return MachineState.Unknown;
        
        const machineStatus = endstopStatus._MachineStatus;

        if (machineStatus === MachineStatus.BUILDING_FROM_SD) {
            return MachineState.Printing;
        } else if (machineStatus === MachineStatus.BUILDING_COMPLETED) {
            return MachineState.Completed;
        } else if (machineStatus === MachineStatus.PAUSED) {
            return MachineState.Paused;
        } else if (machineStatus === MachineStatus.BUSY) {
            return MachineState.Busy;
        } else if (machineStatus === MachineStatus.READY) {
            return MachineState.Ready;
        } else {
            return MachineState.Unknown;
        }
    }
    
    /**
     * Get descriptive text for machine status
     * @param {Object} endstopStatus Endstop status object
     * @returns {string} Status text
     */
    getMachineStatusText(endstopStatus) {
        if (!endstopStatus) return 'Unknown';
        
        const machineStatus = endstopStatus._MachineStatus;
        const moveMode = endstopStatus._MoveMode;

        if (machineStatus === MachineStatus.BUILDING_FROM_SD) {
            if (moveMode === MoveMode.HOMING) return "Homing";
            if (moveMode !== MoveMode.MOVING) return "Busy";
            return "Printing";
        } else if (machineStatus === MachineStatus.BUILDING_COMPLETED) {
            return "Completed";
        } else if (machineStatus === MachineStatus.PAUSED) {
            return "Paused";
        } else if (machineStatus === MachineStatus.BUSY) {
            return "Busy";
        } else if (machineStatus === MachineStatus.READY) {
            return "Idle";
        } else {
            return "Err";
        }
    }
    
    // ===== DELEGATED COMMAND METHODS =====
    // All methods below now use the delegation system instead of if statements
    
    /**
     * Home printer axes
     * @returns {Promise<boolean>} Whether command was successful
     */
    async homeAxes() {
        return await this.executeCommandWithHandling('homeAxes');
    }
    
    /**
     * Turn on printer LED
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setLedOn() {
        return await this.executeCommandWithHandling('setLedOn');
    }
    
    /**
     * Turn off printer LED
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setLedOff() {
        return await this.executeCommandWithHandling('setLedOff');
    }
    
    /**
     * Set extruder temperature
     * @param {number} temp Temperature in degrees Celsius
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setExtruderTemp(temp) {
        return await this.executeCommandWithHandling('setExtruderTemp', temp);
    }
    
    /**
     * Cancel extruder temperature (turn off heating)
     * @returns {Promise<boolean>} Whether command was successful
     */
    async cancelExtruderTemp() {
        return await this.executeCommandWithHandling('cancelExtruderTemp');
    }
    
    /**
     * Set bed temperature
     * @param {number} temp Temperature in degrees Celsius
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setBedTemp(temp) {
        return await this.executeCommandWithHandling('setBedTemp', temp);
    }
    
    /**
     * Cancel bed temperature (turn off heating)
     * @returns {Promise<boolean>} Whether command was successful
     */
    async cancelBedTemp() {
        return await this.executeCommandWithHandling('cancelBedTemp');
    }
    
    /**
     * Set external filtration on
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setExternalFiltrationOn() {
        return await this.executeCommandWithHandling('setExternalFiltrationOn');
    }
    
    /**
     * Set internal filtration on
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setInternalFiltrationOn() {
        return await this.executeCommandWithHandling('setInternalFiltrationOn');
    }
    
    /**
     * Turn off filtration
     * @returns {Promise<boolean>} Whether command was successful
     */
    async setFiltrationOff() {
        return await this.executeCommandWithHandling('setFiltrationOff');
    }
    
    /**
     * Pause print job
     * @returns {Promise<boolean>} Whether command was successful
     */
    async pausePrintJob() {
        return await this.executeCommandWithHandling('pausePrintJob');
    }
    
    /**
     * Resume print job
     * @returns {Promise<boolean>} Whether command was successful
     */
    async resumePrintJob() {
        return await this.executeCommandWithHandling('resumePrintJob');
    }
    
    /**
     * Cancel print job
     * @returns {Promise<boolean>} Whether command was successful
     */
    async cancelPrintJob() {
        return await this.executeCommandWithHandling('cancelPrintJob');
    }
    
    /**
     * Clear platform (only available on 5M/Pro printers)
     * @returns {Promise<boolean>} Whether command was successful
     */
    async clearPlatform() {
        return await this.executeCommandWithHandling('clearPlatform');
    }
    
    /**
     * Upload file to printer
     * @param {string} filePath Path to the file
     * @param {boolean} startNow Whether to start printing immediately
     * @param {boolean} autoLevel Whether to auto-level
     * @returns {Promise<boolean>} Whether upload was successful
     */
    async uploadFile(filePath, startNow = false, autoLevel = false) {
        if (!this.client) {
            this.emit('error', new Error('Printer not connected'));
            return false;
        }
        
        const releaseLock = await this.acquireUploadLock();
        this.isUploadInProgress = true;
        console.log('Upload lock acquired - all printer communications paused');
        this.emit('upload-started', { filePath, startNow, autoLevel });
        
        try {
            let result;
            if (this.clientType === 'fivem') {
                result = await this.client.jobControl.uploadFile(filePath, startNow, autoLevel);
            } else {
                console.log(`Legacy file upload: ${filePath} (startNow: ${startNow}, autoLevel: ${autoLevel})`);
                result = true; // Placeholder for legacy implementation
            }
            
            if (result) {
                this.emit('upload-completed', { 
                    filePath, 
                    filename: path.basename(filePath),
                    startNow, 
                    autoLevel 
                });
            } else {
                this.emit('upload-failed', { 
                    filePath, 
                    filename: path.basename(filePath),
                    error: 'Upload rejected by printer'
                });
            }
            
            return result;
        } catch (error) {
            this.emit('upload-failed', { 
                filePath, 
                filename: path.basename(filePath),
                error: error.message
            });
            
            this.emit('error', error);
            console.error("Error during file upload:", error);
            return false;
        } finally {
            this.isUploadInProgress = false;
            releaseLock();
            console.log('Upload lock released - normal printer communications resumed');
            this.emit('upload-lock-released');
        }
    }
    
    /**
     * Get recent files from the printer
     * @returns {Promise<Array>} List of recent files
     */
    async getRecentFiles() {
        try {
            const files = await this.executeCommandWithHandling('getRecentFiles');
            if (files !== false) {
                this.emit('files-listed', { type: 'recent', count: files.length });
            }
            return files || [];
        } catch (error) {
            console.error("Error retrieving recent files:", error);
            return [];
        }
    }
    
    /**
     * Get all local files from the printer
     * @returns {Promise<Array>} List of local files
     */
    async getLocalFiles() {
        try {
            const files = await this.executeCommandWithHandling('getLocalFiles');
            if (files !== false) {
                this.emit('files-listed', { type: 'local', count: files.length });
            }
            return files || [];
        } catch (error) {
            console.error("Error retrieving local files:", error);
            return [];
        }
    }
    
    /**
     * Get thumbnail for legacy printers
     * @param {string} filename File name
     * @returns {Promise<Buffer|null>} Thumbnail buffer or null if not available
     */
    async getLegacyThumbnail(filename) {
        if (!this.client || this.clientType !== 'legacy') {
            if (this.clientType !== 'legacy') {
                this.emit('error', new Error('getLegacyThumbnail only supported on legacy printers'));
            } else {
                this.emit('error', new Error('Printer not connected'));
            }
            return null;
        }
        
        if (!await this.canSendCommands()) {
            return null;
        }
        
        try {
            const baseFilePath = filename.startsWith('/data/') ? filename : `/data/${filename}`;
            console.log(`Getting thumbnail for: ${baseFilePath}`);
            
            let possiblePaths = [baseFilePath];
            
            if (!baseFilePath.toLowerCase().endsWith('.gx')) {
                possiblePaths.push(`${baseFilePath}.gx`);
            }
            
            if (baseFilePath.toLowerCase().endsWith('.gx') && baseFilePath.lastIndexOf('.') !== baseFilePath.length - 3) {
                possiblePaths.push(baseFilePath.substring(0, baseFilePath.length - 3));
            }
            
            console.log(`Will try the following paths for thumbnails: ${possiblePaths.join(', ')}`);
            
            for (const path of possiblePaths) {
                console.log(`Attempting to get thumbnail from: ${path}`);
                
                const thumbnailInfo = await this.client.getThumbnail(path);
                
                if (thumbnailInfo) {
                    console.log(`Successfully retrieved thumbnail from: ${path}`);
                    const imageData = thumbnailInfo.getImageData();
                    this.emit('thumbnail-retrieved', { 
                        filename, 
                        path, 
                        success: true,
                        size: imageData ? imageData.length : 0
                    });
                    return imageData;
                }
            }
            
            console.log(`Failed to get thumbnail for ${filename} - tried all possible paths`);
            this.emit('thumbnail-retrieved', { filename, success: false });
            return null;
        } catch (error) {
            this.emit('command-failed', { 
                command: 'getLegacyThumbnail', 
                filename, 
                error: error.message 
            });
            this.emit('error', error);
            console.error(`Error getting legacy thumbnail for ${filename}:`, error.message);
            return null;
        }
    }
    
    /**
     * Get access to the raw client when needed
     * @returns {Object} Raw client instance
     */
    getRawClient() {
        return this.client;
    }
    
    /**
     * Get client type
     * @returns {string} Client type ('fivem' or 'legacy')
     */
    getClientType() {
        return this.clientType;
    }

    /**
     * Get printer details for saving
     * @returns {Object} Printer details object
     */
    getPrinterDetails() {
        return {
            Name: this.printerName,
            IPAddress: this.ipAddress,
            SerialNumber: this.serialNumber,
            CheckCode: this.checkCode,
            ClientType: this.clientType,
        };
    }
    
    /**
     * Check if the printer is connected
     * @returns {boolean} Whether printer is connected
     */
    isConnected() {
        return this.client !== null;
    }
}

module.exports = PrinterClientAdapter;
