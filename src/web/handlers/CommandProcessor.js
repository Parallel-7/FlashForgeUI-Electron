// src/web/handlers/CommandProcessor.js

/**
 * CommandProcessor - Handles WebUI client commands using strategy pattern
 * Separated from WebSocketManager to focus on command processing logic
 */
class CommandProcessor {
  constructor(printerAdapter) {
    this.printerAdapter = printerAdapter;
    this.electronMessageCallback = null;
    this.commandStrategies = this.initializeCommandStrategies();
  }

  /**
   * Initialize command strategies for different command types
   */
  initializeCommandStrategies() {
    return {
      // Basic control commands
      'home-axes': () => this.printerAdapter.homeAxes(),
      'clear-status': () => this.printerAdapter.clearPlatform(),
      'led-on': () => this.printerAdapter.setLedOn(),
      'led-off': () => this.printerAdapter.setLedOff(),

      // Temperature control commands
      'set-bed-temp': (data) => this.printerAdapter.setBedTemp(data.temperature),
      'bed-temp-off': () => this.printerAdapter.cancelBedTemp(),
      'set-extruder-temp': (data) => this.printerAdapter.setExtruderTemp(data.temperature),
      'extruder-temp-off': () => this.printerAdapter.cancelExtruderTemp(),

      // Print job control commands
      'pause-print': () => this.printerAdapter.pausePrintJob(),
      'resume-print': () => this.printerAdapter.resumePrintJob(),
      'cancel-print': () => this.printerAdapter.cancelPrintJob(),

      // Filtration control commands
      'external-filtration': () => this.printerAdapter.setExternalFiltrationOn(),
      'internal-filtration': () => this.printerAdapter.setInternalFiltrationOn(),
      'no-filtration': () => this.printerAdapter.setFiltrationOff(),

      // Data request commands (these return data directly)
      'request-printer-data': () => Promise.resolve(true), // Handled specially
      'get-recent-files': () => this.handleFileListRequest('recent'),
      'get-local-files': () => this.handleFileListRequest('local'),

      // Print file command
      'print-file': (data) => this.handlePrintFileRequest(data)
    };
  }

  /**
   * Register callback for sending messages to Electron main process
   */
  registerElectronCallback(callback) {
    this.electronMessageCallback = callback;
  }

  /**
   * Handle incoming message from WebSocket client
   */
  async handleMessage(ws, message) {
    const { type, command, data, silent } = message;

    if (type !== 'command') {
      console.warn(`Unhandled message type: ${type}`);
      return;
    }

    // Check if printer is connected for most commands
    if (!this.isPrinterConnected() && !this.isConnectionIndependentCommand(command)) {
      this.sendErrorResponse(ws, command, 'Printer not connected', silent);
      return;
    }

    // Handle special commands that need custom processing
    if (this.isSpecialCommand(command)) {
      await this.handleSpecialCommand(ws, command, data, silent);
      return;
    }

    // Process standard commands using strategy pattern
    await this.processStandardCommand(ws, command, data, silent);
  }

  /**
   * Check if printer is connected
   */
  isPrinterConnected() {
    return this.printerAdapter && this.printerAdapter.client;
  }

  /**
   * Check if command can be executed without printer connection
   */
  isConnectionIndependentCommand(command) {
    const independentCommands = [
      'request-printer-data',
      'request-legacy-thumbnail',
      'request-model-preview'
    ];
    return independentCommands.includes(command);
  }

  /**
   * Check if command needs special handling
   */
  isSpecialCommand(command) {
    const specialCommands = [
      'request-legacy-thumbnail',
      'request-model-preview',
      'request-printer-data'
    ];
    return specialCommands.includes(command);
  }

  /**
   * Handle special commands that need custom processing
   */
  async handleSpecialCommand(ws, command, data, silent) {
    try {
      switch (command) {
        case 'request-legacy-thumbnail':
          await this.handleThumbnailRequest(ws, data.filename);
          break;
        case 'request-model-preview':
          await this.handleModelPreviewRequest(ws, data.filename, data.requestId);
          break;
        case 'request-printer-data':
          // This command is handled by the WebUI server directly
          this.sendToElectron('request-printer-data', null);
          if (!silent) {
            this.sendSuccessResponse(ws, command);
          }
          break;
        default:
          this.sendErrorResponse(ws, command, `Unknown special command: ${command}`, silent);
      }
    } catch (error) {
      console.error(`Error handling special command ${command}:`, error);
      this.sendErrorResponse(ws, command, error.message, silent);
    }
  }

  /**
   * Process standard commands using strategy pattern
   */
  async processStandardCommand(ws, command, data, silent) {
    const strategy = this.commandStrategies[command];
    
    if (!strategy) {
      this.sendErrorResponse(ws, command, `Unknown command: ${command}`, silent);
      return;
    }

    try {
      // Handle file list commands specially
      if (command === 'get-recent-files' || command === 'get-local-files') {
        await this.handleFileListCommand(ws, command, silent);
        return;
      }

      const success = await strategy(data);
      
      if (!silent) {
        if (success) {
          this.sendSuccessResponse(ws, command);
        } else {
          // Command returned false - provide a meaningful error message
          this.sendErrorResponse(ws, command, `${command} operation failed`);
        }
      }
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      this.sendErrorResponse(ws, command, error.message, silent);
    }
  }

  /**
   * Handle file list requests (recent/local files)
   */
  async handleFileListRequest(type) {
    console.log(`Handling ${type} file list request...`);
    
    try {
      if (!this.printerAdapter) {
        throw new Error('Printer adapter not available');
      }
      
      let files;
      
      if (type === 'recent') {
        console.log('Calling printerAdapter.getRecentFiles()...');
        files = await this.printerAdapter.getRecentFiles();
        console.log('Recent files from adapter:', files);
      } else {
        console.log('Calling printerAdapter.getLocalFiles()...');
        files = await this.printerAdapter.getLocalFiles();
        console.log('Local files from adapter:', files);
      }

      // Ensure we have an array
      const filesArray = Array.isArray(files) ? files :
          (files && typeof files === 'object' ?
              Object.keys(files).map(key => ({ ...files[key], key })) :
              []);

      console.log(`Processed ${type} files array:`, filesArray.length, 'files');
      
      // Return the files - the calling method will send to client
      return {
        success: true,
        files: filesArray,
        isRecent: type === 'recent'
      };
    } catch (error) {
      console.error(`Error getting ${type} files:`, error);
      throw error;
    }
  }

  /**
   * Handle print file request
   */
  async handlePrintFileRequest(data) {
    console.log('=== PRINT FILE REQUEST ===');
    console.log('Received print-file data:', JSON.stringify(data, null, 2));
    
    // Extract data with proper defaults
    const filename = data.filename;
    const leveling = data.leveling || false;
    const startNow = data.startNow !== undefined ? data.startNow : true; // Default to true for WebUI
    
    console.log('Processing print file request:');
    console.log('- Filename:', filename);
    console.log('- Leveling:', leveling);
    console.log('- Start Now:', startNow);
    
    // Send to Electron main process for handling
    const electronData = {
      filename: filename,
      leveling: leveling,
      startNow: startNow
    };
    
    console.log('Sending to Electron main process:');
    console.log('- Channel: job-selected');
    console.log('- Data:', JSON.stringify(electronData, null, 2));
    
    this.sendToElectron('job-selected', electronData);
    
    console.log('=== PRINT FILE REQUEST SENT ===');
    return true; // Always successful as it's just a relay
  }

  /**
   * Handle thumbnail request for legacy printers
   */
  async handleThumbnailRequest(ws, filename) {
    console.log(`Server handling thumbnail request for: ${filename}`);

    if (!this.printerAdapter) {
      this.sendThumbnailResponse(ws, filename, null, 'Printer not connected');
      return;
    }

    if (this.printerAdapter.getClientType() !== 'legacy') {
      console.log(`Not a legacy printer (type: ${this.printerAdapter.getClientType()}), skipping thumbnail request`);
      this.sendThumbnailResponse(ws, filename, null, 'Not a legacy printer');
      return;
    }

    try {
      console.log(`Requesting legacy thumbnail from printer adapter for: ${filename}`);
      const thumbnailBuffer = await this.printerAdapter.getLegacyThumbnail(filename);
      let base64Thumbnail = null;

      if (thumbnailBuffer) {
        console.log(`Thumbnail retrieved successfully, size: ${thumbnailBuffer.length} bytes`);
        base64Thumbnail = thumbnailBuffer.toString('base64');
      } else {
        console.log('No thumbnail returned from printer adapter');
      }

      this.sendThumbnailResponse(ws, filename, base64Thumbnail);
      console.log(`Thumbnail result sent to client for: ${filename}`);
    } catch (error) {
      console.error(`Error getting legacy thumbnail: ${error.message}`);
      this.sendThumbnailResponse(ws, filename, null, error.message);
    }
  }

  /**
   * Handle model preview request for all printer types
   */
  async handleModelPreviewRequest(ws, filename, requestId) {
    console.log(`Server handling model preview request for: ${filename}`);
    
    // Get client ID for response routing
    const clientId = this.getClientId ? this.getClientId(ws) : 0;

    // Relay request to Electron main process
    this.sendToElectron('get-model-preview', {
      filename,
      requestId,
      wsClientId: clientId
    });
  }

  /**
   * Send thumbnail response to client
   */
  sendThumbnailResponse(ws, filename, thumbnail, error = null) {
    const response = {
      type: 'legacy-thumbnail-result',
      filename,
      thumbnail,
      ...(error && { error })
    };

    ws.send(JSON.stringify(response));
  }

  /**
   * Send success response to client
   */
  sendSuccessResponse(ws, command) {
    const response = {
      type: 'command-response',
      command,
      success: true,
      message: 'Success'
    };

    ws.send(JSON.stringify(response));
  }

  /**
   * Send error response to client
   */
  sendErrorResponse(ws, command, message, silent = false) {
    if (silent) return;

    // Ensure we always have a meaningful error message
    const errorMessage = message || 'Command failed';
    
    const response = {
      type: 'command-response',
      command,
      success: false,
      message: errorMessage
    };

    console.error(`Command ${command} failed: ${errorMessage}`);
    ws.send(JSON.stringify(response));
  }

  /**
   * Send message to Electron main process
   */
  sendToElectron(channel, data) {
    if (this.electronMessageCallback) {
      this.electronMessageCallback(channel, data);
    } else {
      console.warn(`Cannot send to Electron - no callback registered for channel: ${channel}`);
    }
  }

  /**
   * Set helper methods from WebSocketManager
   */
  setHelperMethods(sendToClient, getClientId) {

    this.getClientId = getClientId;
  }

  /**
   * Handle file list response (called by WebUI server)
   */
  async handleFileListCommand(ws, command, silent) {
    try {
      const type = command === 'get-recent-files' ? 'recent' : 'local';
      const result = await this.handleFileListRequest(type);

      // Send file list directly to client in the format expected by the WebUI
      const response = {
        type: 'job-list',
        files: result.files,
        isRecent: result.isRecent
      };
      
      console.log(`Sending ${type} files to client:`, response.files.length, 'files');
      ws.send(JSON.stringify(response));

      if (!silent) {
        this.sendSuccessResponse(ws, command);
      }
    } catch (error) {
      console.error(`Error handling file list command ${command}:`, error);
      this.sendErrorResponse(ws, command, error.message || 'Failed to get file list', silent);
    }
  }
}

module.exports = CommandProcessor;
