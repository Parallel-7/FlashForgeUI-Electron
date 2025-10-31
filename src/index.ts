/**
 * @fileoverview Main Electron process entry point.
 *
 * This file is the heart of the Electron application, responsible for initializing
 * the app, creating the main browser window, and orchestrating all backend

 * services and managers. It follows a modular architecture, delegating specific
 * responsibilities to dedicated modules for better organization and maintainability.
 *
 * Key responsibilities include:
 * - Handling the Electron app lifecycle (ready, activate, window-all-closed, before-quit).
 * - Ensuring a single instance of the application is running.
 * - Creating and managing the main application window (BrowserWindow).
 * - Initializing all core managers (ConfigManager, ConnectionFlowManager, etc.).
 * - Setting up IPC handlers for communication between the main and renderer processes.
 * - Coordinating background services like printer polling and camera streaming.
 * - Managing application-level concerns like power-saving and environment detection.
 */

// CRITICAL: Bootstrap must be imported FIRST to set app name before any singletons are created
import './bootstrap';

import { app, BrowserWindow, dialog, powerSaveBlocker, ipcMain } from 'electron';
import { getConfigManager } from './managers/ConfigManager';
import { getPrinterConnectionManager } from './managers/ConnectionFlowManager';
import { getPrinterBackendManager } from './managers/PrinterBackendManager';
import { getPrinterContextManager } from './managers/PrinterContextManager';
import { getWindowManager } from './windows/WindowManager';
import { setupWindowControlHandlers } from './ipc/WindowControlHandlers';
import { setupDialogHandlers } from './ipc/DialogHandlers';
import { registerAllIpcHandlers } from './ipc/handlers';
import { setupPrinterContextHandlers, setupConnectionStateHandlers, setupCameraContextHandlers } from './ipc/printer-context-handlers';
import type { PollingData } from './types/polling';
// import { getMainProcessPollingCoordinator } from './services/MainProcessPollingCoordinator';
import { getMultiContextPollingCoordinator } from './services/MultiContextPollingCoordinator';
import { getMultiContextNotificationCoordinator } from './services/MultiContextNotificationCoordinator';
import { getCameraProxyService } from './services/CameraProxyService';
import { getRtspStreamService } from './services/RtspStreamService';
import { cameraIPCHandler } from './ipc/camera-ipc-handler';
import { getWebUIManager } from './webui/server/WebUIManager';
import { getEnvironmentDetectionService } from './services/EnvironmentDetectionService';
import { getStaticFileManager } from './services/StaticFileManager';
import { initializeNotificationSystem, disposeNotificationSystem } from './services/notifications';
import { getThumbnailCacheService } from './services/ThumbnailCacheService';
import { injectUIStyleVariables } from './utils/CSSVariables';
import { parseHeadlessArguments, validateHeadlessConfig } from './utils/HeadlessArguments';
import { setHeadlessMode, isHeadlessMode } from './utils/HeadlessDetection';
import { getHeadlessManager } from './managers/HeadlessManager';
import { getAutoUpdateService } from './services/AutoUpdateService';

/**
 * Main Electron process entry point. Handles app lifecycle, creates the main window,
 * and coordinates all system components. The heavy lifting is delegated to
 * specialized modules for better maintainability.
 */

// Note: This project uses NSIS installer, not Squirrel
// NSIS handles shortcuts and installation events automatically

// Check for headless mode BEFORE single instance lock
const headlessConfig = parseHeadlessArguments();

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Another instance is already running, quit immediately
  app.quit();
} else {
  // This is the primary instance - handle second instance attempts
  app.on('second-instance', () => {
    // Focus existing window instead of creating new instance
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      console.log('Second instance blocked - focused existing window');
    }
  });
}

// Note: app.setName() and app.setAppUserModelId() are now called in bootstrap.ts
// to ensure they execute before any singleton initialization

// Initialize global reference for camera IPC handler
global.printerBackendManager = undefined;

// Power save blocker to prevent OS throttling
let powerSaveBlockerId: number | null = null;

/**
 * Initialize the camera proxy service
 * In multi-context architecture, camera proxies are created on-demand per context
 * This function is now a no-op but kept for backward compatibility
 */
const initializeCameraService = async (): Promise<void> => {
  // Camera proxies are now created automatically when printer contexts are established
  // Each context gets its own camera proxy on a unique port (8181-8191 range)
  console.log('Camera proxy service ready (multi-context mode)');
};

/**
 * Validate web UI assets before loading
 */
const validateWebUIAssets = async (): Promise<{ valid: boolean; errors: string[] }> => {
  const staticFileManager = getStaticFileManager();
  const environmentService = getEnvironmentDetectionService();
  
  console.log('=== Web UI Asset Validation ===');
  
  // Log environment information for debugging
  environmentService.logEnvironmentInfo();
  await staticFileManager.logDiagnosticInfo();
  
  // Validate critical assets
  const validation = await staticFileManager.validateCriticalAssets();
  
  if (!validation.isValid) {
    console.error('Critical asset validation failed:');
    console.error(`Missing assets: ${validation.missingAssets.join(', ')}`);
    console.error(`Inaccessible assets: ${validation.inaccessibleAssets.join(', ')}`);
    validation.errors.forEach(error => console.error(`Error: ${error}`));
  } else {
    console.log('All critical assets validated successfully');
  }
  
  console.log('===============================');
  
  return {
    valid: validation.isValid,
    errors: [...validation.errors]
  };
};

/**
 * Handle web UI loading errors with comprehensive diagnostics
 */
const handleWebUILoadError = async (error: Error, htmlPath: string): Promise<void> => {
  const environmentService = getEnvironmentDetectionService();
  const staticFileManager = getStaticFileManager();
  
  console.error('=== Web UI Loading Error ===');
  console.error(`Failed to load web UI from: ${htmlPath}`);
  console.error(`Error: ${error.message}`);
  
  // Get diagnostic information
  const envDiagnostics = environmentService.getDiagnosticInfo();
  const staticDiagnostics = staticFileManager.getDiagnosticInfo();
  
  console.error('Environment Diagnostics:', JSON.stringify(envDiagnostics, null, 2));
  console.error('Static File Diagnostics:', JSON.stringify(staticDiagnostics, null, 2));
  
  // Validate assets to get detailed error information
  const validation = await staticFileManager.validateCriticalAssets();
  console.error('Asset Validation Results:', JSON.stringify(validation, null, 2));
  
  console.error('============================');
  
  // Show user-friendly error dialog
  const errorMessage = `Failed to load the application interface.

Environment: ${envDiagnostics.environment} (${envDiagnostics.isPackaged ? 'packaged' : 'unpackaged'})
HTML Path: ${htmlPath}
Error: ${error.message}

Missing Assets: ${validation.missingAssets.length > 0 ? validation.missingAssets.join(', ') : 'None'}
Inaccessible Assets: ${validation.inaccessibleAssets.length > 0 ? validation.inaccessibleAssets.join(', ') : 'None'}

Please check the installation and try restarting the application.`;

  dialog.showErrorBox('Application Loading Error', errorMessage);
};

/**
 * Handle macOS rounded UI compatibility by disabling it and warning the user
 */
const handleMacOSRoundedUICompatibility = async (): Promise<void> => {
  // Check if running on macOS
  if (process.platform !== 'darwin') {
    return; // Not on macOS, no action needed
  }
  
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  
  // Check if rounded UI is enabled on macOS
  if (config.RoundedUI) {
    console.log('macOS detected with rounded UI enabled - disabling for compatibility');
    
    // Disable rounded UI
    configManager.updateConfig({ RoundedUI: false });
    
    // Show warning dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Rounded UI Disabled',
      message: 'Rounded UI has been automatically disabled on macOS',
      detail: 'The rounded UI feature causes window control positioning issues on macOS. It has been disabled automatically to ensure proper functionality. Please restart the application to avoid any UI inconsistencies.',
      buttons: ['Restart Now', 'Continue'],
      defaultId: 0,
      cancelId: 1
    });
    
    if (result.response === 0) {
      // User chose to restart
      app.relaunch();
      app.exit();
    }
  }
};

/**
 * Create the main application window with environment-aware path resolution
 */
const createMainWindow = async (): Promise<void> => {
  const windowManager = getWindowManager();
  const environmentService = getEnvironmentDetectionService();
  const staticFileManager = getStaticFileManager();
  
  // Handle macOS rounded UI compatibility before creating windows
  await handleMacOSRoundedUICompatibility();
  
  // Validate assets before creating window
  const assetValidation = await validateWebUIAssets();
  
  if (!assetValidation.valid) {
    console.error('Asset validation failed, but proceeding with window creation');
    // Continue anyway - the error will be caught during loadFile
  }
  
  // Get environment-aware paths
  const preloadPath = staticFileManager.getPreloadScriptPath();
  const htmlPath = staticFileManager.getMainHTMLPath();
  
  console.log(`Creating main window with preload: ${preloadPath}`);
  console.log(`Will load HTML from: ${htmlPath}`);
  
  // Get UI configuration for main window (only for transparency)
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const roundedUI = config.RoundedUI;
  const useRoundedUI = roundedUI && process.platform !== 'darwin';
  
  // Create the browser window - always frameless for custom titlebar
  const mainWindow = new BrowserWindow({
    height: 950,
    width: 970,
    minWidth: 970,  // Set to match the optimal width shown in the image
    minHeight: 930,  // Set to match the optimal height shown in the image
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Prevent app freezing when not focused
      webSecurity: true, // Security
      allowRunningInsecureContent: false, // Security
    },
    frame: false, // Always frameless for custom titlebar
    transparent: useRoundedUI, // Only transparent when rounded UI is enabled
    show: true, // Show immediately when ready
  });

  // Hide traffic light buttons on macOS
  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(false);
  }

  // Ensure background throttling is disabled for WebContents
  mainWindow.webContents.setBackgroundThrottling(false);

  // Load the app using environment-aware path resolution
  try {
    console.log(`Loading web UI from: ${htmlPath}`);
    await mainWindow.loadFile(htmlPath);
    console.log('Web UI loaded successfully');
    
    // Inject CSS variables for conditional UI styling
    injectUIStyleVariables(mainWindow);
    console.log('CSS variables injected for main window');
  } catch (error) {
    const loadError = error instanceof Error ? error : new Error(String(error));
    console.error('Failed to load web UI:', loadError.message);
    
    // Handle the error with comprehensive diagnostics
    await handleWebUILoadError(loadError, htmlPath);
    
    // Try to continue anyway - the window might still be usable
    console.log('Continuing despite load error...');
  }

  // Start power save blocker once window is ready
  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready and displayed');

    // Start power save blocker to prevent OS throttling
    if (powerSaveBlockerId === null) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      console.log('Power save blocker started to prevent app suspension');
    }
  });
  


  // Handle web contents errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Web contents failed to load: ${errorDescription} (${errorCode})`);
    console.error(`Failed URL: ${validatedURL}`);
    
    // Log additional diagnostic information
    const diagnostics = {
      errorCode,
      errorDescription,
      validatedURL,
      currentURL: mainWindow.webContents.getURL(),
      environment: environmentService.getEnvironment(),
      isPackaged: environmentService.isPackaged()
    };
    console.error('Load failure diagnostics:', JSON.stringify(diagnostics, null, 2));
  });

  // Open the DevTools in development
  if (environmentService.isDevelopment()) {
    console.log('Opening DevTools in development mode');
    mainWindow.webContents.openDevTools();
  }

  // Handle window focus/blur events to maintain activity
  mainWindow.on('focus', () => {
    console.log('Window focused');
  });
  
  mainWindow.on('blur', () => {
    console.log('Window blurred - maintaining background activity');
  });
  
  mainWindow.on('minimize', () => {
    console.log('Window minimized - maintaining background activity');
  });
  
  mainWindow.on('restore', () => {
    console.log('Window restored');
  });

  // Register the main window with WindowManager
  windowManager.setMainWindow(mainWindow);
  
  console.log('Main window created and registered');
};

/**
 * Setup connection state event forwarding
 */
/**
 * Set up printer context event forwarding to renderer process
 */
const setupPrinterContextEventForwarding = (): void => {
  const contextManager = getPrinterContextManager();
  const windowManager = getWindowManager();
  const multiContextPollingCoordinator = getMultiContextPollingCoordinator();
  const backendManager = getPrinterBackendManager();

  // Forward context-created events to renderer
  contextManager.on('context-created', (event: unknown) => {
    const contextEvent = event as import('./types/PrinterContext').ContextCreatedEvent;

    console.log('[Context Event] Received context-created:', JSON.stringify(contextEvent, null, 2));

    // Forward to renderer
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('printer-context-created', contextEvent);
      console.log(`[Context Event] Forwarded context-created event: ${contextEvent.contextId}`);
    }

    // NOTE: Polling and camera setup happen in backend-initialized event
    // because they require the backend to be ready
  });

  // Start polling and camera when backend is initialized for a context
  backendManager.on('backend-initialized', (event: unknown) => {
    const backendEvent = event as { contextId: string; modelType: string };

    console.log(`[MultiContext] Backend initialized for context ${backendEvent.contextId}`);

    // Start polling for this context
    try {
      multiContextPollingCoordinator.startPollingForContext(backendEvent.contextId);
      console.log(`[MultiContext] Started polling for context ${backendEvent.contextId}`);
    } catch (error) {
      console.error(`[MultiContext] Failed to start polling for context ${backendEvent.contextId}:`, error);
    }

    // Setup camera for this context
    void cameraIPCHandler.handlePrinterConnected(backendEvent.contextId);
  });

  // Forward polling data from active context to renderer
  multiContextPollingCoordinator.on('polling-data', (contextId: string, data: unknown) => {
    // Only forward polling data from the active context to avoid flooding the renderer
    const activeContextId = contextManager.getActiveContextId();
    if (contextId === activeContextId) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('polling-update', data);
      }

      // Forward to WebUI for WebSocket clients
      const webUIManager = getWebUIManager();
      webUIManager.handlePollingUpdate(data as PollingData);
    }
  });

  // Forward context-switched events
  contextManager.on('context-switched', (event: unknown) => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('printer-context-switched', event);
      const contextEvent = event as { contextId: string };
      console.log(`Forwarded context-switched event: ${contextEvent.contextId}`);
    }
  });

  // Forward context-removed events
  contextManager.on('context-removed', (event: unknown) => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('printer-context-removed', event);
      const contextEvent = event as { contextId: string };
      console.log(`Forwarded context-removed event: ${contextEvent.contextId}`);
    }
  });

  console.log('Printer context event forwarding set up');
};

const setupConnectionEventForwarding = (): void => {
  const connectionManager = getPrinterConnectionManager();
  const windowManager = getWindowManager();
  const backendManager = getPrinterBackendManager();
  const webUIManager = getWebUIManager();

  // Set global reference for camera IPC handler
  global.printerBackendManager = backendManager;
  
  // Stop polling BEFORE disconnect to prevent commands during logout
  // NOTE: In multi-context mode, polling is managed per-context by MultiContextPollingCoordinator
  // which automatically stops polling when contexts are removed
  connectionManager.on('pre-disconnect', (contextId: string) => {
    console.log('Pre-disconnect event received');
    // Polling cleanup is handled by context-removed events in MultiContextPollingCoordinator

    // Also handle camera disconnection for the specific context
    void cameraIPCHandler.handlePrinterDisconnected(contextId);
  });
  
  // Backend initialization notification
  // NOTE: In multi-context mode, polling and camera setup happen in context-created events
  connectionManager.on('backend-initialized', (data: unknown) => {
    // Send only serializable data, not the backend instance
    const eventData = data as { printerDetails?: { Name?: string; IPAddress?: string }; modelType?: string };

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-initialized', {
        success: true,
        printerName: eventData.printerDetails?.Name || 'Unknown',
        modelType: eventData.modelType || 'unknown',
        timestamp: new Date().toISOString()
      });
    }

    // Polling and camera setup happen automatically when context is created
    console.log('Backend initialized - polling and camera will start when context is created');

    // Start WebUI server now that printer is connected
    void webUIManager.startForPrinter(eventData.printerDetails?.Name || 'Unknown');
  });
  
  connectionManager.on('backend-initialization-failed', (data: unknown) => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const eventData = data as { error?: string; printerDetails?: { Name?: string } };
      mainWindow.webContents.send('backend-initialization-failed', {
        success: false,
        error: eventData.error || 'Unknown error',
        printerName: eventData.printerDetails?.Name || 'Unknown',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  connectionManager.on('backend-disposed', () => {
    // In multi-context mode, polling is stopped automatically when contexts are removed
    console.log('Backend disposed');
    // Polling cleanup is handled by context-removed events in MultiContextPollingCoordinator

    // Stop WebUI server when printer disconnects
    void webUIManager.stopForPrinter();

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-disposed', {
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Perform auto-connect functionality for saved printers
 * Called only after renderer confirms it's ready via IPC
 */
const performAutoConnect = async (): Promise<void> => {
  try {
    const connectionManager = getPrinterConnectionManager();
    const windowManager = getWindowManager();
    const result = await connectionManager.tryAutoConnect();
    
    if (result.success) {
      console.log('Auto-connected to saved printer:', result.printerDetails?.Name);
      const mainWindow = windowManager.getMainWindow();
      mainWindow?.webContents.send('printer-connected', {
        name: result.printerDetails?.Name,
        ipAddress: result.printerDetails?.IPAddress,
        serialNumber: result.printerDetails?.SerialNumber,
        clientType: result.printerDetails?.ClientType
      });
    } else {
      console.log('Auto-connect failed or no saved printer:', result.error);
    }
  } catch (error) {
    console.error('Auto-connect error:', error);
  }
};

/**
 * Setup event-driven services triggered by renderer ready signal
 */
const setupEventDrivenServices = (): void => {
  // Listen for renderer-ready signal to start auto-connect
  ipcMain.handle('renderer-ready', async () => {
    console.log('Renderer ready signal received - checking config status');

    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    // Send platform information to renderer for platform-specific styling
    // This must happen AFTER renderer is ready to avoid race conditions on fast systems
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`Sending platform info to ready renderer: ${process.platform}`);
      mainWindow.webContents.send('platform-info', process.platform);
    }

    const configManager = getConfigManager();

    // Check if config is already loaded
    if (configManager.isConfigLoaded()) {
      console.log('Config already loaded - starting auto-connect immediately');
      void performAutoConnect();
    } else {
      console.log('Config not yet loaded - waiting for config-loaded event');
      configManager.once('config-loaded', () => {
        console.log('Config loaded - starting auto-connect');
        void performAutoConnect();
      });
    }

    return { success: true };
  });
};

/**
 * Initialize the application
 */
const initializeApp = async (): Promise<void> => {
  // CRITICAL: Set up IPC handlers BEFORE creating window to prevent race conditions
  console.log('Setting up IPC handlers before window creation...');
  
  // Setup event-driven auto-connect FIRST (before window creation)
  setupEventDrivenServices();
  console.log('Event-driven services handlers registered (WebUI starts on printer connection)');
  
  // Register all IPC handlers using the modular system
  const managers = {
    configManager: getConfigManager(),
    connectionManager: getPrinterConnectionManager(),
    backendManager: getPrinterBackendManager(),
    windowManager: getWindowManager()
  };
  registerAllIpcHandlers(managers);
  console.log('All IPC handlers registered');

  // Setup printer context IPC handlers
  setupPrinterContextHandlers();
  setupConnectionStateHandlers();
  setupCameraContextHandlers();
  console.log('Printer context IPC handlers registered');

  // Setup legacy dialog handlers (printer selection enhancement, loading overlay)
  setupDialogHandlers();
  
  // NOW create the window - renderer will find handlers already registered
  await createMainWindow();
  console.log('Main window created with all handlers ready');
  
  // Continue with remaining initialization
  setupWindowControlHandlers();
  
  // Setup event forwarding
  setupConnectionEventForwarding();
  setupPrinterContextEventForwarding();

  // Initialize camera service
  await initializeCameraService();

  // Initialize RTSP stream service (for RTSP camera support)
  // This must be initialized unconditionally, not just when WebUI is enabled
  const rtspStreamService = getRtspStreamService();
  await rtspStreamService.initialize();
  console.log('RTSP stream service initialized');

  // Note: WebUI server initialization moved to non-blocking context
  // (will be initialized after renderer-ready signal to prevent startup crashes)

  // Initialize notification system (base system only, per-context coordinators created when polling starts)
  initializeNotificationSystem();
  console.log('Notification system initialized');

  try {
    const autoUpdateService = getAutoUpdateService();
    await autoUpdateService.initialize();
    console.log('Auto-update service initialized');
  } catch (error) {
    console.error('Failed to initialize auto-update service:', error);
  }

  // Initialize multi-context notification coordinator
  const multiContextNotificationCoordinator = getMultiContextNotificationCoordinator();
  multiContextNotificationCoordinator.initialize();
  console.log('Multi-context notification coordinator initialized');

  // Initialize thumbnail cache service
  const thumbnailCacheService = getThumbnailCacheService();
  await thumbnailCacheService.initialize();
  console.log('Thumbnail cache service initialized');
};

/**
 * Initialize headless mode - no UI, WebUI-only operation
 */
async function initializeHeadless(): Promise<void> {
  if (!headlessConfig) {
    console.error('Headless config is null');
    process.exit(1);
  }

  // Validate configuration
  const validation = validateHeadlessConfig(headlessConfig);
  if (!validation.valid) {
    console.error('[Headless] Configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  // Set headless mode flag
  setHeadlessMode(true);

  // Wait for config to be loaded
  const configManager = getConfigManager();
  await new Promise<void>((resolve) => {
    if (configManager.isConfigLoaded()) {
      resolve();
    } else {
      configManager.once('config-loaded', () => resolve());
    }
  });

  // Initialize RTSP stream service (for RTSP camera support in headless mode)
  const rtspStreamService = getRtspStreamService();
  await rtspStreamService.initialize();
  console.log('[Headless] RTSP stream service initialized');

  // Initialize headless manager
  const headlessManager = getHeadlessManager();
  await headlessManager.initialize(headlessConfig);
}

// This method will be called when Electron has finished initialization
void app.whenReady().then(async () => {
  if (headlessConfig) {
    // Headless mode - no UI
    await initializeHeadless();
  } else {
    // Standard mode with UI
    await initializeApp();

    app.on('activate', () => {
      // On macOS, re-create a window when the dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  }
}).catch(console.error);

// Quit when all windows are closed, except on macOS or headless mode
app.on('window-all-closed', () => {
  // In headless mode, no windows are created, so don't quit
  if (isHeadlessMode()) {
    return;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup when app is quitting
app.on('before-quit', async () => {
  try {
    // Stop power save blocker
    if (powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
      console.log('Power save blocker stopped');
    }
    
    // Stop polling first (multi-context mode)
    const multiContextPollingCoordinator = getMultiContextPollingCoordinator();
    multiContextPollingCoordinator.stopAllPolling();
    
    // Dispose notification system
    disposeNotificationSystem();
    console.log('Notification system disposed');
    
    // First disconnect from printer with proper logout
    const connectionManager = getPrinterConnectionManager();
    await connectionManager.disconnect();
    console.log('Printer disconnected and logged out during app close');
    
    // Shutdown camera proxy service
    const cameraProxyService = getCameraProxyService();
    await cameraProxyService.shutdown();
    console.log('Camera proxy service shut down');
    
    // Dispose camera IPC handler
    cameraIPCHandler.dispose();
    
    // Shutdown WebUI server
    const webUIManager = getWebUIManager();
    await webUIManager.dispose();
    
    // Then cleanup config manager
    const configManager = getConfigManager();
    await configManager.dispose();
  } catch (error) {
    console.error('Error during app cleanup:', error);
  }
});

