const { MachineState } = require('ff-api');
const DiscordNotificationManager = require('../../../services/discord/DiscordNotificationManager');

/**
 * PrinterNotificationCoordinator handles all printer state notifications and Discord integration
 * Manages notification states and coordinates between local notifications and Discord
 */
class PrinterNotificationCoordinator {
  /**
   * Create a new PrinterNotificationCoordinator
   * @param {Object} configManager Configuration manager for settings
   * @param {Object} notificationUtils Local notification utilities
   * @param {Object} cameraService Camera service for stream URL updates
   */
  constructor(configManager, notificationUtils, cameraService) {
    this.configManager = configManager;
    this.notificationUtils = notificationUtils;
    this.cameraService = cameraService;
    
    // Notification state tracking
    this.hasSentPrintCompleteNotification = false;
    this.hasSentPrinterCooledNotification = false;
  }
  
  /**
   * Handle printer state update for notifications
   * @param {Object} info Printer info object
   * @param {Object} printerClient Printer client for additional info
   * @param {Function} getMachineStateTextFn Function to get human-readable state text
   */
  handleStateUpdate(info, printerClient, getMachineStateTextFn) {
    if (!info || !printerClient || typeof getMachineStateTextFn !== 'function') {
      return;
    }
    
    // Update Discord notification manager with current status
    const status = {
      printerName: printerClient.printerName || 'FlashForge Printer',
      machineStatus: getMachineStateTextFn(info.MachineState),
      temp: info.Extruder ? {
        currentTemp: info.Extruder.current,
        targetTemp: info.Extruder.set || 0
      } : null,
      bedTemp: info.PrintBed ? {
        currentTemp: info.PrintBed.current,
        targetTemp: info.PrintBed.set || 0
      } : null,
      printInfo: info.PrintFileName ? {
        fileName: info.PrintFileName || 'Unknown',
        progress: info.PrintProgress || 0,
        elapsedTime: info.PrintDuration || 0,
        estimatedTime: info.EstimatedTime || 0,
        layer: info.CurrentPrintLayer && info.TotalPrintLayers ? {
          current: info.CurrentPrintLayer,
          total: info.TotalPrintLayers
        } : null
      } : null
    };
    
    // Update Discord with current status
    DiscordNotificationManager.updatePrinterStatus(status);
    
    // Check for print completion
    if (info.MachineState === MachineState.Completed && !this.hasSentPrintCompleteNotification) {
      this._handlePrintCompleted(status);
    }
    
    // Update camera URL if changed
    this._updateCameraUrl(info);
  }
  
  /**
   * Handle print completion notifications
   * @param {Object} status Current printer status
   * @private
   */
  _handlePrintCompleted(status) {
    // Send local notification if enabled
    if (this.configManager.get('AlertWhenComplete')) {
      this.notificationUtils.showNotification("Print Complete", "Your print job has finished.");
    }
    
    // Mark as sent to prevent duplicates
    this.hasSentPrintCompleteNotification = true;
    
    // Send Discord notification for print complete
    if (status.printInfo) {
      DiscordNotificationManager.notifyPrintComplete(status.printInfo);
    }
  }
  
  /**
   * Update camera URL if it has changed
   * @param {Object} info Printer info object
   * @private
   */
  _updateCameraUrl(info) {
    if (info.CameraStreamUrl && info.CameraStreamUrl !== this.cameraService.printerStreamUrl) {
      console.log(`Updating camera service URL: ${info.CameraStreamUrl}`);
      this.cameraService.setStreamUrl(info.CameraStreamUrl);
    }
  }
  
  /**
   * Check if printer has cooled down enough to notify
   * @param {number} bedTemp Current bed temperature
   * @param {Object} printerClient Printer client to check state
   * @returns {Promise<void>}
   */
  async checkPrinterCooled(bedTemp, printerClient) {
    if (!printerClient) return;
    
    // Only check if we've already sent print complete notification
    if (!this.hasSentPrintCompleteNotification || this.hasSentPrinterCooledNotification) {
      return;
    }
    
    // Only notify if bed temperature is low enough
    if (bedTemp > 40) {
      return;
    }
    
    try {
      // Get current printer info to check state
      const info = await printerClient.getPrinterInfo();
      if (!info) return;
      
      // Only send cooled notification if printer is in a suitable state
      if (info.MachineState === MachineState.Ready || info.MachineState === MachineState.Completed) {
        this._handlePrinterCooled();
      }
    } catch (error) {
      console.error('Error checking printer cooled state:', error);
    }
  }
  
  /**
   * Handle printer cooled notifications
   * @private
   */
  _handlePrinterCooled() {
    // Send local notification if enabled
    if (this.configManager.get('AlertWhenCooled')) {
      this.notificationUtils.showNotification("Printer Cooled", "The printer bed has cooled down.");
    }
    
    // Mark as sent to prevent duplicates
    this.hasSentPrinterCooledNotification = true;
    
    // Send Discord notification for printer cooled
    DiscordNotificationManager.notifyPrinterCooled();
  }
  
  /**
   * Reset notification states when appropriate machine states are reached
   * @param {MachineState} newState New machine state
   */
  resetNotificationStates(newState) {
    // Reset notification flags for active states
    if (
      newState === MachineState.Printing ||
      newState === MachineState.Heating ||
      newState === MachineState.Busy ||
      newState === MachineState.Calibrating ||
      newState === MachineState.Cancelled
    ) {
      this.hasSentPrintCompleteNotification = false;
      this.hasSentPrinterCooledNotification = false;
    }
  }
  
  /**
   * Check if UI should be reset based on notification states and machine state
   * @param {MachineState} newState New machine state
   * @returns {boolean} Whether UI should be reset
   */
  shouldResetUI(newState) {
    // Handle UI reset when needed
    if (
      newState === MachineState.Ready ||
      newState === MachineState.Cancelled ||
      newState === MachineState.Error
    ) {
      // Don't reset if we just completed and are waiting for cooldown notification
      return !this.hasSentPrintCompleteNotification || this.hasSentPrinterCooledNotification;
    }
    return false;
  }

  /**
   * Reset all notification states (for new connections or disconnections)
   */
  resetAllStates() {
    this.hasSentPrintCompleteNotification = false;
    this.hasSentPrinterCooledNotification = false;
  }

}

module.exports = PrinterNotificationCoordinator;
