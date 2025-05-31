/**
 * ConnectionStateManager handles connection state lifecycle and periodic updates
 * Manages connection status, periodic data updates, and cleanup operations
 */
class ConnectionStateManager {
  /**
   * Create a new ConnectionStateManager
   */
  constructor() {
    this.updateInterval = null;
    this.isUpdating = false;
  }
  
  /**
   * Start periodic data updates
   * @param {Object} printerClient The printer client to get updates from
   * @param {Function} updateCallback Callback function to handle update results
   * @param {number} intervalMs Update interval in milliseconds (default: 2000)
   */
  startDataUpdates(printerClient, updateCallback, intervalMs = 2000) {
    // Stop any existing interval
    this.stopDataUpdates();
    
    if (!printerClient || typeof updateCallback !== 'function') {
      throw new Error('PrinterClient and updateCallback are required for data updates');
    }
    
    // Set updating flag
    this.isUpdating = true;
    
    // Start periodic updates
    this.updateInterval = setInterval(async () => {
      if (!printerClient || !this.isUpdating) {
        // Stop interval if client is gone or updating stopped
        this.stopDataUpdates();
        return;
      }
      
      try {
        // Get printer info (this will trigger events through the client's event listeners)
        const printerInfo = await printerClient.getPrinterInfo();
        
        // Call the update callback with the result
        if (updateCallback) {
          updateCallback(null, printerInfo);
        }
      } catch (error) {
        // Call the update callback with the error
        if (updateCallback) {
          updateCallback(error, null);
        }
      }
    }, intervalMs);
  }
  
  /**
   * Stop periodic data updates
   */
  stopDataUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isUpdating = false;
  }
  
  /**
   * Send a one-off printer data update
   * @param {Object} printerClient The printer client to get update from
   * @param {Function} updateCallback Optional callback function to handle result
   * @returns {Promise<Object|null>} Printer info or null if error
   */
  async sendSingleUpdate(printerClient, updateCallback = null) {
    if (!printerClient) {
      const error = new Error('PrinterClient is required for data update');
      if (updateCallback) updateCallback(error, null);
      throw error;
    }
    
    try {
      // Get printer info (this will trigger events through the client's event listeners)
      const printerInfo = await printerClient.getPrinterInfo();
      
      // Call the update callback with the result
      if (updateCallback) {
        updateCallback(null, printerInfo);
      }
      
      return printerInfo;
    } catch (error) {
      // Call the update callback with the error
      if (updateCallback) {
        updateCallback(error, null);
      }
      throw error;
    }
  }

  /**
   * Clean up all resources and stop updates
   */
  dispose() {
    this.stopDataUpdates();
  }
}

module.exports = ConnectionStateManager;
