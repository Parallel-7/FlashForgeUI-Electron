// src/bootstrap/ServiceManager.js - Service lifecycle management
const WebUIServer = require('../web/server');

class ServiceManager {
  constructor(configManager, cameraService, printerConnectionManager, windowManager) {
    this.configManager = configManager;
    this.cameraService = cameraService;
    this.printerConnectionManager = printerConnectionManager;
    this.windowManager = windowManager;
    this.webUIServer = null;
    this.jobPickerDialog = null;
  }

  /**
   * Initialize camera service with configuration and event handlers
   * @returns {Promise<boolean>} Success status
   */
  async initializeCameraService() {
    try {
      // Get camera proxy port from config
      const config = this.configManager.getConfig();
      
      // Initialize the camera service with the config
      await this.cameraService.initialize(config);
      
      // Set up event handlers
      this.cameraService.on('stream-connected', () => {
        console.log('Camera stream connected');
      });
      
      this.cameraService.on('stream-error', (error) => {
        console.error('Camera stream error:', error.message);
      });
      
      this.cameraService.on('stream-stopped', () => {
        console.log('Camera stream stopped');
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize camera service:', error);
      return false;
    }
  }

  /**
   * Initialize and start WebUI server with message callback handling
   * @param {Object} jobPickerDialog - Job picker dialog instance
   */
  initializeWebUIServer(jobPickerDialog) {
    this.jobPickerDialog = jobPickerDialog;
    
    try {
      // Get printer client from the PrinterConnectionManager
      const printerClient = this.printerConnectionManager.getPrinterClient();
      
      if (!printerClient) {
        console.log('No printer client available. Web UI server not started.');
        return;
      }

      // Check if Web UI is enabled in config
      const config = this.configManager.getConfig();
      if (config.WebUIEnabled === false) {
        console.log('Web UI is disabled in settings');
        return;
      }

      // Create and start the Web UI server using the camera service
      this.webUIServer = new WebUIServer(printerClient, this.configManager, this.cameraService);
      
      // Register message callback for Web UI communication
      this.webUIServer.registerMessageCallback(async (channel, data) => {
        await this._handleWebUIMessage(channel, data);
      });
      
      // Start the server
      this.webUIServer.start().then(success => {
        if (success) {
          this.windowManager.getMainWindow()?.webContents.send('log-message', 'Web UI server started');
        } else {
          console.error('Failed to start Web UI server');
          this.windowManager.getMainWindow()?.webContents.send('log-message', 'Failed to start Web UI server');
        }
      }).catch(err => {
        console.error('Error starting Web UI server:', err);
        this.windowManager.getMainWindow()?.webContents.send('log-message', `Web UI server error: ${err.message}`);
      });
    } catch (err) {
      console.error('Error initializing Web UI server:', err);
      this.windowManager.getMainWindow()?.webContents.send('log-message', `Web UI initialization error: ${err.message}`);
    }
  }

  /**
   * Handle messages from WebUI server
   * @private
   * @param {string} channel - Message channel
   * @param {Object} data - Message data
   */
  async _handleWebUIMessage(channel, data) {
    switch(channel) {
      case 'job-selected':
        console.log(`Web UI selected job: ${data.filename}`);
        await this._processJobSelection(data);
        break;

      case 'get-model-preview':
        await this._handleModelPreviewRequest(data);
        break;

    }
  }

  /**
   * Process job selection from WebUI (extracted from JobPickerDialog logic)
   * @private
   * @param {Object} data - Job selection data {filename, leveling, startNow}
   */
  async _processJobSelection(data) {
    const { filename, leveling, startNow } = data;
    const mainWindow = this.windowManager.getMainWindow();
    
    // Check printer connection status
    const printerClient = this.printerConnectionManager.getPrinterClient();
    if (!printerClient) {
      console.error("Cannot process WebUI job selection: Printer client is not available.");
      mainWindow?.webContents.send('log-message', `Error selecting ${filename}: Printer not connected.`);
      return;
    }
    
    console.log(`Processing WebUI selected job: ${filename}, StartNow: ${startNow}`);
    
    try {
      // Start the job if "start now" is requested
      if (startNow) {
        mainWindow?.webContents.send('log-message', `Sending print command for ${filename}...`);
        
        const isLegacy = printerClient.getClientType() === 'legacy';
        
        if (isLegacy) {
          // Use legacy print support
          console.log(`Starting legacy print for ${filename} via WebUI`);
          try {
            const success = await printerClient.getRawClient().startJob(filename);
            if (success) {
              mainWindow?.webContents.send('log-message', `Print started: ${filename}`);
              console.log(`Legacy print command successful for ${filename} via WebUI.`);
            } else {
              mainWindow?.webContents.send('log-message', `Failed to start print: ${filename}`);
              console.error(`Legacy print command failed for ${filename} via WebUI.`);
            }
          } catch (error) {
            mainWindow?.webContents.send('log-message', `Error starting print: ${error.message}`);
            console.error(`Error starting legacy print via WebUI: ${error.message}`);
          }
        } else {
          // Use modern printer API
          console.log(`Starting modern print for ${filename} via WebUI`);
          await printerClient.getRawClient().jobControl.printLocalFile(
            filename,
            leveling
          );
          mainWindow?.webContents.send('log-message', `Print started: ${filename}`);
          console.log(`Modern print command successful for ${filename} via WebUI.`);
        }
      } else {
        // todo shouldn't really happen / be allowed..
        mainWindow?.webContents.send('log-message', `Job selected: ${filename}`);
        console.log(`Job selected via WebUI: ${filename} (not started immediately)`);
      }
      
      // Notify main window about the job selection details
      mainWindow?.webContents.send('job-selection-result', {
        filename: filename,
        leveling: leveling,
        startNow: startNow,
        source: 'webui'
      });
      
    } catch (error) {
      console.error(`Error during WebUI job selection processing for ${filename}:`, error);
      mainWindow?.webContents.send('log-message', `Error starting job ${filename}: ${error.message}`);
    }
  }

  /**
   * Handle model preview request from WebUI
   * @private
   * @param {Object} data - Request data with filename, wsClientId, requestId
   */
  async _handleModelPreviewRequest(data) {
    console.log(`Web UI requested model preview for: ${data.filename}`);
    const { filename, wsClientId } = data;

    if (!this.printerConnectionManager.getConnectionStatus()) {
      console.log(`Cannot get model preview - printer not connected`);
      this.webUIServer.sendModelPreviewToClient(wsClientId, filename, null);
      return;
    }

    try {
      let thumbnailBuffer = null;
      const printerClient = this.printerConnectionManager.getPrinterClient();
      console.log(`Getting model preview for ${filename}, client type: ${printerClient.clientType}`);

      try {
        if (printerClient.clientType === 'legacy') {
          // For legacy printers
          const fullFilename = filename.startsWith('/data/') ? filename : `/data/${filename}`;
          thumbnailBuffer = await this.printerConnectionManager.getLegacyThumbnail(fullFilename);
        } else if (printerClient.clientType === 'fivem') {
          // For modern printers
          try {
            const apiFileName = filename.startsWith('/data/') ? filename.substring(6) : filename;
            thumbnailBuffer = await printerClient.client.files.getGCodeThumbnail(apiFileName);
          } catch (err) {
            console.log(`Error with getGCodeThumbnail: ${err.message}`);
          }
        }
      } catch (error) {
        console.error(`Overall error in thumbnail retrieval: ${error.message}`);
      }

      // Convert to base64 and send back to web client
      console.log(`Thumbnail buffer for ${filename}: ${thumbnailBuffer ? 'Available' : 'Not available'}`);
      if (thumbnailBuffer) {
        const base64Thumbnail = thumbnailBuffer.toString('base64');
        console.log(`Sending model preview for ${filename} to web client ${wsClientId}`);
        this.webUIServer.sendModelPreviewToClient(wsClientId, filename, base64Thumbnail);
      } else {
        console.log(`No thumbnail available for ${filename}`);
        this.webUIServer.sendModelPreviewToClient(wsClientId, filename, null);
      }
    } catch (error) {
      console.error(`Error getting model preview: ${error.message}`);
      this.webUIServer.sendModelPreviewToClient(wsClientId, filename, null);
    }
  }

  /**
   * Stop WebUI server
   */
  stopWebUIServer() {
    if (this.webUIServer) {
      this.webUIServer.stop();
      this.webUIServer = null;
      this.windowManager.getMainWindow()?.webContents.send('log-message', 'Web UI server stopped due to settings change');
    }
  }

  /**
   * Restart WebUI server if enabled and printer is connected
   */
  restartWebUIServerIfEnabled() {
    const config = this.configManager.getConfig();
    if (config.WebUIEnabled && this.printerConnectionManager.getConnectionStatus()) {
      this.initializeWebUIServer(this.jobPickerDialog);
    }
  }

  /**
   * Restart camera service with new configuration
   */
  async restartCameraService() {
    this.cameraService.shutdown();
    await this.initializeCameraService();
  }

  /**
   * Get WebUI server instance
   * @returns {Object|null} WebUI server instance
   */
  getWebUIServer() {
    return this.webUIServer;
  }

  /**
   * Shutdown all services
   */
  shutdown() {
    if (this.webUIServer) {
      this.webUIServer.stop();
      this.webUIServer = null;
    }
    
    this.cameraService.shutdown();
  }
}

module.exports = ServiceManager;
