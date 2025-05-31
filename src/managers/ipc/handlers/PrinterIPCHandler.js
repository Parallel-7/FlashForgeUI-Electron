// src/manager/ipc/handlers/PrinterIPCHandler.js
const IPCHandlerBase = require('./IPCHandlerBase');

/**
 * Handles all printer-related IPC operations
 * Includes connection, controls, temperature, and print job management
 */
class PrinterIPCHandler extends IPCHandlerBase {
    constructor(windowManager, printerConnectionManager) {
        super('printer', windowManager);
        this.printerConnectionManager = printerConnectionManager;
    }
    
    /**
     * Initialize all printer control handlers
     */
    initialize() {
        this.registerConnectionHandlers();
        this.registerBasicControlHandlers();
        this.registerTemperatureHandlers();
        this.registerPrintJobHandlers();
        this.registerFiltrationHandlers();
        
        console.log(`[${this.category}] Printer control handlers initialized`);
    }
    
    /**
     * Register connection-related handlers
     */
    registerConnectionHandlers() {
        this.registerHandler('connect-button-clicked', async () => {
            console.log("Connect button clicked - starting connection flow.");
            const connected = await this.printerConnectionManager.startConnectionFlow();
            if (!connected) {
                console.log("Connection flow failed or was cancelled.");
                this.sendLogMessage("Connection failed or cancelled.");
            }
        });
        
        this.registerHandler('request-printer-data', async () => {
            await this.printerConnectionManager.sendPrinterDataUpdate();
        });
    }
    
    /**
     * Register basic printer control handlers
     */
    registerBasicControlHandlers() {
        this.registerHandler('home-axes', async () => {
            await this.executeWithErrorHandling(
                'homing axes',
                () => this.printerConnectionManager.homeAxes(),
                'home-axes'
            );
        });
        
        this.registerHandler('clear-status', async () => {
            await this.executeWithErrorHandling(
                'clearing status',
                () => this.printerConnectionManager.clearPlatform(),
                'clear-status'
            );
        });
        
        this.registerHandler('led-on', async () => {
            await this.executeWithErrorHandling(
                'turning LED on',
                () => this.printerConnectionManager.setLedOn(),
                'led-on'
            );
        });
        
        this.registerHandler('led-off', async () => {
            await this.executeWithErrorHandling(
                'turning LED off',
                () => this.printerConnectionManager.setLedOff(),
                'led-off'
            );
        });
    }
    
    /**
     * Register temperature control handlers
     */
    registerTemperatureHandlers() {
        this.registerHandler('set-bed-temp', async (event, temperature) => {
            await this.executeWithErrorHandling(
                'setting bed temperature',
                () => this.printerConnectionManager.setBedTemp(temperature),
                'set-bed-temp'
            );
        });
        
        this.registerHandler('bed-temp-off', async () => {
            await this.executeWithErrorHandling(
                'turning bed temp off',
                () => this.printerConnectionManager.cancelBedTemp(),
                'bed-temp-off'
            );
        });
        
        this.registerHandler('set-extruder-temp', async (event, temperature) => {
            await this.executeWithErrorHandling(
                'setting extruder temperature',
                () => this.printerConnectionManager.setExtruderTemp(temperature),
                'set-extruder-temp'
            );
        });
        
        this.registerHandler('extruder-temp-off', async () => {
            await this.executeWithErrorHandling(
                'turning extruder temp off',
                () => this.printerConnectionManager.cancelExtruderTemp(),
                'extruder-temp-off'
            );
        });
    }
    
    /**
     * Register print job control handlers
     */
    registerPrintJobHandlers() {
        this.registerHandler('pause-print', async () => {
            await this.executeWithErrorHandling(
                'pausing print',
                () => this.printerConnectionManager.pausePrintJob(),
                'pause-print'
            );
        });
        
        this.registerHandler('resume-print', async () => {
            await this.executeWithErrorHandling(
                'resuming print',
                () => this.printerConnectionManager.resumePrintJob(),
                'resume-print'
            );
        });
        
        this.registerHandler('cancel-print', async () => {
            await this.executeWithErrorHandling(
                'canceling print',
                () => this.printerConnectionManager.cancelPrintJob(),
                'cancel-print'
            );
        });
    }
    
    /**
     * Register filtration control handlers
     */
    registerFiltrationHandlers() {
        this.registerHandler('external-filtration', async () => {
            await this.executeWithErrorHandling(
                'setting external filtration',
                () => this.printerConnectionManager.setExternalFiltrationOn(),
                'external-filtration'
            );
        });
        
        this.registerHandler('internal-filtration', async () => {
            await this.executeWithErrorHandling(
                'setting internal filtration',
                () => this.printerConnectionManager.setInternalFiltrationOn(),
                'internal-filtration'
            );
        });
        
        this.registerHandler('no-filtration', async () => {
            await this.executeWithErrorHandling(
                'turning filtration off',
                () => this.printerConnectionManager.setFiltrationOff(),
                'no-filtration'
            );
        });
    }
}

module.exports = PrinterIPCHandler;
