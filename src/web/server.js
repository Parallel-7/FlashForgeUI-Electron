// src/web/server.js
const { getMachineStateText } = require('../utils/MachineStateUtils');
const sessionTokenManager = require('../managers/SessionTokenManager');

// Import modular components
const AuthenticationService = require('./core/AuthenticationService');
const WebServerCore = require('./core/WebServerCore');
const WebSocketManager = require('./core/WebSocketManager');
const CommandProcessor = require('./handlers/CommandProcessor');
const APIRouteHandler = require('./handlers/APIRouteHandler');

/**
 * WebUIServer - Orchestrates modular web server components
 * Refactored from monolithic 650+ line file to clean 200-line orchestration layer
 */
class WebUIServer {
  constructor(printerClientAdapter, configManager, cameraProxy) {
    this.printerAdapter = printerClientAdapter;
    this.configManager = configManager;
    this.cameraService = cameraProxy;
    
    // Component instances
    this.authService = new AuthenticationService(configManager);
    this.webSocketManager = new WebSocketManager();
    this.commandProcessor = new CommandProcessor(printerClientAdapter);
    this.apiRouteHandler = new APIRouteHandler(this.authService, cameraProxy, configManager);
    this.webServerCore = new WebServerCore(configManager);
    
    // Data management
    this.clientDataCache = {};
    this.updateInterval = null;
    this.electronMessageCallback = null;
    this.cameraProxySetup = false;
    this.lastProxyConfig = null;
    
    // Initialize component relationships
    this.setupComponentIntegration();
    
    console.log('WebUIServer initialized with modular architecture');
  }

  /**
   * Setup integration between components
   */
  setupComponentIntegration() {
    // Connect WebSocketManager with CommandProcessor
    this.webSocketManager.registerMessageHandler(this.commandProcessor);
    
    // Connect CommandProcessor with helper methods from WebSocketManager
    this.commandProcessor.setHelperMethods(
      this.webSocketManager.sendToClient.bind(this.webSocketManager),
      this.webSocketManager.getClientId.bind(this.webSocketManager)
    );
    
    // Connect CommandProcessor with Electron callback
    this.commandProcessor.registerElectronCallback((channel, data) => {
      this.sendToElectron(channel, data);
    });
    
    // Setup startup callback for data updates
    this.webServerCore.onStartup(() => {
      this.startDataUpdates();
    });
    
    // Setup shutdown callback
    this.webServerCore.onShutdown(() => {
      this.stopDataUpdates();
    });
  }

  /**
   * Initialize and start the server
   */
  async start() {
    try {
      // Initialize server core with all components
      this.webServerCore.initialize(
        this.authService,
        this.apiRouteHandler,
        this.webSocketManager
      );
      
      // Start the server
      return await this.webServerCore.start();
    } catch (error) {
      console.error('Failed to start WebUI server:', error);
      return false;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    try {
      await this.webServerCore.stop();
      console.log('WebUI server stopped');
      return true;
    } catch (error) {
      console.error('Error stopping WebUI server:', error);
      return false;
    }
  }

  /**
   * Start periodic data updates for connected clients
   */
  startDataUpdates() {
    // Stop any existing interval
    this.stopDataUpdates();

    // Update every 2 seconds (same as main UI)
    this.updateInterval = setInterval(async () => {
      if (!this.printerAdapter || !this.webSocketManager.getClientCount()) {
        return;
      }

      // Skip status updates if a file upload is in progress
      if (this.printerAdapter.isUploadInProgress) {
        console.log('WebUI status update skipped: File upload in progress');
        return;
      }

      await this.sendPrinterDataUpdate();
    }, 2000);
  }

  /**
   * Stop data updates
   */
  stopDataUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Send printer data update to all connected WebUI clients
   */
  async sendPrinterDataUpdate() {
    if (!this.printerAdapter) {
      return;
    }

    try {
      const info = await this.printerAdapter.getPrinterInfo();
      if (!info) return;

      // Cache the latest data
      this.clientDataCache.printerInfo = info;
      this.webSocketManager.updateClientDataCache('printerInfo', info);

      // Set up camera proxy URL for web clients (only if needed)
      this.setupCameraProxyUrlIfNeeded(info);

      // Process machine state consistently with error handling
      let machineState;
      try {
        machineState = getMachineStateText(info.MachineState);
      } catch (error) {
        console.warn('Error processing machine state:', error);
        machineState = 'Unknown';
      }

      // Prepare data for clients
      const dataToSend = {
        printerInfo: info,
        machineState,
        clientType: this.printerAdapter.getClientType()
      };

      // Broadcast to all connected clients
      this.webSocketManager.broadcastToClients('printer-data', dataToSend);
    } catch (error) {
      console.error('Error updating WebUI printer data:', error);
    }
  }

  /**
   * Setup camera proxy URL for web clients (only when needed)
   */
  setupCameraProxyUrlIfNeeded(info) {
    try {
      const serverStatus = this.webServerCore.getStatus();
      const config = this.configManager.getConfig();
      
      // Create current config signature to detect changes
      const currentProxyConfig = {
        serverIP: serverStatus?.serverIP,
        port: serverStatus?.port,
        externalHostname: config.ExternalHostname,
        useSSL: config.UseSSL
      };
      
      // Check if we need to update the camera proxy URL
      const configChanged = JSON.stringify(currentProxyConfig) !== JSON.stringify(this.lastProxyConfig);
      
      if (!this.cameraProxySetup || configChanged) {
        this.setupCameraProxyUrl(info, currentProxyConfig);
        this.lastProxyConfig = currentProxyConfig;
        this.cameraProxySetup = true;
      } else {
        // URL already set up, just copy from cache or set directly
        if (this.clientDataCache.cameraProxyUrl) {
          info.CameraStreamUrl = this.clientDataCache.cameraProxyUrl;
        }
      }
    } catch (error) {
      console.error('Error in setupCameraProxyUrlIfNeeded:', error);
      info.CameraStreamUrl = null;
    }
  }

  /**
   * Setup camera proxy URL for web clients
   */
  setupCameraProxyUrl(info, proxyConfig) {
    try {
      // Safety check for proxyConfig parameter
      if (!proxyConfig) {
        console.error('setupCameraProxyUrl called without proxyConfig parameter');
        info.CameraStreamUrl = null;
        return;
      }
      
      // Validate server status
      if (!proxyConfig.serverIP || !proxyConfig.port) {
        console.error('WebUI Server status not available for camera proxy URL setup:', proxyConfig);
        info.CameraStreamUrl = null;
        return;
      }
      
      let host;
      if (proxyConfig.externalHostname) {
        host = proxyConfig.externalHostname;
        console.log(`Using external hostname for camera proxy: ${host}`);
      } else {
        host = `${proxyConfig.serverIP}:${proxyConfig.port}`;
        console.log(`Using server IP for camera proxy: ${host}`);
      }

      const protocol = proxyConfig.useSSL ? 'https:' : 'http:';
      
      // Use session-generated camera proxy token instead of hard-coded 'PROXY'
      let proxyToken = 'PROXY'; // fallback
      if (sessionTokenManager.isInitialized()) {
        proxyToken = sessionTokenManager.getCameraProxyToken();
      } else {
        console.warn('SessionTokenManager not initialized - using fallback token for camera proxy');
      }
      
      const proxyUrl = `${protocol}//${host}/camera-proxy?token=${proxyToken}`;
      
      console.log(`Setting camera proxy URL with session token: ${proxyUrl.replace(proxyToken, proxyToken.substring(0, 8) + '...')}`);
      info.CameraStreamUrl = proxyUrl;
      
      // Cache the URL for future use
      this.clientDataCache.cameraProxyUrl = proxyUrl;
    } catch (error) {
      console.error('Error setting camera proxy URL:', error);
      info.CameraStreamUrl = null;
    }
  }

  /**
   * Handle events from the main Electron process
   */
  handleElectronEvent(type, data) {
    try {
      switch (type) {
        case 'printer-connected':
          this.webSocketManager.broadcastToClients('printer-connected', data);
          break;
        case 'printer-disconnected':
          this.webSocketManager.broadcastToClients('printer-disconnected');
          break;
        case 'reset-ui':
          this.webSocketManager.broadcastToClients('reset-ui', data);
          break;
        case 'log-message':
          this.webSocketManager.broadcastToClients('log-message', { message: data });
          break;
        case 'printer-data':
          if (data && data.printerInfo) {
            // 1. Create a deep copy of data.printerInfo for WebUIServer's use.
            const printerInfoForWebUI = JSON.parse(JSON.stringify(data.printerInfo));

            // 2. Call setupCameraProxyUrlIfNeeded on the copy.
            this.setupCameraProxyUrlIfNeeded(printerInfoForWebUI); 

            // 3. Use the modified copy for WebUIServer's cache.
            this.clientDataCache.printerInfo = printerInfoForWebUI;
            this.webSocketManager.updateClientDataCache('printerInfo', printerInfoForWebUI);

            // 4. Prepare a new data object for broadcasting, containing the modified copy.
            // The original 'data' object (and its 'data.printerInfo') remains untouched by setupCameraProxyUrlIfNeeded.
            const dataForBroadcast = {
              ...data, // Preserve other properties of the original 'data' object if any
              printerInfo: printerInfoForWebUI 
            };
            this.webSocketManager.broadcastToClients('printer-data', dataForBroadcast);
          }
          break;
        default:
          console.log(`Unhandled Electron event type: ${type}`);
          break;
      }
    } catch (error) {
      console.error(`Error handling Electron event '${type}':`, error);
    }
  }

  /**
   * Send model preview to web client (called from main process)
   */
  sendModelPreviewToClient(clientId, filename, thumbnail) {
    const clients = this.webSocketManager.getClients();
    const client = clients[clientId];

    if (!client || client.readyState !== 1) { // WebSocket.OPEN = 1
      console.log(`Cannot send model preview - client ${clientId} not found or not ready`);
      return false;
    }

    const response = {
      type: 'model-preview-result',
      filename,
      thumbnail
    };

    try {
      client.send(JSON.stringify(response));
      console.log(`Model preview sent to client ${clientId} for file ${filename}. Has thumbnail: ${thumbnail ? 'Yes' : 'No'}`);
      return true;
    } catch (error) {
      console.error(`Error sending model preview to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Register message callback from Electron main process
   */
  registerMessageCallback(callback) {
    this.electronMessageCallback = callback;
  }

  /**
   * Send message to Electron main process
   */
  sendToElectron(channel, data) {
    if (this.electronMessageCallback) {
      this.electronMessageCallback(channel, data);
    }
  }

  /**
   * Get server status information
   */
  getStatus() {
    const coreStatus = this.webServerCore.getStatus();
    
    return {
      ...coreStatus,
      components: {
        authService: !!this.authService,
        webSocketManager: !!this.webSocketManager,
        commandProcessor: !!this.commandProcessor,
        apiRouteHandler: !!this.apiRouteHandler,
        webServerCore: !!this.webServerCore
      },
      clientDataCache: Object.keys(this.clientDataCache),
      hasElectronCallback: !!this.electronMessageCallback
    };
  }

  /**
   * Update configuration for all components
   */
  async updateConfig() {
    try {
      await this.webServerCore.updateConfig();
      console.log('WebUI server configuration updated');
    } catch (error) {
      console.error('Error updating WebUI server configuration:', error);
    }
  }

}

module.exports = WebUIServer;
