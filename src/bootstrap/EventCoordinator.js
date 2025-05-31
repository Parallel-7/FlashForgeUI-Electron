// src/bootstrap/EventCoordinator.js - Centralized event coordination
const JobPickerDialog = require('../ui/job-picker/JobPIckerDialog');
const ApplicationUtils = require('../utils/ApplicationUtils');

class EventCoordinator {
  constructor(printerConnectionManager, ipcManager, windowManager, configManager, serviceManager, dialogManager) {
    this.printerConnectionManager = printerConnectionManager;
    this.ipcManager = ipcManager;
    this.windowManager = windowManager;
    this.configManager = configManager;
    this.serviceManager = serviceManager;
    this.dialogManager = dialogManager;
    this.jobPickerDialog = null;
  }

  /**
   * Set up all event handlers for the application
   */
  setupAllEvents() {
    this.setupPrinterConnectionEvents();
    this.setupIPCManagerEvents();
  }

  /**
   * Set up event handlers for PrinterConnectionManager events
   */
  setupPrinterConnectionEvents() {
    this.printerConnectionManager.on('log-message', (message) => {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('log-message', message);
      }
    });
    
    this.printerConnectionManager.on('printer-connected', (data) => {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        // Create a serializable version of the data for IPC
        const serializableData = {
          ipAddress: data.ipAddress,
          name: data.name,
          clientType: data.clientType,
          serialNumber: data.serialNumber,
          isConnected: data.isConnected,
          firmware: data.firmware
        };
        mainWindow.webContents.send('printer-connected', serializableData);
      }
      
      // Initialize WebUI server if enabled
      if (this.configManager.getConfig().WebUIEnabled) {
        this.serviceManager.initializeWebUIServer(this.jobPickerDialog);
      }
      
      // Re-initialize Job Picker Dialog with the new client if needed
      if (this.jobPickerDialog) {
        this.jobPickerDialog.updateClient(this.printerConnectionManager.getPrinterClient());
      } else if (mainWindow) {
        this.jobPickerDialog = new JobPickerDialog(mainWindow, this.printerConnectionManager.getPrinterClient());
        this.jobPickerDialog.setupIpcHandlers();
      }
    });
    
    this.printerConnectionManager.on('printer-disconnected', () => {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('printer-disconnected');
      }
      
      // Send disconnect event to Web UI
      const webUIServer = this.serviceManager.getWebUIServer();
      if (webUIServer) {
        webUIServer.handleElectronEvent('printer-disconnected');
      }
    });
    
    this.printerConnectionManager.on('printer-data', (data) => {
      const mainWindow = this.windowManager.getMainWindow();
      const webUIServer = this.serviceManager.getWebUIServer();

      // Path B: Send data to WebUIServer (it will handle its own URL proxying for WebSocket clients)
      // Send the original 'data' object.
      if (webUIServer) {
        try {
          webUIServer.handleElectronEvent('printer-data', data);
        } catch (err) {
          console.error('Error sending printer-data event to WebUI service:', err);
        }
      }

      // Path A: Prepare and send data to the Main UI Window via Electron IPC
      if (mainWindow) {
        const printerInfoForMainUI = JSON.parse(JSON.stringify(data.printerInfo || {}));
        
        if (webUIServer) {
          // If WebUIServer is available, use the new setupCameraProxyUrlIfNeeded method
          // which handles the configuration internally and prevents repeated setup
          webUIServer.setupCameraProxyUrlIfNeeded(printerInfoForMainUI);
        } else {
          // WebUIServer is not ready (null or undefined).
          console.log("EventCoordinator: WebUIServer not available. Clearing CameraStreamUrl for initial main UI data.");
          printerInfoForMainUI.CameraStreamUrl = null; 
        }
        const dataForMainUI = {
          ...data,
          printerInfo: printerInfoForMainUI
        };
        mainWindow.webContents.send('printer-data', dataForMainUI);
      }
    });
    
    this.printerConnectionManager.on('reset-ui', (preserveJobInfo) => {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('reset-ui', preserveJobInfo);
      }
    });
  }

  /**
   * Set up handlers for IPCManager events
   */
  setupIPCManagerEvents() {
    // Settings related events
    this.ipcManager.on('camera-settings-changed', () => {
      this.serviceManager.restartCameraService();
    });
    
    this.ipcManager.on('webui-settings-changed', () => {
      this.serviceManager.stopWebUIServer();
      this.serviceManager.restartWebUIServerIfEnabled();
    });
    
    // Job related events
    this.ipcManager.on('show-job-uploader-window', () => {
      this._handleShowJobUploaderWindow();
    });
    
    this.ipcManager.on('show-recent-files', () => {
      if (this.jobPickerDialog) {
        this.jobPickerDialog.show(true); // true for recent files
      } else {
        console.warn('JobPickerDialog not initialized');
      }
    });
    
    this.ipcManager.on('show-local-files', () => {
      if (this.jobPickerDialog) {
        this.jobPickerDialog.show(false); // false for all local files
      } else {
        console.warn('JobPickerDialog not initialized');
      }
    });
    
    this.ipcManager.on('show-send-cmds-window', () => {
      this._handleShowSendCmdsWindow();
    });
    
    // System stats event
    this.ipcManager.on('get-system-stats', (callback) => {
      const stats = this._handleGetSystemStats();
      if (typeof callback === 'function') {
        callback(stats);
      }
    });
  }

  /**
   * Handle show job uploader window request
   * @private
   */
  _handleShowJobUploaderWindow() {
    ApplicationUtils.showJobUploaderWindow(this.dialogManager);
  }

  /**
   * Handle show send commands window request
   * @private
   */
  _handleShowSendCmdsWindow() {
    ApplicationUtils.showSendCmdsWindow(
      this.dialogManager, 
      this.printerConnectionManager, 
      this.windowManager
    );
  }

  /**
   * Handle get system stats request
   * @private
   * @returns {Object} System statistics
   */
  _handleGetSystemStats() {
    const webUIServer = this.serviceManager.getWebUIServer();
    const cameraService = this.serviceManager.cameraService;
    
    return ApplicationUtils.collectSystemStats(
      this.configManager,
      webUIServer,
      cameraService
    );
  }



  /**
   * Get job picker dialog instance
   * @returns {Object|null} Job picker dialog
   */
  getJobPickerDialog() {
    return this.jobPickerDialog;
  }

}

module.exports = EventCoordinator;
