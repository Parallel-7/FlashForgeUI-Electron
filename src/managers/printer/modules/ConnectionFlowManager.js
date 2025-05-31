const { FlashForgeClient, FlashForgePrinterDiscovery } = require('ff-api');
const PrinterClientAdapter = require('../adapter/PrinterClientAdapter');

/**
 * ConnectionFlowManager handles the complex printer connection workflow
 * Manages printer discovery, connection attempts, and connection orchestration
 */
class ConnectionFlowManager {
  /**
   * Create a new ConnectionFlowManager
   * @param {Object} windowManager Window manager for dialogs
   * @param {Object} configManager Configuration manager
   * @param {Object} printerDetailsManager Printer details manager
   * @param {Object} notificationUtils Notification utilities
   */
  constructor(windowManager, configManager, printerDetailsManager, notificationUtils) {
    this.windowManager = windowManager;
    this.configManager = configManager;
    this.printerDetailsManager = printerDetailsManager;
    this.notificationUtils = notificationUtils;
  }
  
  /**
   * Start the printer connection flow
   * @param {Function} emitLog Function to emit log messages
   * @param {Function} onConnectionSuccess Callback for successful connection
   * @returns {Promise<Object|null>} Connection result object or null if failed
   */
  async startConnectionFlow(emitLog, onConnectionSuccess) {
    console.log("Starting connection flow...");
    emitLog('Starting printer connection flow...');

    const forceLegacyAPI = this.configManager.get('ForceLegacyAPI');
    if (forceLegacyAPI) {
      console.log("Force Legacy API mode is enabled");
      emitLog('Force Legacy API mode is enabled');
    }

    // Discover printers first
    const discoveredPrinters = await this._discoverPrinters();
    
    // Try saved details first
    const savedResult = await this._tryConnnectionWithSavedDetails(discoveredPrinters, forceLegacyAPI, emitLog);
    if (savedResult) {
      return savedResult;
    }
    
    // Show printer selection if no saved connection worked
    return await this._handlePrinterSelection(discoveredPrinters, forceLegacyAPI, emitLog);
  }
  
  /**
   * Connect to a printer and save its details
   * @param {string} ipAddress Printer IP address
   * @param {string} serialNumber Printer serial number
   * @param {string} checkCode Printer check code for authorization
   * @param {string} printerName Printer name
   * @param {boolean} isLegacy Whether this is a legacy printer
   * @returns {Promise<Object|null>} Connection result or null if failed
   */
  async connectAndSave(ipAddress, serialNumber, checkCode, printerName, isLegacy) {
    if (!ipAddress || !serialNumber) {
      console.error('ConnectAndSave called with incomplete details.');
      return null;
    }

    console.log(`Attempting to connect to ${printerName || serialNumber} at ${ipAddress}`);
    
    try {
      // Create new adapter
      const printerClient = new PrinterClientAdapter();
      
      // Connect to the printer
      const initialized = await printerClient.connect(ipAddress, serialNumber, isLegacy, printerName, checkCode);
      
      if (!initialized) {
        console.error(`Initialization failed for ${ipAddress}.`);
        this.notificationUtils.showNotification('Connection Failed', `Could not initialize connection with ${printerName || ipAddress}.`);
        return null;
      }

      // Get printer information from the adapter
      const printerInfo = await printerClient.getPrinterInfo();
      
      // Get the actual printer name from the API response
      const actualPrinterName = printerInfo?.Name || printerName || serialNumber;
      
      console.log(`Successfully connected to ${actualPrinterName} at ${ipAddress}`);
      
      // Update the adapter's printer name with the actual name from the printer
      printerClient.printerName = actualPrinterName;
      
      // Save printer details with the actual printer name
      const forceLegacyAPI = this.configManager.get('ForceLegacyAPI');
      
      // Only save client type if not using forced legacy API
      const detailsToSave = {
        Name: actualPrinterName,
        IPAddress: ipAddress,
        SerialNumber: serialNumber,
        CheckCode: checkCode || '123',
      };
      
      // Only save the client type if we're not forcing legacy API
      if (!forceLegacyAPI) {
        detailsToSave.ClientType = printerClient.clientType;
      }
      
      this.printerDetailsManager.save(detailsToSave);

      // Connection successful - let PrinterConnectionManager handle event emission
      
      return {
        printerClient: printerClient,
        printerInfo: printerInfo,
        printerName: actualPrinterName,
        ipAddress: ipAddress,
        serialNumber: serialNumber,
        firmware: printerInfo?.FirmwareVersion || ''
      };

    } catch (error) {
      console.error(`Error connecting to ${ipAddress}:`, error);
      this.notificationUtils.showNotification('Connection Error', `An error occurred: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Discover printers on the network
   * @returns {Promise<Array>} Array of discovered printers
   * @private
   */
  async _discoverPrinters() {
    let discoveredPrinters = [];
    try {
      const discovery = new FlashForgePrinterDiscovery();
      discoveredPrinters = await discovery.discoverPrintersAsync(10000, 2000, 3); // 10s total, 2s idle, 3 tries
      console.log(`Discovered ${discoveredPrinters.length} printers.`);
    } catch (scanError) {
      console.error('Error during printer discovery:', scanError);
      this.notificationUtils.showNotification('Discovery Error', 'Could not scan for printers.');
    }
    return discoveredPrinters;
  }
  
  /**
   * Try connection with saved printer details
   * @param {Array} discoveredPrinters Array of discovered printers
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<Object|null>} Connection result or null if failed
   * @private
   */
  async _tryConnnectionWithSavedDetails(discoveredPrinters, forceLegacyAPI, emitLog) {
    const savedDetails = this.printerDetailsManager.load();
    if (!savedDetails) {
      console.log('No saved printer details found.');
      emitLog(`No saved printer details found.`);
      return null;
    }
    
    const isLegacy = savedDetails.ClientType === "legacy";
    
    // Check for a matching printer in the scan
    const matchingPrinter = discoveredPrinters.find(p => p.serialNumber === savedDetails.SerialNumber);

    if (matchingPrinter) {
      return await this._tryConnectionWithMatchingPrinter(matchingPrinter, savedDetails, isLegacy, forceLegacyAPI, emitLog);
    } else {
      return await this._tryConnectionWithSavedIP(savedDetails, isLegacy, forceLegacyAPI, emitLog);
    }
  }
  
  /**
   * Try connection with matching discovered printer
   * @param {Object} matchingPrinter Matching printer from discovery
   * @param {Object} savedDetails Saved printer details
   * @param {boolean} isLegacy Whether printer is legacy
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<Object|null>} Connection result or null if failed
   * @private
   */
  async _tryConnectionWithMatchingPrinter(matchingPrinter, savedDetails, isLegacy, forceLegacyAPI, emitLog) {
    let checkCode = savedDetails.CheckCode || '';

    // If legacy api is not forced, make sure the user has a valid check code saved
    if (!forceLegacyAPI && !checkCode) {
      checkCode = await this.windowManager.showInputDialog(
          'Printer Pairing',
          `Please enter the pairing code (check code) for ${savedDetails.Name || savedDetails.SerialNumber}:`,
          '', // No default value
          'text' // Input type
      );

      if (!checkCode) {
        console.log('Pairing code input cancelled.');
        emitLog(`Pairing code input cancelled.`);
        return null;
      }
    }

    return await this.connectAndSave(
        matchingPrinter.ipAddress.toString(),
        savedDetails.SerialNumber,
        checkCode,
        savedDetails.Name,
        isLegacy
    );
  }
  
  /**
   * Try connection with saved IP address (printer not found in scan)
   * @param {Object} savedDetails Saved printer details
   * @param {boolean} isLegacy Whether printer is legacy
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<Object|null>} Connection result or null if failed
   * @private
   */
  async _tryConnectionWithSavedIP(savedDetails, isLegacy, forceLegacyAPI, emitLog) {
    // Did not find saved printer (seems that not all legacy printers will answer this)
    console.log(`Saved printer ${savedDetails.Name} not found in current scan.`);
    emitLog(`Saved printer ${savedDetails.Name} not found in scan.`);
    emitLog(`Attempting connection to ${savedDetails.Name} at ${savedDetails.IPAddress}...`);

    let checkCode = savedDetails.CheckCode || '';

    if (!forceLegacyAPI && !checkCode) {
      checkCode = await this.windowManager.showInputDialog(
          'Printer Pairing',
          `Please enter the pairing code (check code) for ${savedDetails.Name || savedDetails.SerialNumber}:`,
          '', // No default value
          'text' // Input type
      );

      if (!checkCode) {
        console.log('Pairing code input cancelled.');
        emitLog(`Pairing code input cancelled.`);
        return null;
      }
    }

    return await this.connectAndSave(
        savedDetails.IPAddress,
        savedDetails.SerialNumber,
        checkCode,
        savedDetails.Name,
        isLegacy
    );
  }
  
  /**
   * Handle printer selection workflow
   * @param {Array} discoveredPrinters Array of discovered printers
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<Object|null>} Connection result or null if failed
   * @private
   */
  async _handlePrinterSelection(discoveredPrinters, forceLegacyAPI, emitLog) {
    // Show Printer Selection List (if no successful connection yet)
    console.log('Showing printer selection window.');
    emitLog(`Showing printer selection window.`);
    const selectedPrinter = await this.windowManager.showPrinterSelectionWindow(discoveredPrinters);

    if (!selectedPrinter) {
      console.log('Printer selection cancelled or failed.');
      emitLog(`Printer selection cancelled.`);
      return null; // User cancelled or no printers available/selected
    }

    return await this._connectToSelectedPrinter(selectedPrinter, forceLegacyAPI, emitLog);
  }
  
  /**
   * Connect to user-selected printer
   * @param {Object} selectedPrinter Selected printer from UI
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<Object|null>} Connection result or null if failed
   * @private
   */
  async _connectToSelectedPrinter(selectedPrinter, forceLegacyAPI, emitLog) {
    // Check machine type
    emitLog(`Checking machine type for ${selectedPrinter.name}...`);
    
    try {
      const tempClient = new FlashForgeClient(selectedPrinter.ipAddress.toString());
      const connected = await tempClient.initControl();
      
      if (!connected) {
        emitLog(`Failed to check machine type. Connection error.`);
        return null;
      }

      // Request machine type
      const printerInfo = await tempClient.getPrinterInfo();
      if (!printerInfo) {
        console.error(`Failed to get printer info from ${selectedPrinter.ipAddress}`);
        tempClient.dispose();
        emitLog(`Failed to get printer information.`);
        return null;
      }
      
      const typeName = printerInfo.TypeName || '';
      const isAdventurer5M = typeName.includes('5M');
      const isLegacy = !isAdventurer5M;
      
      // Clean up temporary client
      tempClient.dispose();
      
      // Handle check code requirements
      const checkCode = await this._handleCheckCodeForSelectedPrinter(selectedPrinter, isAdventurer5M, forceLegacyAPI, emitLog);
      if (checkCode === null) {
        return null; // User cancelled
      }
      
      // Connect
      emitLog(`Connecting to ${selectedPrinter.name}...`);
      const result = await this.connectAndSave(
        selectedPrinter.ipAddress.toString(), 
        selectedPrinter.serialNumber, 
        checkCode, 
        selectedPrinter.name, 
        isLegacy
      );
      
      if (result) {
        return result; // Success!
      } else {
        console.log('Connection failed with selected printer.');
        emitLog(`Connection failed for ${selectedPrinter.name}.`);
        return null; // Final connection attempt failed
      }
      
    } catch (error) {
      console.error(`Error checking printer type: ${error.message}`);
      emitLog(`Error checking printer type: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Handle check code requirements for selected printer
   * @param {Object} selectedPrinter Selected printer
   * @param {boolean} isAdventurer5M Whether printer is Adventurer 5M/Pro
   * @param {boolean} forceLegacyAPI Whether legacy API is forced
   * @param {Function} emitLog Function to emit log messages
   * @returns {Promise<string|null>} Check code or null if cancelled
   * @private
   */
  async _handleCheckCodeForSelectedPrinter(selectedPrinter, isAdventurer5M, forceLegacyAPI, emitLog) {
    // Need a check code for 5m/pro if legacy mode is not forced
    let checkCode = '';
    if (isAdventurer5M && !forceLegacyAPI) {
      checkCode = await this.windowManager.showInputDialog(
          'Printer Pairing',
          `Please enter the pairing code (check code) for ${selectedPrinter.name || selectedPrinter.serialNumber}:`,
          '', // No default value
          'text' // Input type
      );

      if (!checkCode) {
        console.log('Pairing code input cancelled.');
        emitLog(`Failed to connect, pairing code input cancelled.`);
        return null; // User cancelled
      }
    } else if (isAdventurer5M && forceLegacyAPI) {
      // Don't need a check code, just tell the user legacy mode is on
      emitLog(`${selectedPrinter.name} is a 5M/Pro model, but force legacy mode is enabled.`);
    } else {
      // Don't need a check code, just tell the user we are attempting the connection
      emitLog(`${selectedPrinter.name} does not require a pairing code.`);
    }
    
    return checkCode;
  }
}

module.exports = ConnectionFlowManager;
