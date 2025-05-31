const { EventEmitter } = require('events');

require('./adapter/PrinterClientAdapter');
const { getMachineStateText } = require('../../utils/MachineStateUtils');
const DiscordNotificationManager = require('../../services/discord/DiscordNotificationManager');
const CommandForwarder = require('./modules/CommandForwarder');
const ConnectionStateManager = require('./modules/ConnectionStateManager');
const PrinterNotificationCoordinator = require('./modules/PrinterNotificationCoordinator');
const PrinterEventHandler = require('./modules/PrinterEventHandler');
const ConnectionFlowManager = require('./modules/ConnectionFlowManager');

/**
 * PrinterConnectionManager handles all printer connection operations, status updates, and notifications
 * Extends EventEmitter to provide events for UI components
 */
class PrinterConnectionManager extends EventEmitter {
  /**
   * Create a new PrinterConnectionManager
   * @param {object} windowManager Window manager for dialogs
   * @param {object} configManager Configuration manager
   * @param {object} printerDetailsManager Printer details manager
   * @param {object} notificationUtils Notification utilities
   * @param {object} cameraService Camera service
   */
  constructor(windowManager, configManager, printerDetailsManager, notificationUtils, cameraService) {
    super();
    // Store dependencies
    this.windowManager = windowManager;
    this.configManager = configManager;
    this.printerDetailsManager = printerDetailsManager;
    this.notificationUtils = notificationUtils;
    this.cameraService = cameraService;
    
    // Initialize state
    this.printerClient = null;
    this.isConnected = false;
    
    // Initialize connection state manager
    this.connectionStateManager = new ConnectionStateManager();
    
    // Initialize notification coordinator
    this.notificationCoordinator = new PrinterNotificationCoordinator(
      configManager,
      notificationUtils,
      cameraService
    );
    
    // Initialize event handler
    this.eventHandler = new PrinterEventHandler(notificationUtils);
    
    // Initialize connection flow manager
    this.connectionFlowManager = new ConnectionFlowManager(
      windowManager,
      configManager,
      printerDetailsManager,
      notificationUtils
    );
    
    // Initialize command forwarder with printer command methods
    this.commandForwarder = new CommandForwarder([
      'homeAxes', 'clearPlatform', 'pausePrintJob', 'resumePrintJob',
      'cancelPrintJob', 'setLedOn', 'setLedOff', 'setBedTemp',
      'cancelBedTemp', 'setExtruderTemp', 'cancelExtruderTemp',
      'setExternalFiltrationOn', 'setInternalFiltrationOn', 'setFiltrationOff',
      'uploadFile', 'sendRawCmd', 'getLegacyThumbnail'
    ]);
    
    // Initialize Discord notification manager
    DiscordNotificationManager.initialize();
  }
  
  /**
  * Set up event handlers using the PrinterEventHandler module
  * @private
  */
  _setupEventHandlers() {
    if (!this.printerClient) return;
    
    // Set up printer event handler with callbacks
    this.eventHandler.setupEventListeners(this.printerClient, {
      getMachineStateText: getMachineStateText,
      onStateUpdate: (info) => {
        this.notificationCoordinator.handleStateUpdate(info, this.printerClient, getMachineStateText);
      },
      onNotificationCheck: (eventType, data) => {
        if (eventType === 'bed-temperature') {
          this.notificationCoordinator.checkPrinterCooled(data.newTemp, this.printerClient);
        }
      }
    });
    
    // Forward events from event handler to main class
    this.eventHandler.on('printer-data', (data) => this.emit('printer-data', data));
    this.eventHandler.on('machine-state-changed', (newState) => {
      this.notificationCoordinator.resetNotificationStates(newState);
      if (this.notificationCoordinator.shouldResetUI(newState)) {
        this.emit('reset-ui', false);
      }
    });
    this.eventHandler.on('command-response', (data) => this.emit('command-response', data));
    this.eventHandler.on('log-message', (message) => this.emit('log-message', message));
    this.eventHandler.on('connection-error', () => {
      this.cleanupPrinterConnection();
      this.notificationUtils.showNotification('Connection Lost', 'Lost connection to the printer.');
    });
    this.eventHandler.on('printer-disconnected', () => {
      this.isConnected = false;
      this.emit('printer-disconnected');
    });
    this.eventHandler.on('upload-completed', () => {
      // Trigger an immediate update to refresh UI state
      setTimeout(() => this.sendPrinterDataUpdate(), 1000);
    });
  }
  

  
  /**
   * Get the current printer client instance
   * @returns {object|null} The printer client or null if not connected
   */
  getPrinterClient() {
    return this.printerClient;
  }
  
  /**
   * Get the current connection status
   * @returns {boolean} Whether a printer is connected
   */
  getConnectionStatus() {
    return this.isConnected;
  }
  
  /**
   * Start the printer connection flow
   * @returns {Promise<boolean>} Whether connection was successful
   */
  async startConnectionFlow() {
    const result = await this.connectionFlowManager.startConnectionFlow(
      (message) => this.emit('log-message', message),
      (eventName, data) => this.emit(eventName, data)
    );
    
    if (result) {
      // Set up the connection with the result
      return await this._finalizeConnection(result);
    }
    
    return false;
  }
  
  /**
   * Finalize connection setup after successful connection
   * @param {Object} connectionResult Result from ConnectionFlowManager
   * @returns {Promise<boolean>} Whether finalization was successful
   * @private
   */
  async _finalizeConnection(connectionResult) {
    try {
      // Clean up any existing connection
      if (this.printerClient) {
        this.cleanupPrinterConnection();
      }
      
      // Set up the new connection
      this.printerClient = connectionResult.printerClient;
      this.isConnected = true;
      
      // Set up event handlers
      this._setupEventHandlers();
      
      // Set up method forwarding for printer commands
      this.commandForwarder.setupMethodForwarding(this, this.printerClient);
      
      // Reset notification states for new connection
      this.notificationCoordinator.resetAllStates();
      
      // Start periodic data updates
      this.connectionStateManager.startDataUpdates(
        this.printerClient,
        (error) => {
          if (error) {
            console.error('Error updating printer data:', error);
            // Error handling is done through event listeners
          }
          // Success handling is done through the printer client's event listeners
        },
        2000 // Update every 2 seconds
      );
      
      // Send initial printer data update
      this.sendPrinterDataUpdate();
      
      // Emit printer-connected event for EventCoordinator
      const connectionData = {
        printerClient: this.printerClient,
        isConnected: this.isConnected,
        ipAddress: connectionResult.ipAddress,
        name: connectionResult.printerName,
        clientType: this.printerClient.getClientType(),
        serialNumber: connectionResult.serialNumber,
        firmware: connectionResult.firmware
      };
      this.emit('printer-connected', connectionData);
      
      return true;
    } catch (error) {
      console.error('Error finalizing connection:', error);
      return false;
    }
  }
  
  /**
   * Clean up printer connection
   */
  cleanupPrinterConnection() {
    // Stop periodic updates
    this.connectionStateManager.stopDataUpdates();
    
    if (this.printerClient) {
      // Before disposing, clean up event handler
      this.eventHandler.cleanup();
      
      // Dispose of the printer client
      this.printerClient.dispose();
      this.printerClient = null;
      
      // Clear forwarded methods
      this.commandForwarder.clearForwardedMethods(this);
    }
    
    this.isConnected = false;
    
    // Emit events
    this.emit('log-message', 'Printer disconnected.');
    this.emit('printer-disconnected');
    this.emit('reset-ui', true);
    
    // Stop the camera service stream if running
    this.cameraService.stopStreaming();
    
    // Reset notification states on disconnect
    this.notificationCoordinator.resetAllStates();
  }
  
  /**
   * Send a one-off printer data update
   * @returns {Promise<void>}
   */
  async sendPrinterDataUpdate() {
    if (!this.printerClient || !this.isConnected) return;
    
    try {
      await this.connectionStateManager.sendSingleUpdate(this.printerClient);
    } catch (error) {
      // Error is already logged by ConnectionStateManager
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.cleanupPrinterConnection();
    
    // Clean up connection state manager
    this.connectionStateManager.dispose();
    
    // Clean up event handler
    this.eventHandler.dispose();
    
    // Clean up Discord notification manager
    DiscordNotificationManager.dispose();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

module.exports = PrinterConnectionManager;
