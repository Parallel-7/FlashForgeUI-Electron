const configManager = require('../managers/ConfigManager');
const printerDetailsManager = require('../managers/PrinterDetailsManager');
const cameraService = require('../managers/camera/CameraService');
const sessionTokenManager = require('../managers/SessionTokenManager');

// Import managers
const WindowManager = require('../managers/window/WindowManager');
const PrinterConnectionManager = require('../managers/printer/PrinterConnectionManager');
const IPCManager = require('../managers/ipc/IPCManager');
const DialogManager = require('../managers/dialog/DialogManager');
const DialogHandlerManager = require('../managers/dialog/DialogHandlerManager');
const NotificationUtils = require('../utils/NotificationUtils');

// Import bootstrap modules
const ServiceManager = require('./ServiceManager');
const EventCoordinator = require('./EventCoordinator');

class ApplicationBootstrapper {
  constructor() {
    // Configuration
    this.currentConfig = configManager.getConfig();
    
    // Managers
    this.windowManager = null;
    this.printerConnectionManager = null;
    this.ipcManager = null;
    this.dialogManager = null;
    this.dialogHandlerManager = null;
    
    // Bootstrap components
    this.serviceManager = null;
    this.eventCoordinator = null;
    
    // State
    this.isInitialized = false;
  }

  /**
   * Initialize all application components
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }


    try {
      this._initializeSessionTokens();
      await this._initializeManagers();
      await this._initializeServices();
      this._initializeEventCoordination();
      this._initializeManagerComponents();
      this.isInitialized = true;
      console.log('ApplicationBootstrapper: Initialization completed');
      
    } catch (error) {
      console.error('ApplicationBootstrapper: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize session token manager for secure authentication
   * @private
   */
  _initializeSessionTokens() {
    sessionTokenManager.initialize();
  }

  /**
   * Create core manager instances
   * @private
   */
  async _initializeManagers() {
    
    // Create manager instances with dependencies
    this.windowManager = new WindowManager();
    
    this.printerConnectionManager = new PrinterConnectionManager(
      this.windowManager,
      configManager,
      printerDetailsManager,
      NotificationUtils,
      cameraService
    );
    
    this.dialogManager = new DialogManager(this.windowManager);
    
    this.ipcManager = new IPCManager(
      this.windowManager,
      this.printerConnectionManager,
      configManager,
      this.dialogManager
    );
    
    this.dialogHandlerManager = new DialogHandlerManager(
      this.windowManager, 
      this.printerConnectionManager
    );
  }

  /**
   * Initialize service management
   * @private
   */
  async _initializeServices() {
    
    // Create service manager
    this.serviceManager = new ServiceManager(
      configManager,
      cameraService,
      this.printerConnectionManager,
      this.windowManager
    );
    
    // Initialize camera service
    const cameraSuccess = await this.serviceManager.initializeCameraService();
    if (!cameraSuccess) {
      console.warn('Camera service initialization failed');
    }
  }

  /**
   * Initialize event coordination
   * @private
   */
  _initializeEventCoordination() {
    
    this.eventCoordinator = new EventCoordinator(
      this.printerConnectionManager,
      this.ipcManager,
      this.windowManager,
      configManager,
      this.serviceManager,
      this.dialogManager
    );
    
    // Set up all event handlers
    this.eventCoordinator.setupAllEvents();
  }

  /**
   * Initialize all manager components
   * @private
   */
  _initializeManagerComponents() {
    
    // Initialize managers
    this.ipcManager.initialize();
    this.dialogManager.initialize();
    this.dialogHandlerManager.initialize();
  }

  /**
   * Create main application window
   * @returns {BrowserWindow} Created main window
   */
  createMainWindow() {
    console.log('ApplicationBootstrapper: Creating main window...');

    return this.windowManager.createMainWindow({
      alwaysOnTop: this.currentConfig.AlwaysOnTop
    });
  }

  /**
   * Start printer connection flow
   * @param {BrowserWindow} mainWindow - Main application window
   */
  async startConnectionFlow(mainWindow) {
    
    try {
      const connected = await this.printerConnectionManager.startConnectionFlow();
      if (!connected) {
        console.log("Initial connection flow failed or was cancelled.");
        mainWindow.webContents.send('log-message', "Initial connection failed. Use 'Connect' button to retry.");
      }
    } catch (error) {
      console.error('Connection flow error:', error);
      mainWindow.webContents.send('log-message', `Connection error: ${error.message}`);
    }
  }

  /**
   * Get manager instances for external access
   */
  getManagers() {
    return {
      windowManager: this.windowManager,
      printerConnectionManager: this.printerConnectionManager,
      ipcManager: this.ipcManager,
      dialogManager: this.dialogManager,
      dialogHandlerManager: this.dialogHandlerManager,
      serviceManager: this.serviceManager,
      eventCoordinator: this.eventCoordinator
    };
  }

  /**
   * Get job picker dialog instance
   * @returns {Object|null} Job picker dialog
   */
  getJobPickerDialog() {
    return this.eventCoordinator ? this.eventCoordinator.getJobPickerDialog() : null;
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    
    try {
      // Dispose managers in reverse order
      if (this.dialogHandlerManager) { this.dialogHandlerManager.dispose(); }
      if (this.dialogManager) { this.dialogManager.dispose(); }
      if (this.ipcManager) { this.ipcManager.dispose(); }
      if (this.printerConnectionManager) { this.printerConnectionManager.dispose(); }
      // Shutdown services
      if (this.serviceManager) { this.serviceManager.shutdown(); }
      // Clean up session tokens
      sessionTokenManager.cleanup();
      // Clean up WindowManager
      if (this.windowManager) { this.windowManager.dispose(); }
      console.log('ApplicationBootstrapper: Cleanup completed');
    } catch (error) {
      console.error('ApplicationBootstrapper: Error during disposal:', error);
    }
  }

}

module.exports = ApplicationBootstrapper;
