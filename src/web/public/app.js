// src/web/public/app.js - Refactored Modular Version

// WebUI Client Application - Main Orchestrator
(function() {
  // Global constants and state
  window.AUTH_TOKEN_KEY = 'ffui_auth_token';
  window.isConnected = false;
  window.clientType = null;
  window.previewEnabled = false;
  window.previewPlayer = null;
  window.cameraStreamUrl = null;
  window.selectedFilename = null;
  window.modalResolveFunc = null;

  // Module instances
  let domManager;
  let uiUtils;
  let authManager;
  let wsManager;
  let printerDataManager;
  let cameraManager;
  let fileManager;

  // Main initialization
  window.addEventListener('DOMContentLoaded', initializeApplication);

  /**
   * Initialize the entire application
   */
  function initializeApplication() {
    // Initialize modules in dependency order
    initializeModules();
    
    // Setup event handlers
    setupEventHandlers();
    
    // Setup service worker for PWA
    setupServiceWorker();
    
    // Start authentication flow
    authManager.initialize((token) => connectToServer(token));
    
    // Setup online/offline handlers
    setupNetworkHandlers();
  }

  /**
   * Initialize all modules
   */
  function initializeModules() {
    // Base modules (no dependencies)
    domManager = window.domManager;
    domManager.cacheElements();
    
    // UI utilities (depends on DOM manager)
    uiUtils = new window.UIUtils(domManager);
    
    // Authentication (depends on DOM and UI)
    authManager = new window.AuthManager(domManager, uiUtils);
    
    // WebSocket manager (depends on UI and Auth)
    wsManager = new window.WebSocketManager(uiUtils, authManager);
    
    // Printer data manager (depends on DOM and UI)
    printerDataManager = new window.PrinterDataManager(domManager, uiUtils);
    
    // Camera manager (depends on DOM and UI)
    cameraManager = new window.CameraManager(domManager, uiUtils);
    cameraManager.initialize();
    
    // File manager (depends on DOM and UI)
    fileManager = new window.FileManager(domManager, uiUtils);
    fileManager.initialize();
    
    // Store globally for compatibility
    window.wsManager = wsManager;
    window.printerDataManager = printerDataManager;
    window.cameraManager = cameraManager;
    window.fileManager = fileManager;
  }

  /**
   * Setup main event handlers
   */
  function setupEventHandlers() {
    const elements = domManager.getElements();
    
    // Printer control buttons (using factory function for optimization)
    const printerCommands = [
      { element: 'ledOnBtn', command: 'led-on', log: 'LED On' },
      { element: 'ledOffBtn', command: 'led-off', log: 'LED Off' },
      { element: 'clearStatusBtn', command: 'clear-status', log: 'Clear Status' },
      { element: 'homeAxesBtn', command: 'home-axes', log: 'Home Axes' },
      { element: 'pauseBtn', command: 'pause-print', log: 'Pause Print' },
      { element: 'resumeBtn', command: 'resume-print', log: 'Resume Print' }
    ];
    
    printerCommands.forEach(({ element, command, log }) => {
      if (elements[element]) {
        elements[element].addEventListener('click', 
          uiUtils.createCommandHandler(command, (cmd, data) => wsManager.sendCommand(cmd, data), log)
        );
      }
    });

    // Temperature control buttons
    if (elements.bedSetBtn) {
      elements.bedSetBtn.addEventListener('click', () => 
        uiUtils.showTempDialog('bed', (cmd, data) => wsManager.sendCommand(cmd, data))
      );
    }
    
    if (elements.bedOffBtn) {
      elements.bedOffBtn.addEventListener('click', 
        uiUtils.createCommandHandler('bed-temp-off', (cmd, data) => wsManager.sendCommand(cmd, data), 'Bed Temperature Off')
      );
    }
    
    if (elements.extruderSetBtn) {
      elements.extruderSetBtn.addEventListener('click', () => 
        uiUtils.showTempDialog('extruder', (cmd, data) => wsManager.sendCommand(cmd, data))
      );
    }
    
    if (elements.extruderOffBtn) {
      elements.extruderOffBtn.addEventListener('click', 
        uiUtils.createCommandHandler('extruder-temp-off', (cmd, data) => wsManager.sendCommand(cmd, data), 'Extruder Temperature Off')
      );
    }

    // Filtration control buttons
    const filtrationCommands = [
      { element: 'externalFiltrationBtn', command: 'external-filtration', status: 'External' },
      { element: 'internalFiltrationBtn', command: 'internal-filtration', status: 'Internal' },
      { element: 'noFiltrationBtn', command: 'no-filtration', status: 'None' }
    ];
    
    filtrationCommands.forEach(({ element, command, status }) => {
      if (elements[element]) {
        elements[element].addEventListener('click', () => {
          wsManager.sendCommand(command);
          domManager.updateText('filtrationStatus', status);
        });
      }
    });

    // Special handlers
    if (elements.stopBtn) {
      elements.stopBtn.addEventListener('click', confirmStopPrint);
    }

    // Input dialog handlers
    if (elements.closeDialog) {
      elements.closeDialog.addEventListener('click', () => uiUtils.cancelInputDialog());
    }
    if (elements.dialogCancel) {
      elements.dialogCancel.addEventListener('click', () => uiUtils.cancelInputDialog());
    }
    if (elements.dialogConfirm) {
      elements.dialogConfirm.addEventListener('click', () => uiUtils.confirmInputDialog());
    }
    if (elements.dialogInput) {
      elements.dialogInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') uiUtils.confirmInputDialog();
      });
    }
  }

  /**
   * Connect to WebSocket server
   * @param {string} token Authentication token
   */
  async function connectToServer(token) {
    // Register WebSocket message handlers
    wsManager.registerHandlers({
      'printer-data': (message) => printerDataManager.handlePrinterData(message.data, {
        requestLegacyThumbnail: (filename) => printerDataManager.requestLegacyThumbnail(filename, (cmd, data) => wsManager.sendCommand(cmd, data)),
        requestModelPreview: (filename) => printerDataManager.requestModelPreview(filename, (cmd, data) => wsManager.sendCommand(cmd, data))
      }),
      'printer-connected': (message) => printerDataManager.handlePrinterConnected(message.data, (cmd) => wsManager.sendCommand(cmd)),
      'printer-disconnected': () => printerDataManager.handlePrinterDisconnected(),
      'reset-ui': (message) => printerDataManager.resetUI(message.data),
      'log-message': (message) => uiUtils.logMessage(message.data.message),
      'command-response': (message) => wsManager.handleCommandResponse(message),
      'job-list': (message) => fileManager.handleJobList(message),
      'legacy-thumbnail-result': (message) => printerDataManager.handleLegacyThumbnailResult(message),
      'model-preview-result': (message) => printerDataManager.handleModelPreviewResult(message)
    });

    // Connect to WebSocket
    const connected = await wsManager.connectWithToken(token);
    if (connected) {
      console.log('Successfully connected to WebSocket server');
    }
  }

  /**
   * Confirm stop print with dialog
   */
  function confirmStopPrint() {
    if (uiUtils.showConfirmDialog('Are you sure you want to stop the print job?')) {
      wsManager.sendCommand('cancel-print');
    }
  }

  /**
   * Setup service worker for PWA support
   */
  function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(() => console.log('ServiceWorker registered'))
          .catch(err => console.log('ServiceWorker registration failed:', err));
      });
    }
  }

  /**
   * Setup network online/offline handlers
   */
  function setupNetworkHandlers() {
    window.addEventListener('online', () => 
      uiUtils.handleOnlineStatus((token) => wsManager.connectWithToken(token))
    );
    window.addEventListener('offline', () => 
      uiUtils.handleOnlineStatus()
    );
  }

  // Export global functions for compatibility
  window.showToast = (message, type, duration) => uiUtils.showToast(message, type, duration);
  window.logMessage = (message, showToast) => uiUtils.logMessage(message, showToast);
  window.sendCommand = (command, data, silent) => wsManager.sendCommand(command, data, silent);
  
})();
