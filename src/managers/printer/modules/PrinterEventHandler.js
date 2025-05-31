const { EventEmitter } = require('events');

/**
 * PrinterEventHandler manages all printer client event listeners and forwarding
 * Provides a clean interface for setting up and managing printer events
 */
class PrinterEventHandler extends EventEmitter {
  /**
   * Create a new PrinterEventHandler
   * @param {Object} notificationUtils Local notification utilities
   */
  constructor(notificationUtils) {
    super();
    this.notificationUtils = notificationUtils;
    this.printerClient = null;
    this.isSetup = false;
  }
  
  /**
   * Set up event listeners for the printer client
   * @param {Object} printerClient The printer client to set up events for
   * @param {Object} options Event handling options
   * @param {Function} options.getMachineStateText Function to get human-readable state text
   * @param {Function} options.onStateUpdate Callback for printer state updates
   * @param {Function} options.onNotificationCheck Callback for notification checks
   */
  setupEventListeners(printerClient, options = {}) {
    if (!printerClient) {
      throw new Error('PrinterClient is required for event setup');
    }
    
    // Clean up existing listeners if any
    this.cleanup();
    
    this.printerClient = printerClient;
    this.isSetup = true;
    
    // Set up printer info update events
    this._setupPrinterInfoEvents(options);
    
    // Set up machine state change events
    this._setupMachineStateEvents(options);
    
    // Set up temperature events
    this._setupTemperatureEvents(options);
    
    // Set up command execution events
    this._setupCommandEvents();
    
    // Set up error and connection events
    this._setupConnectionEvents();
    
    // Set up upload events
    this._setupUploadEvents();
  }
  
  /**
   * Setup printer info update events
   * @param {Object} options Event handling options
   * @private
   */
  _setupPrinterInfoEvents(options) {
    if (!this.printerClient) return;
    
    this.printerClient.on('printer-info-updated', (info) => {
      // Forward the printer info to UI components
      this.emit('printer-data', {
        printerInfo: info,
        machineState: options.getMachineStateText ? options.getMachineStateText(info.MachineState) : 'Unknown',
        clientType: this.printerClient.getClientType()
      });
      
      // Handle machine state changes for notifications
      if (options.onStateUpdate && typeof options.onStateUpdate === 'function') {
        options.onStateUpdate(info);
      }
    });
  }
  
  /**
   * Setup machine state change events
   * @param {Object} options Event handling options
   * @private
   */
  _setupMachineStateEvents(options) {
    if (!this.printerClient) return;
    
    this.printerClient.on('machine-state-changed', (newState, oldState, info) => {
      const getMachineStateText = options.getMachineStateText || (() => 'Unknown');
      console.log(`Machine state changed: ${getMachineStateText(oldState)} -> ${getMachineStateText(newState)}`);
      
      // Forward the event
      this.emit('machine-state-changed', newState, oldState, info);
    });
  }
  
  /**
   * Setup temperature change events
   * @param {Object} options Event handling options
   * @private
   */
  _setupTemperatureEvents(options) {
    if (!this.printerClient) return;
    
    // Listen for bed temperature changes
    this.printerClient.on('bed-temperature-changed', (newTemp, oldTemp) => {
      // Forward the event
      this.emit('bed-temperature-changed', newTemp, oldTemp);
      
      // Check for notification callbacks
      if (options.onNotificationCheck && typeof options.onNotificationCheck === 'function') {
        options.onNotificationCheck('bed-temperature', { newTemp, oldTemp });
      }
    });
  }
  
  /**
   * Setup command execution events
   * @private
   */
  _setupCommandEvents() {
    if (!this.printerClient) return;
    
    // Listen for command execution events
    this.printerClient.on('command-executed', (data) => {
      console.log(`Command executed: ${data.command}`);
      
      this.emit('command-response', {
        command: data.command,
        success: true,
        data: data
      });
    });
    
    // Listen for command failure events
    this.printerClient.on('command-failed', (data) => {
      console.error(`Command failed: ${data.command} - ${data.error}`);
      
      // For unsupported commands on legacy printers, show a message
      if (data.unsupported) {
        this.emit('log-message', `Operation not supported on this printer`);
      }
      
      this.emit('command-response', {
        command: data.command,
        success: false,
        error: data.error
      });
    });
  }
  
  /**
   * Setup connection and error events
   * @private
   */
  _setupConnectionEvents() {
    if (!this.printerClient) return;
    
    // Listen for error events
    this.printerClient.on('error', (error) => {
      console.error('Printer client error:', error.message);
      
      // Check for connection errors
      if (
        error.message.includes('ECONNRESET') || 
        error.message.includes('ETIMEDOUT') || 
        error.message.includes('socket') || 
        error.message.includes('ENOTFOUND')
      ) {
        console.error('Connection error detected. Cleaning up.');
        this.emit('connection-error', error);
      } else {
        this.emit('printer-error', error);
      }
    });
    
    // Listen for connection events
    this.printerClient.on('disconnected', () => {
      this.emit('printer-disconnected');
    });
  }
  
  /**
   * Setup upload events
   * @private
   */
  _setupUploadEvents() {
    if (!this.printerClient) return;
    
    // Listen for upload events
    this.printerClient.on('upload-completed', (data) => {
      this.notificationUtils.showNotification('Upload Complete', `${data.filename} sent to printer.`);
      this.emit('log-message', `Upload successful: ${data.filename}`);
      
      // Forward the event
      this.emit('upload-completed', data);
    });
    
    this.printerClient.on('upload-failed', (data) => {
      this.notificationUtils.showNotification('Upload Failed', `An error occurred: ${data.error}`);
      this.emit('log-message', `Upload error for ${data.filename}: ${data.error}`);
      
      // Forward the event
      this.emit('upload-failed', data);
    });
  }
  
  /**
   * Get the current printer client
   * @returns {Object|null} Current printer client or null
   */
  getPrinterClient() {
    return this.printerClient;
  }

  /**
   * Clean up event listeners and reset state
   */
  cleanup() {
    if (this.printerClient) {
      // Remove all listeners from the printer client
      this.printerClient.removeAllListeners();
      this.printerClient = null;
    }
    
    this.isSetup = false;
    
    // Remove all listeners from this event handler
    this.removeAllListeners();
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    this.cleanup();
  }
}

module.exports = PrinterEventHandler;
