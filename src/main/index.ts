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
import './bootstrap.js';

import { app, BrowserWindow, dialog, powerSaveBlocker, ipcMain } from 'electron';
import { is } from '@electron-toolkit/utils';
import { getConfigManager } from './managers/ConfigManager.js';
import { getPrinterConnectionManager } from './managers/ConnectionFlowManager.js';
import { getPrinterBackendManager } from './managers/PrinterBackendManager.js';
import { getPrinterContextManager } from './managers/PrinterContextManager.js';
import { getWindowManager } from './windows/WindowManager.js';
import { setupWindowControlHandlers } from './ipc/WindowControlHandlers.js';
import { setupDialogHandlers } from './ipc/DialogHandlers.js';
import { registerAllIpcHandlers } from './ipc/handlers/index.js';
import { setupPrinterContextHandlers, setupConnectionStateHandlers, setupCameraContextHandlers } from './ipc/printer-context-handlers.js';
import type { PollingData, PrinterStatus } from '@shared/types/polling.js';
import type { AppConfig } from '@shared/types/config.js';
// import { getMainProcessPollingCoordinator } from './services/MainProcessPollingCoordinator';
import { getMultiContextPollingCoordinator } from './services/MultiContextPollingCoordinator.js';
import { getMultiContextPrintStateMonitor } from './services/MultiContextPrintStateMonitor.js';
import { getMultiContextNotificationCoordinator } from './services/MultiContextNotificationCoordinator.js';
import { getMultiContextTemperatureMonitor } from './services/MultiContextTemperatureMonitor.js';
import { getMultiContextSpoolmanTracker } from './services/MultiContextSpoolmanTracker.js';
import { getCameraProxyService } from './services/CameraProxyService.js';
import { getRtspStreamService } from './services/RtspStreamService.js';
import { cameraIPCHandler } from './ipc/camera-ipc-handler.js';
import { getWebUIManager } from './webui/server/WebUIManager.js';
import { getEnvironmentDetectionService } from './services/EnvironmentDetectionService.js';
import { getStaticFileManager } from './services/StaticFileManager.js';
import { initializeNotificationSystem, disposeNotificationSystem } from './services/notifications/index.js';
import { getThumbnailCacheService } from './services/ThumbnailCacheService.js';
import { injectUIStyleVariables } from './utils/CSSVariables.js';
import { getRoundedUIUnsupportedReason, isRoundedUISupported, type RoundedUIUnsupportedReason } from './utils/RoundedUICompatibility.js';
import { parseHeadlessArguments, validateHeadlessConfig } from './utils/HeadlessArguments.js';
import type { SpoolmanOfflineEvent, SpoolmanOnlineEvent } from './services/SpoolmanHealthMonitor.js';
import { setHeadlessMode, isHeadlessMode } from './utils/HeadlessDetection.js';
import { getHeadlessManager } from './managers/HeadlessManager.js';
import { getLoadingManager } from './managers/LoadingManager.js';
import { getAutoUpdateService } from './services/AutoUpdateService.js';
import { initializeSpoolmanIntegrationService, getSpoolmanIntegrationService } from './services/SpoolmanIntegrationService.js';
import type { SpoolmanIntegrationService, SpoolmanChangedEvent } from './services/SpoolmanIntegrationService.js';
import { getDiscordNotificationService } from './services/discord/index.js';
import { getSpoolmanHealthMonitor } from './services/SpoolmanHealthMonitor.js';
import { showSpoolmanOfflineDialog, hideSpoolmanOfflineDialog } from './windows/dialogs/SpoolmanOfflineDialog.js';
import type { PrinterCooledEvent } from './services/MultiContextTemperatureMonitor.js';
import type { ContextCreatedEvent, ContextRemovedEvent, ContextSwitchEvent } from '@shared/types/PrinterContext.js';

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
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return { valid: true, errors: [] };
  }

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
 * Handle Rounded UI compatibility by disabling it on unsupported platforms
 */
const handleRoundedUICompatibilityIssues = async (): Promise<void> => {
  const unsupportedReason = getRoundedUIUnsupportedReason();
  if (!unsupportedReason) {
    return;
  }

  const configManager = getConfigManager();
  const config: Readonly<AppConfig> = configManager.getConfig();

  if (!config.RoundedUI) {
    return;
  }

  console.log(`[RoundedUI] Unsupported on ${unsupportedReason} - disabling for compatibility`);
  configManager.updateConfig({ RoundedUI: false });

  const dialogCopy: Record<RoundedUIUnsupportedReason, { message: string; detail: string }> = {
    macos: {
      message: 'Rounded UI has been automatically disabled on macOS',
      detail:
        'The rounded UI feature causes window control positioning issues on macOS. It has been disabled automatically to ensure proper functionality. Please restart the application to avoid any UI inconsistencies.'
    },
    windows11: {
      message: 'Rounded UI has been automatically disabled on Windows 11',
      detail:
        'Windows 11 already applies platform-rounded window chrome that conflicts with this experimental Rounded UI mode, causing duplicate titlebars and invisible controls. It has been disabled automatically to maintain a stable experience. Please restart the application to ensure consistent window visuals.'
    }
  };

  const copy = dialogCopy[unsupportedReason];
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Rounded UI Disabled',
    message: copy.message,
    detail: copy.detail,
    buttons: ['Restart Now', 'Continue'],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    app.relaunch();
    app.exit();
  }
};

/**
 * Create the main application window with environment-aware path resolution
 */
const createMainWindow = async (): Promise<void> => {
  const windowManager = getWindowManager();
  const environmentService = getEnvironmentDetectionService();
  const staticFileManager = getStaticFileManager();
  
  // Handle rounded UI compatibility before creating windows
  await handleRoundedUICompatibilityIssues();
  
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
  const config: Readonly<AppConfig> = configManager.getConfig();
  const roundedUI = config.RoundedUI;
  const useRoundedUI = roundedUI && isRoundedUISupported();
  
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
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      console.log(`Loading web UI from dev server: ${process.env['ELECTRON_RENDERER_URL']}`);
      await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      console.log(`Loading web UI from: ${htmlPath}`);
      await mainWindow.loadFile(htmlPath);
    }
    console.log('Web UI loaded successfully');
    
    // Inject CSS variables for conditional UI styling
    injectUIStyleVariables(mainWindow);
    console.log('CSS variables injected for main window');
  } catch (error: unknown) {
    const loadError = toError(error);
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

  mainWindow.webContents.once('did-finish-load', () => {
    if (configManager.isConfigLoaded()) {
      console.log('Config already loaded - notifying renderer window');
      mainWindow.webContents.send('config-loaded');
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
/**
 * Setup Spoolman event forwarding to renderer windows
 */
const setupSpoolmanEventForwarding = (): void => {
  const spoolmanService = getSpoolmanIntegrationService();
  const windowManager = getWindowManager();

  // Forward spoolman-changed events to all renderer windows
  spoolmanService.on('spoolman-changed', (event: unknown) => {
    if (!isSpoolmanChangedEvent(event)) {
      console.warn('[Spoolman Event] Ignoring malformed spoolman payload');
      return;
    }

    const spoolmanEvent: SpoolmanChangedEvent = event;

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('spoolman:spool-updated', spoolmanEvent.spool);
    }

    const componentDialog = windowManager.getComponentDialogWindow();
    if (componentDialog && !componentDialog.isDestroyed()) {
      componentDialog.webContents.send('spoolman:spool-updated', spoolmanEvent.spool);
    }

    console.log(`[Spoolman Event] Forwarded spool update for context ${spoolmanEvent.contextId}`);
  });

  console.log('Spoolman event forwarding setup complete');
};

const setupSpoolmanHealthMonitoring = (service: SpoolmanIntegrationService): void => {
  const monitor = getSpoolmanHealthMonitor();

  monitor.removeAllListeners('offline');
  monitor.removeAllListeners('online');

  monitor.on('offline', (event: SpoolmanOfflineEvent) => {
    const reason = event?.reason || 'Unable to reach Spoolman server.';
    console.warn('[Spoolman] Connection lost:', reason);

    if (!isHeadlessMode()) {
      showSpoolmanOfflineDialog(reason);
    }
  });

  monitor.on('online', (event: SpoolmanOnlineEvent) => {
    const disabled = event?.disabled === true;
    console.log('[Spoolman] Connection restored');
    hideSpoolmanOfflineDialog();

    if (!disabled && !isHeadlessMode()) {
      const loadingManager = getLoadingManager();
      loadingManager.showSuccess('Spoolman connection restored', 3000);
    }
  });

  monitor.initialize(service);
};

const setupPrinterContextEventForwarding = (): void => {
  const contextManager = getPrinterContextManager();
  const windowManager = getWindowManager();
  const multiContextPollingCoordinator = getMultiContextPollingCoordinator();
  const backendManager = getPrinterBackendManager();

  // Forward context-created events to renderer
  contextManager.on('context-created', (event: unknown) => {
    if (!isContextCreatedEvent(event)) {
      console.warn('[Context Event] Ignoring malformed context-created payload');
      return;
    }

    const contextEvent: ContextCreatedEvent = event;
    console.log('[Context Event] Received context-created:', JSON.stringify(contextEvent, null, 2));

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
    if (!isBackendInitializedEvent(event)) {
      console.warn('[Main] Ignoring malformed backend-initialized payload');
      return;
    }

    const backendEvent: BackendInitializedEvent = event;
    const contextId = backendEvent.contextId;

    console.log(`[Main] Backend initialized for context ${contextId}`);

    // Start polling for this context
    try {
      multiContextPollingCoordinator.startPollingForContext(contextId);
      console.log(`[Main] Started polling for context ${contextId}`);

      // Get the backend and polling service from context
      const contextManager = getPrinterContextManager();
      const context = contextManager.getContext(contextId);
      const backend = getPrinterBackendManager().getBackendForContext(contextId);
      const pollingService = context?.pollingService;

      if (!backend || !pollingService) {
        console.error('[Main] Missing backend or polling service for context initialization');
        return;
      }

      // ====================================================================
      // STEP 1: Create PrintStateMonitor FIRST (foundation)
      // ====================================================================
      const printStateMonitor = getMultiContextPrintStateMonitor();
      printStateMonitor.createMonitorForContext(contextId, pollingService);
      const stateMonitor = printStateMonitor.getMonitor(contextId);

      if (!stateMonitor) {
        console.error('[Main] Failed to create print state monitor');
        return;
      }

      console.log(`[Main] Created PrintStateMonitor for context ${contextId}`);

      // ====================================================================
      // STEP 2: Create TemperatureMonitor (depends on PrintStateMonitor)
      // ====================================================================
      const tempMonitor = getMultiContextTemperatureMonitor();
      tempMonitor.createMonitorForContext(
        contextId,
        pollingService,
        stateMonitor  // Pass state monitor
      );
      const temperatureMonitor = tempMonitor.getMonitor(contextId);

      if (!temperatureMonitor) {
        console.error('[Main] Failed to create temperature monitor');
        return;
      }

      console.log(`[Main] Created TemperatureMonitor for context ${contextId}`);

      // ====================================================================
      // STEP 3: Create SpoolmanTracker (depends on PrintStateMonitor)
      // ====================================================================
      const spoolmanTracker = getMultiContextSpoolmanTracker();
      spoolmanTracker.createTrackerForContext(
        contextId,
        stateMonitor  // Pass state monitor (not temperature monitor)
      );

      console.log(`[Main] Created SpoolmanTracker for context ${contextId}`);

      // ====================================================================
      // STEP 4: Create NotificationCoordinator (depends on both monitors)
      // ====================================================================
      const notificationCoordinator = getMultiContextNotificationCoordinator();
      notificationCoordinator.createCoordinatorForContext(
        contextId,
        pollingService,
        stateMonitor  // Pass state monitor
      );

      const coordinator = notificationCoordinator.getCoordinator(contextId);
      if (coordinator) {
        // Wire temperature monitor for cooled notifications
        coordinator.setTemperatureMonitor(temperatureMonitor);
        console.log('[Main] Wired TemperatureMonitor to NotificationCoordinator');
      }

      console.log(`[Main] Created NotificationCoordinator for context ${contextId}`);

      // ====================================================================
      // STEP 5: Register context with Discord notification service and wire events
      // ====================================================================
      const discordService = getDiscordNotificationService();
      discordService.registerContext(contextId);

      // Wire Discord service to print state events for event-driven notifications
      stateMonitor.on('print-completed', (event: { contextId: string; jobName: string; status: PrinterStatus }) => {
        const duration = event.status.currentJob?.progress.elapsedTime;
        void discordService.notifyPrintComplete(event.contextId, event.jobName, duration);
      });

      // Wire printer cooled events
      if (temperatureMonitor) {
        temperatureMonitor.on('printer-cooled', (event: PrinterCooledEvent) => {
          void discordService.notifyPrinterCooled(event.contextId);
        });
      }

      // ====================================================================
      // INITIALIZATION COMPLETE
      // ====================================================================
      console.log(`[Main] Context ${contextId} fully initialized with all monitors and coordinators`);

    } catch (error: unknown) {
      const contextError = toError(error);
      console.error(`[Main] Error initializing context ${contextId}:`, contextError);
    }

    // Setup camera for this context
    void cameraIPCHandler.handlePrinterConnected(contextId);
  });

  // Forward polling data from active context to renderer
  multiContextPollingCoordinator.on('polling-data', (contextId: string, data: unknown) => {
    if (!isPollingDataPayload(data)) {
      console.warn('[Main] Received malformed polling payload');
      return;
    }

    const pollingData: PollingData = data;

    // Update Discord service with current printer status
    if (pollingData.printerStatus) {
      const discordService = getDiscordNotificationService();
      discordService.updatePrinterStatus(contextId, pollingData.printerStatus);
    }

    // Only forward polling data from the active context to avoid flooding the renderer
    const activeContextId = contextManager.getActiveContextId();
    if (contextId === activeContextId) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('polling-update', pollingData);
      }

      // Forward to component dialog window (for shortcut button components)
      const componentDialog = windowManager.getComponentDialogWindow();
      if (componentDialog && !componentDialog.isDestroyed()) {
        componentDialog.webContents.send('polling-update', pollingData);
      }

      // Forward to WebUI for WebSocket clients
      const webUIManager = getWebUIManager();
      webUIManager.handlePollingUpdate(pollingData);
    }
  });

  // Forward context-switched events
  contextManager.on('context-switched', (event: unknown) => {
    if (!isContextSwitchEventPayload(event)) {
      console.warn('[Context Event] Ignoring malformed context-switched payload');
      return;
    }

    const contextEvent: ContextSwitchEvent = event;
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('printer-context-switched', contextEvent);
      console.log(`Forwarded context-switched event: ${contextEvent.contextId}`);
    }
  });

  // Forward context-removed events
  contextManager.on('context-removed', (event: unknown) => {
    if (!isContextRemovedEventPayload(event)) {
      console.warn('[Context Event] Ignoring malformed context-removed payload');
      return;
    }

    const contextEvent: ContextRemovedEvent = event;
    const contextId = contextEvent.contextId;

    console.log(`[Main] Cleaning up context ${contextId}`);

    try {
      // Destroy in reverse order of creation
      const discordService = getDiscordNotificationService();
      discordService.unregisterContext(contextId);

      const notificationCoordinator = getMultiContextNotificationCoordinator();
      notificationCoordinator.destroyCoordinator(contextId);
      console.log(`[Main] Destroyed NotificationCoordinator for context ${contextId}`);

      const spoolmanTracker = getMultiContextSpoolmanTracker();
      spoolmanTracker.destroyTracker(contextId);
      console.log(`[Main] Destroyed SpoolmanTracker for context ${contextId}`);

      const tempMonitor = getMultiContextTemperatureMonitor();
      tempMonitor.destroyMonitor(contextId);
      console.log(`[Main] Destroyed TemperatureMonitor for context ${contextId}`);

      const printStateMonitor = getMultiContextPrintStateMonitor();
      printStateMonitor.destroyMonitor(contextId);
      console.log(`[Main] Destroyed PrintStateMonitor for context ${contextId}`);

      console.log(`[Main] Context ${contextId} cleanup complete`);

    } catch (error: unknown) {
      const cleanupError = toError(error);
      console.error(`[Main] Error cleaning up context ${contextId}:`, cleanupError);
    }

    // Forward to renderer
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('printer-context-removed', contextEvent);
      console.log(`Forwarded context-removed event: ${contextId}`);
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
    if (!isRendererBackendInitializedEvent(data)) {
      console.warn('[WebUI] Ignoring malformed backend-initialized payload');
      return;
    }

    const eventData: RendererBackendInitializedEvent = data;
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-initialized', {
        success: true,
        printerName: eventData.printerDetails?.Name || 'Unknown',
        modelType: eventData.modelType || 'unknown',
        contextId: eventData.contextId,
        serialNumber: eventData.printerDetails?.SerialNumber,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Backend initialized - polling and camera will start when context is created');

    const printerName = eventData.printerDetails?.Name || 'Unknown';
    const serialNumber = eventData.printerDetails?.SerialNumber || '';
    const contextId = eventData.contextId || '';
    const webUIEnabled = eventData.printerDetails?.webUIEnabled;

    if (contextId && serialNumber) {
      void webUIManager.startForPrinter(printerName, contextId, serialNumber, webUIEnabled);
    } else {
      console.warn('[WebUI] Missing contextId or serialNumber, cannot start WebUI for this printer');
    }
  });
  
  connectionManager.on('backend-initialization-failed', (data: unknown) => {
    if (!isBackendInitializationFailedEvent(data)) {
      console.warn('[WebUI] Ignoring malformed backend-initialization-failed payload');
      return;
    }

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const eventData = data;
      mainWindow.webContents.send('backend-initialization-failed', {
        success: false,
        error: eventData.error || 'Unknown error',
        printerName: eventData.printerDetails?.Name || 'Unknown',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  connectionManager.on('backend-disposed', (data: unknown) => {
    if (!isBackendDisposedEvent(data)) {
      console.warn('[WebUI] Ignoring malformed backend-disposed payload');
      return;
    }

    console.log('Backend disposed');

    const eventData = data;

    if (eventData.contextId) {
      void webUIManager.stopForPrinter(eventData.contextId);
    } else {
      console.warn('[WebUI] backend-disposed event missing contextId');
    }

    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend-disposed', {
        contextId: eventData.contextId,
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
  } catch (error: unknown) {
    const autoConnectError = toError(error);
    console.error('Auto-connect error:', autoConnectError);
  }
};

/**
 * Broadcast config-loaded event to all active renderer windows
 */
const broadcastConfigLoadedEvent = (): void => {
  const windowManager = getWindowManager();
  const windows = windowManager.getActiveWindows();

  windows.forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('config-loaded');
    }
  });

  if (windows.length === 0) {
    console.log('[Config] No renderer windows available to receive config-loaded event');
  } else {
    console.log(`[Config] Broadcasted config-loaded event to ${windows.length} window(s)`);
  }
};

/**
 * Forward ConfigManager config-loaded events to renderer windows
 */
const setupConfigLoadedForwarding = (): void => {
  const configManager = getConfigManager();
  configManager.on('config-loaded', () => {
    console.log('[Config] Config loaded - forwarding to renderer windows');
    broadcastConfigLoadedEvent();
  });
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
      broadcastConfigLoadedEvent();
      void performAutoConnect();
    } else {
      console.log('Config not yet loaded - waiting for config-loaded event');
      configManager.once('config-loaded', () => {
        console.log('Config loaded - starting auto-connect');
        broadcastConfigLoadedEvent();
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
  setupConfigLoadedForwarding();
  console.log('Config-loaded forwarding initialized');
  
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

  // Initialize Spoolman integration service (after window creation to avoid timing issues)
  const spoolmanService = initializeSpoolmanIntegrationService(
    getConfigManager(),
    getPrinterContextManager(),
    getPrinterBackendManager()
  );
  console.log('Spoolman integration service initialized');
  setupSpoolmanHealthMonitoring(spoolmanService);
  
  // Continue with remaining initialization
  setupWindowControlHandlers();
  
  // Setup event forwarding
  setupConnectionEventForwarding();
  setupPrinterContextEventForwarding();
  setupSpoolmanEventForwarding();

  // Initialize camera service
  await initializeCameraService();

  // Initialize RTSP stream service (for RTSP camera support)
  // This must be initialized unconditionally, not just when WebUI is enabled
  const rtspStreamService = getRtspStreamService();
  await rtspStreamService.initialize();
  console.log('RTSP stream service initialized');

  // Note: WebUI server initialization moved to non-blocking context
  // (will be initialized after renderer-ready signal to prevent startup crashes)

  // Initialize temperature monitoring system
  const multiContextTempMonitor = getMultiContextTemperatureMonitor();
  multiContextTempMonitor.initialize();
  console.log('Multi-context temperature monitor initialized');

  // Initialize Spoolman usage tracking
  const multiContextSpoolmanTracker = getMultiContextSpoolmanTracker();
  multiContextSpoolmanTracker.initialize();
  console.log('Multi-context Spoolman tracker initialized');

  // Initialize notification system (base system only, per-context coordinators created when polling starts)
  initializeNotificationSystem();
  console.log('Notification system initialized');

  try {
    const autoUpdateService = getAutoUpdateService();
    await autoUpdateService.initialize();
    console.log('Auto-update service initialized');
  } catch (error: unknown) {
    const autoUpdateError = toError(error);
    console.error('Failed to initialize auto-update service:', autoUpdateError);
  }

  // Initialize multi-context notification coordinator
  const multiContextNotificationCoordinator = getMultiContextNotificationCoordinator();
  multiContextNotificationCoordinator.initialize();
  console.log('Multi-context notification coordinator initialized');

  // Initialize Discord notification service
  const discordService = getDiscordNotificationService();
  discordService.initialize();

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

  // Initialize Spoolman integration service
  const headlessSpoolmanService = initializeSpoolmanIntegrationService(
    getConfigManager(),
    getPrinterContextManager(),
    getPrinterBackendManager()
  );
  console.log('[Headless] Spoolman integration service initialized');
  setupSpoolmanHealthMonitoring(headlessSpoolmanService);

  // Initialize temperature monitoring system
  const multiContextTempMonitor = getMultiContextTemperatureMonitor();
  multiContextTempMonitor.initialize();
  console.log('[Headless] Multi-context temperature monitor initialized');

  // Initialize Spoolman usage tracking
  const multiContextSpoolmanTracker = getMultiContextSpoolmanTracker();
  multiContextSpoolmanTracker.initialize();
  console.log('[Headless] Multi-context Spoolman tracker initialized');

  // Initialize notification system (now runs in headless too - platform detection handles compatibility)
  initializeNotificationSystem();
  console.log('[Headless] Notification system initialized');

  // Initialize multi-context notification coordinator (now runs in headless too)
  const multiContextNotificationCoordinator = getMultiContextNotificationCoordinator();
  multiContextNotificationCoordinator.initialize();
  console.log('[Headless] Multi-context notification coordinator initialized');

  // Initialize Discord notification service
  const discordService = getDiscordNotificationService();
  discordService.initialize();

  // Initialize headless manager
  const headlessManager = getHeadlessManager();
  await headlessManager.initialize(headlessConfig);
}

type PrinterDetailsSnapshot = {
  Name?: string;
  IPAddress?: string;
  SerialNumber?: string;
  ClientType?: string;
  printerModel?: string;
  webUIEnabled?: boolean;
};

type BackendInitializedEvent = {
  contextId: string;
  modelType?: string;
};

type RendererBackendInitializedEvent = {
  contextId?: string;
  modelType?: string;
  printerDetails?: PrinterDetailsSnapshot;
};

type BackendInitializationFailedEvent = {
  error?: string;
  printerDetails?: { Name?: string };
};

type BackendDisposedEvent = {
  contextId?: string;
};

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrinterDetailsSnapshot(value: unknown): value is PrinterDetailsSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const optionalStrings: Array<keyof PrinterDetailsSnapshot> = ['Name', 'IPAddress', 'SerialNumber', 'ClientType', 'printerModel'];
  return optionalStrings.every((key) => {
    const property = value[key];
    return property === undefined || typeof property === 'string';
  }) && (value.webUIEnabled === undefined || typeof value.webUIEnabled === 'boolean');
}

function isActiveSpoolData(value: unknown): value is NonNullable<SpoolmanChangedEvent['spool']> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    (typeof value.vendor === 'string' || value.vendor === null || value.vendor === undefined) &&
    (typeof value.material === 'string' || value.material === null || value.material === undefined) &&
    typeof value.colorHex === 'string' &&
    typeof value.remainingWeight === 'number' &&
    typeof value.remainingLength === 'number' &&
    typeof value.lastUpdated === 'string'
  );
}

function isSpoolmanChangedEvent(value: unknown): value is SpoolmanChangedEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.contextId !== 'string') {
    return false;
  }

  if (!('spool' in value)) {
    return false;
  }

  const spool = value.spool as unknown;
  return spool === null || isActiveSpoolData(spool);
}

function hasContextInfo(value: Record<string, unknown>): boolean {
  if (!('contextInfo' in value)) {
    return false;
  }
  const info = value.contextInfo as unknown;
  return isRecord(info);
}

function isContextCreatedEvent(value: unknown): value is ContextCreatedEvent {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.contextId === 'string' && hasContextInfo(value);
}

function isContextSwitchEventPayload(value: unknown): value is ContextSwitchEvent {
  if (!isRecord(value)) {
    return false;
  }

  const previous = value.previousContextId;
  return (
    typeof value.contextId === 'string' &&
    (previous === null || typeof previous === 'string') &&
    hasContextInfo(value)
  );
}

function isContextRemovedEventPayload(value: unknown): value is ContextRemovedEvent {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.contextId === 'string' && typeof value.wasActive === 'boolean';
}

function isBackendInitializedEvent(value: unknown): value is BackendInitializedEvent {
  if (!isRecord(value) || typeof value.contextId !== 'string') {
    return false;
  }

  return value.modelType === undefined || typeof value.modelType === 'string';
}

function isRendererBackendInitializedEvent(value: unknown): value is RendererBackendInitializedEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (value.contextId !== undefined && typeof value.contextId !== 'string') {
    return false;
  }

  if (value.modelType !== undefined && typeof value.modelType !== 'string') {
    return false;
  }

  if (value.printerDetails !== undefined && !isPrinterDetailsSnapshot(value.printerDetails)) {
    return false;
  }

  return true;
}

function isBackendInitializationFailedEvent(value: unknown): value is BackendInitializationFailedEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (value.error !== undefined && typeof value.error !== 'string') {
    return false;
  }

  if (value.printerDetails !== undefined) {
    const details = value.printerDetails;
    if (!isRecord(details)) {
      return false;
    }
    if (details.Name !== undefined && typeof details.Name !== 'string') {
      return false;
    }
  }

  return true;
}

function isBackendDisposedEvent(value: unknown): value is BackendDisposedEvent {
  if (!isRecord(value)) {
    return false;
  }

  return value.contextId === undefined || typeof value.contextId === 'string';
}

function isPollingDataPayload(value: unknown): value is PollingData {
  if (!isRecord(value)) {
    return false;
  }

  const lastPolled = value.lastPolled;
  return (
    typeof value.isConnected === 'boolean' &&
    typeof value.isInitializing === 'boolean' &&
    lastPolled instanceof Date
  );
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
  } catch (error: unknown) {
    const cleanupError = toError(error);
    console.error('Error during app cleanup:', cleanupError);
  }
});

