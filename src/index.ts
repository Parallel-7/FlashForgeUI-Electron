/**
 * Main Electron process entry point with modular architecture.
 * Initializes the application, creates windows, and coordinates all system components.
 * Uses environment-aware path resolution and comprehensive error handling for reliable
 * web UI loading across development and production environments.
 */

import { app, BrowserWindow, dialog, powerSaveBlocker, ipcMain } from 'electron';
import { getConfigManager } from './managers/ConfigManager';
import { getPrinterConnectionManager } from './managers/ConnectionFlowManager';
import { getPrinterBackendManager } from './managers/PrinterBackendManager';
import { getWindowManager } from './windows/WindowManager';
import { setupWindowControlHandlers } from './ipc/WindowControlHandlers';
import { setupDialogHandlers } from './ipc/DialogHandlers';
import { registerAllIpcHandlers } from './ipc/handlers';
import { getMainProcessPollingCoordinator } from './services/MainProcessPollingCoordinator';
import { cameraProxyService } from './services/CameraProxyService';
import { cameraIPCHandler } from './ipc/camera-ipc-handler';
import { getWebUIManager } from './webui/server/WebUIManager';
import { getEnvironmentDetectionService } from './services/EnvironmentDetectionService';
import { getStaticFileManager } from './services/StaticFileManager';
import { initializeNotificationSystem, disposeNotificationSystem } from './services/notifications';
import { getThumbnailCacheService } from './services/ThumbnailCacheService';
import { getUIWindowOptions, injectUIStyleVariables } from './utils/CSSVariables';

/**
 * Main Electron process entry point. Handles app lifecycle, creates the main window,
 * and coordinates all system components. The heavy lifting is delegated to
 * specialized modules for better maintainability.
 */

// Note: This project uses NSIS installer, not Squirrel
// NSIS handles shortcuts and installation events automatically


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

// Set platform-specific settings
if (process.platform === 'win32') {
  app.setAppUserModelId(app.name);
}

// Ensure app uses the correct name for userData directory
// This must be set before any services that use app.getPath('userData') are initialized
app.setName('FlashForgeUI');

// Prevent app from being throttled in background
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Initialize global reference for camera IPC handler
global.printerBackendManager = undefined;

// Power save blocker to prevent OS throttling
let powerSaveBlockerId: number | null = null;

/**
 * Initialize the camera proxy service
 */
const initializeCameraService = async (): Promise<void> => {
  try {
    const configManager = getConfigManager();
    const cameraProxyPort = configManager.get('CameraProxyPort') || 8181;
    
    await cameraProxyService.initialize({
      port: cameraProxyPort,
      fallbackPort: cameraProxyPort + 1,
      autoStart: true,
      reconnection: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 2000,
        exponentialBackoff: true
      }
    });
    
    console.log('Camera proxy service initialized');
  } catch (error) {
    console.error('Failed to initialize camera proxy service:', error);
  }
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
      offscreen: false, // Prevent offscreen rendering throttling
      webSecurity: true, // Security
      allowRunningInsecureContent: false, // Security
    },
    frame: false, // Always frameless for custom titlebar
    transparent: useRoundedUI, // Only transparent when rounded UI is enabled
    titleBarStyle: 'hidden',
    show: false, // Don't show until ready
  });

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

  // Show window when ready to prevent visual flash
  // Use emergency timeout as fallback for slower machines
  let windowShown = false;
  
  const showWindow = () => {
    if (!windowShown && !mainWindow.isDestroyed()) {
      windowShown = true;
      mainWindow.show();
      console.log('Main window shown');
      
      // Start power save blocker to prevent OS throttling
      if (powerSaveBlockerId === null) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        console.log('Power save blocker started to prevent app suspension');
      }
    }
  };
  
  mainWindow.once('ready-to-show', () => {
    console.log('ready-to-show event fired');
    showWindow();
  });
  
  // Emergency timeout fallback for slower machines where ready-to-show may not fire
  setTimeout(() => {
    if (!windowShown) {
      console.log('Emergency timeout: showing window (ready-to-show did not fire)');
      showWindow();
    }
  }, 3000); // 3 second timeout
  


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
const setupConnectionEventForwarding = (): void => {
  const connectionManager = getPrinterConnectionManager();
  const windowManager = getWindowManager();
  const backendManager = getPrinterBackendManager();
  const pollingCoordinator = getMainProcessPollingCoordinator();
  const webUIManager = getWebUIManager();
  
  // Set global reference for camera IPC handler
  global.printerBackendManager = backendManager;
  
  // Stop polling BEFORE disconnect to prevent commands during logout
  connectionManager.on('pre-disconnect', () => {
    console.log('Pre-disconnect event - stopping polling service');
    pollingCoordinator.stopPolling();
    
    // Also handle camera disconnection
    cameraIPCHandler.handlePrinterDisconnected();
  });
  
  // Backend initialization starts polling
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
      
      // Set up camera for the connected printer
      void cameraIPCHandler.handlePrinterConnected(eventData.printerDetails?.IPAddress);
    }
    
    // Start polling after backend is ready
    console.log('Backend initialized, starting main process polling');
    pollingCoordinator.startPolling();
    
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
    // Stop polling when backend is disposed
    console.log('Backend disposed, stopping polling');
    pollingCoordinator.stopPolling();
    
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
  // Listen for renderer-ready signal before attempting services initialization
  ipcMain.handle('renderer-ready', async () => {
    console.log('Renderer ready signal received - starting auto-connect');
    
    // Small delay to ensure all IPC handlers are fully registered
    setTimeout(() => {
      void performAutoConnect();
      // Note: WebUI initialization moved to printer connection event
    }, 50);
    
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
  
  // Setup legacy dialog handlers (printer selection enhancement, loading overlay)
  setupDialogHandlers();
  
  // NOW create the window - renderer will find handlers already registered
  await createMainWindow();
  console.log('Main window created with all handlers ready');
  
  // Continue with remaining initialization
  setupWindowControlHandlers();
  
  // Setup event forwarding
  setupConnectionEventForwarding();
  
  // Initialize camera service and IPC handlers
  await initializeCameraService();
  cameraIPCHandler.initialize();
  
  // Note: WebUI server initialization moved to non-blocking context
  // (will be initialized after renderer-ready signal to prevent startup crashes)
  
  // Initialize notification system (polling integration will be done separately)
  initializeNotificationSystem();
  console.log('Notification system initialized');
  
  // Initialize thumbnail cache service
  const thumbnailCacheService = getThumbnailCacheService();
  await thumbnailCacheService.initialize();
  console.log('Thumbnail cache service initialized');
};

// This method will be called when Electron has finished initialization
void app.whenReady().then(async () => {
  await initializeApp();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}).catch(console.error);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
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
    
    // Stop polling first
    const pollingCoordinator = getMainProcessPollingCoordinator();
    pollingCoordinator.stopPolling();
    
    // Dispose notification system
    disposeNotificationSystem();
    console.log('Notification system disposed');
    
    // First disconnect from printer with proper logout
    const connectionManager = getPrinterConnectionManager();
    await connectionManager.disconnect();
    console.log('Printer disconnected and logged out during app close');
    
    // Shutdown camera proxy service
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
