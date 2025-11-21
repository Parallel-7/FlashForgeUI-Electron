/**
 * @fileoverview Central WebUI server coordinator managing Express HTTP server and WebSocket lifecycle.
 *
 * Provides comprehensive management of the WebUI server including Express HTTP server initialization,
 * static file serving, middleware configuration, API route registration, WebSocket server setup,
 * and integration with printer backend services. Automatically starts when a printer connects
 * (if enabled in settings) and stops on disconnect. Handles administrator privilege requirements
 * on Windows platforms, network interface detection for LAN access, and configuration changes
 * for dynamic server restart. Coordinates between HTTP API routes, WebSocket real-time updates,
 * and polling data from the main process to provide seamless remote printer control and monitoring.
 *
 * Key exports:
 * - WebUIManager class: Main server coordinator with singleton pattern
 * - getWebUIManager(): Singleton accessor function
 * - Lifecycle: start, stop, initialize, startForPrinter, stopForPrinter
 * - Status: getStatus, isServerRunning, getExpressApp, getHttpServer
 * - Integration: handlePollingUpdate (receives status from main process)
 * - Events: 'server-started', 'server-stopped', 'printer-connected', 'printer-disconnected'
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import express from 'express';
import * as os from 'os';
import { app, dialog, BrowserWindow } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { getEnvironmentDetectionService } from '../../services/EnvironmentDetectionService';

import { AppError, ErrorCode } from '../../utils/error.utils';
import { getAuthManager } from './AuthManager';
import {
  createAuthMiddleware,
  createErrorMiddleware,
  createRequestLogger,
  createLoginRateLimiter,
  AuthenticatedRequest
} from './auth-middleware';
import { 
  WebUILoginRequestSchema
} from '../schemas/web-api.schemas';
import { StandardAPIResponse } from '../types/web-api.types';
import { createAPIRoutes, buildRouteDependencies } from './api-routes';
import { getWebSocketManager } from './WebSocketManager';
import { getRtspStreamService } from '../../services/RtspStreamService';
import type { PollingData } from '../../types/polling';
import { isHeadlessMode } from '../../utils/HeadlessDetection';
import type { WebUILoginResponse } from '../types/web-api.types';
import { registerPublicThemeRoutes } from './routes/theme-routes';

/**
 * Branded type for WebUIManager singleton
 */
type WebUIManagerBrand = { readonly __brand: 'WebUIManager' };
type WebUIManagerInstance = WebUIManager & WebUIManagerBrand;

/**
 * Server status information
 */
export interface WebUIServerStatus {
  readonly isRunning: boolean;
  readonly serverIP: string;
  readonly port: number;
  readonly url: string;
  readonly clientCount: number;
  readonly webUIEnabled: boolean;
}

/**
 * WebUI server options
 */
interface WebUIServerOptions {
  readonly port: number;
  readonly password: string;
  readonly enabled: boolean;
}

/**
 * WebUI Manager - Handles web server lifecycle and coordination
 */
export class WebUIManager extends EventEmitter {
  private static instance: WebUIManagerInstance | null = null;
  
  // Manager dependencies
  private readonly configManager = getConfigManager();
  private readonly connectionManager = getPrinterConnectionManager();
  private readonly backendManager = getPrinterBackendManager();
  private readonly authManager = getAuthManager();
  private readonly environmentService = getEnvironmentDetectionService();
  
  // Server components (will be initialized later)
  private expressApp: express.Application | null = null;
  private httpServer: http.Server | null = null;
  
  // Server state
  private isRunning: boolean = false;
  private serverIP: string = 'localhost';
  private port: number = 3000;
  
  // Client tracking
  private connectedClients: number = 0;
  // Track which contexts have WebUI enabled
  private readonly registeredContexts: Set<string> = new Set();
  private readonly contextSerialNumbers: Map<string, string> = new Map();
  
  // WebSocket manager
  private readonly webSocketManager = getWebSocketManager();

  // RTSP stream service for RTSP camera streaming
  private readonly rtspStreamService = getRtspStreamService();
  
  private constructor() {
    super();
    this.setupEventHandlers();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): WebUIManagerInstance {
    if (!WebUIManager.instance) {
      WebUIManager.instance = new WebUIManager() as WebUIManagerInstance;
    }
    return WebUIManager.instance;
  }
  
  /**
   * Setup event handlers for configuration and connection changes
   */
  private setupEventHandlers(): void {
    // Monitor configuration changes
    this.configManager.on('configUpdated', (event: { changedKeys: readonly string[] }) => {
      const webUIKeys = ['WebUIEnabled', 'WebUIPort', 'WebUIPassword', 'WebUIPasswordRequired'];
      const hasWebUIChanges = event.changedKeys.some((key: string) => webUIKeys.includes(key));
      
      if (hasWebUIChanges) {
        void this.handleConfigurationChange();
      }
    });
    
    // Monitor printer connection status
    this.connectionManager.on('connected', () => {
      this.emit('printer-connected');
      // Web UI no longer controls polling - it just receives updates
    });
    
    this.connectionManager.on('disconnected', () => {
      this.emit('printer-disconnected');
      // Web UI no longer controls polling
    });
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    if (!this.expressApp) return;

    // Request logging
    this.expressApp.use(createRequestLogger());

    // JSON body parsing
    this.expressApp.use(express.json());
    
    // Static file serving - use environment-aware path resolution
    const webUIStaticPath = this.environmentService.getWebUIStaticPath();
    console.log(`WebUI serving static files from: ${webUIStaticPath}`);
    
    try {
      this.expressApp.use(express.static(webUIStaticPath));
      console.log('WebUI static file middleware configured successfully');
    } catch (error) {
      console.error('Failed to configure WebUI static file serving:', error);
      console.error(`Attempted path: ${webUIStaticPath}`);
      throw new AppError(
        `Failed to configure WebUI static file serving from path: ${webUIStaticPath}`,
        ErrorCode.CONFIG_INVALID,
        { webUIStaticPath },
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    if (!this.expressApp) return;

    // Authentication routes (no auth required)
    this.setupAuthRoutes();

    const routeDependencies = buildRouteDependencies();

    // Public routes that should be available without authentication (e.g., theme defaults)
    registerPublicThemeRoutes(this.expressApp, routeDependencies);

    // Protected API routes (WebUI auth required)
    this.expressApp.use('/api', createAuthMiddleware());

    // Import and use API routes
    const apiRoutes = createAPIRoutes(routeDependencies);
    this.expressApp.use('/api', apiRoutes);

    // Error handling (must be last)
    this.expressApp.use(createErrorMiddleware());
  }
  
  /**
   * Setup authentication routes
   */
  private setupAuthRoutes(): void {
    if (!this.expressApp) return;
    
    // Login endpoint with rate limiting
    this.expressApp.post('/api/auth/login', createLoginRateLimiter(), (req, res) => {
      if (!this.authManager.isAuthenticationRequired()) {
        const response: WebUILoginResponse = {
          success: true,
          message: 'Authentication not required'
        };
        res.json(response);
        return;
      }

      const validation = WebUILoginRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        const response: StandardAPIResponse = {
          success: false,
          error: validation.error.issues[0]?.message || 'Invalid request'
        };
        res.status(400).json(response);
        return;
      }
      
      void this.authManager.validateLogin(validation.data).then(result => {
        if (result.success) {
          res.json(result);
        } else {
          res.status(401).json(result);
        }
      });
    });
    
    // Auth status endpoint (no auth required)
    this.expressApp.get('/api/auth/status', (req, res) => {
      res.json(this.authManager.getAuthStatus());
    });
    
    // Logout endpoint (optional auth)
    this.expressApp.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
      if (req.auth?.token) {
        this.authManager.revokeToken(req.auth.token);
      }
      
      const response: StandardAPIResponse = {
        success: true,
        message: 'Logged out successfully'
      };
      res.json(response);
    });
  }
  
  /**
   * Handle configuration changes
   */
  private async handleConfigurationChange(): Promise<void> {
    const config = this.configManager.getConfig();
    const options: WebUIServerOptions = {
      port: config.WebUIPort,
      password: config.WebUIPassword,
      enabled: config.WebUIEnabled
    };
    
    // If server should be running but isn't, start it
    if (options.enabled && !this.isRunning) {
      await this.start();
      return;
    }
    
    // If server shouldn't be running but is, stop it (unless contexts still require it)
    if (!options.enabled && this.isRunning) {
      if (this.registeredContexts.size === 0) {
        await this.stop();
      } else {
        console.log('[WebUIManager] WebUI disabled globally but contexts still registered - waiting for disconnect');
      }
      return;
    }
    
    // If port changed, restart server
    if (this.isRunning && options.port !== this.port) {
      console.log('WebUI port changed, restarting server...');
      await this.stop();
      await this.start();
    }
  }
  
  /**
   * Initialize and start the web UI server
   */
  public async start(): Promise<boolean> {
    // Prevent concurrent calls
    if (this.isRunning) {
      console.log('WebUI server is already running');
      return true;
    }
    
    try {
      const config = this.configManager.getConfig();
      
      // Check if WebUI is enabled
      if (!config.WebUIEnabled) {
        console.log('WebUI is disabled in configuration');
        return false;
      }
      
      // Check admin privileges on Windows
      const environmentService = getEnvironmentDetectionService();
      if (process.platform === 'win32' && !environmentService.isRunningAsAdmin()) {
        console.log('WebUI requires administrator privileges on Windows');

        if (isHeadlessMode()) {
          // In headless mode, log error and exit immediately without dialog
          console.error('[Headless] ERROR: Administrator privileges required for WebUI on Windows');
          console.error('[Headless] Please restart the application as an administrator');
          process.exit(1);
        }

        // Show dialog to user in normal mode
        await dialog.showMessageBox({
          type: 'error',
          title: 'Administrator Privileges Required',
          message: 'Web UI Access Requires Administrator Privileges',
          detail: 'The Web UI feature requires administrator privileges to bind to network ports on Windows.\n\nPlease restart the application as an administrator to use the Web UI feature.',
          buttons: ['OK'],
          defaultId: 0
        });

        // Exit the application after user clicks OK
        console.log('Exiting application due to insufficient privileges for Web UI');
        app.quit();
        return false;
      }
      
      // Initialize Express application
      this.expressApp = express();
      this.port = config.WebUIPort;

      // Note: RTSP stream service is now initialized globally in index.ts
      // No need for conditional initialization here

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();

      // Determine server IP
      this.serverIP = await this.determineServerIP();

      // Create HTTP server
      this.httpServer = http.createServer(this.expressApp!);

      // Initialize WebSocket server
      this.webSocketManager.initialize(this.httpServer);
      
      // Start listening
      await this.startListening();
      
      this.isRunning = true;
      
      const serverUrl = `http://${this.serverIP}:${this.port}`;
      
      console.log(`WebUI server running at ${serverUrl}`);
      this.emit('server-started', { url: serverUrl, port: this.port });
      
      return true;
      
    } catch (error) {
      console.error('Failed to start WebUI server:', error);
      return false;
    }
  }
  
  /**
   * Stop the web UI server
   */
  public async stop(): Promise<boolean> {
    try {
      
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => {
            console.log('WebUI server stopped');
            resolve();
          });
        });
        
        this.httpServer = null;
        }
        
        // Shutdown WebSocket server
        this.webSocketManager.shutdown();
        
    this.expressApp = null;
    this.isRunning = false;
    this.connectedClients = 0;
      
      this.emit('server-stopped');
      
      return true;
      
    } catch (error) {
      console.error('Error stopping WebUI server:', error);
      return false;
    }
  }
  
  /**
   * Start listening on configured port
   */
  private startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        reject(new Error('HTTP server not initialized'));
        return;
      }
      
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${this.port} is already in use`);
          reject(new AppError(
            `Port ${this.port} is already in use. Please choose a different port in settings.`,
            ErrorCode.NETWORK,
            { port: this.port }
          ));
        } else if (err.code === 'EACCES') {
          console.error(`Access denied to port ${this.port}`);
          reject(new AppError(
            `Access denied to port ${this.port}. Try a port number above 1024.`,
            ErrorCode.NETWORK,
            { port: this.port }
          ));
        } else {
          reject(err);
        }
      };
      
      this.httpServer.once('error', onError);
      
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        this.httpServer!.removeListener('error', onError);
        resolve();
      });
    });
  }
  
  /**
   * Determine the best IP address for the server
   */
  private async determineServerIP(): Promise<string> {
    try {
      const networkInterfaces = os.networkInterfaces();
      let bestIP = 'localhost';
      
      // Look for the best IP address (prefer 192.168.x.x for home networks)
      for (const name in networkInterfaces) {
        const interfaces = networkInterfaces[name];
        if (!interfaces) continue;
        
        for (const iface of interfaces) {
          if (!iface.internal && iface.family === 'IPv4') {
            if (iface.address.startsWith('192.168.')) {
              // Home network, preferred
              return iface.address;
            } else if (bestIP === 'localhost') {
              // Use any non-internal IPv4 as fallback
              bestIP = iface.address;
            }
          }
        }
      }
      
      return bestIP;
      
    } catch (error) {
      console.error('Error determining server IP:', error);
      return 'localhost';
    }
  }
  

  
  /**
   * Get Express app instance for route registration
   */
  public getExpressApp(): express.Application | null {
    return this.expressApp;
  }
  
  /**
   * Get HTTP server instance for WebSocket attachment
   */
  public getHttpServer(): http.Server | null {
    return this.httpServer;
  }
  
  /**
   * Update connected client count
   */
  public updateClientCount(count: number): void {
    this.connectedClients = count;
    console.log(`WebUI client count updated: ${count}`);
  }
  
  /**
   * Get server status
   */
  public getStatus(): WebUIServerStatus {
    return {
      isRunning: this.isRunning,
      serverIP: this.serverIP,
      port: this.port,
      url: `http://${this.serverIP}:${this.port}`,
      clientCount: this.connectedClients,
      webUIEnabled: this.configManager.get('WebUIEnabled')
    };
  }
  
  /**
   * Check if server is running
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * Receive polling update from external source (main process)
   * This is the primary way Web UI receives printer status updates
   */
  public handlePollingUpdate(data: PollingData): void {
    console.log('[WebUIManager] handlePollingUpdate called, hasStatus:', !!data.printerStatus, 'wsManager:', !!this.webSocketManager);

    // Always forward to WebSocket manager to update latest polling data so renderer
    // consumers and remote clients can receive up-to-date printer status, even if
    // no live WebSocket connections are currently established.
    if (data.printerStatus) {
      console.log('[WebUIManager] Calling webSocketManager.broadcastPrinterStatus...');
      this.webSocketManager.broadcastPrinterStatus(data).catch(error => {
        console.error('[WebUIManager] Error broadcasting printer status:', error);
      });
    } else {
      console.log('[WebUIManager] No printer status in data, skipping broadcast');
    }
  }
  
  /**
   * Initialize the WebUI server on application startup
   */
  public async initialize(): Promise<void> {
    const config = this.configManager.getConfig();
    
    if (config.WebUIEnabled) {
      console.log('WebUI enabled in configuration, will start when printer connects');
    } else {
      console.log('WebUI disabled in configuration');
    }
  }
  
  /**
   * Start WebUI server when printer connects
   * Registers the context and respects per-printer enablement
   */
  public async startForPrinter(
    printerName: string,
    contextId: string,
    serialNumber: string,
    webUIEnabled?: boolean
  ): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.WebUIEnabled) {
        this.logToUI('WebUI server disabled in settings - enable in preferences to use remote access');
        return;
      }

      const isPrinterEnabled = webUIEnabled ?? true;
      if (!isPrinterEnabled) {
        this.logToUI(`WebUI disabled for ${printerName} - enable in printer settings to use remote access`);
        return;
      }

      this.registeredContexts.add(contextId);
      this.contextSerialNumbers.set(contextId, serialNumber);
      console.log(`[WebUIManager] Registered context ${contextId} for printer ${serialNumber || 'unknown'}`);

      if (!this.isRunning) {
        this.logToUI(`Starting WebUI server for ${printerName}...`);
        const success = await this.start();

        if (success) {
          this.logToUI('WebUI server started successfully - remote access now available');
        } else {
          this.registeredContexts.delete(contextId);
          this.contextSerialNumbers.delete(contextId);
          this.logToUI('WebUI server failed to start - technical error occurred');
          this.logToUI('Check that the configured port is available and restart as administrator if needed');
        }
      } else {
        this.logToUI(`WebUI server already running - ${printerName} now accessible`);
      }
    } catch (error) {
      this.registeredContexts.delete(contextId);
      this.contextSerialNumbers.delete(contextId);
      console.error('WebUI server startup error:', error);
      await this.handleStartupError(error);
    }
  }
  
  /**
   * Stop WebUI server for a context when printer disconnects
   * Only stops the server if no registered contexts remain
   */
  public async stopForPrinter(contextId: string): Promise<void> {
    try {
      const serialNumber = this.contextSerialNumbers.get(contextId);
      this.registeredContexts.delete(contextId);
      this.contextSerialNumbers.delete(contextId);

      const printerLabel = serialNumber ? `printer ${serialNumber}` : 'printer';
      console.log(`[WebUIManager] Unregistered context ${contextId} (${printerLabel})`);

      if (this.registeredContexts.size === 0) {
        if (this.isRunning) {
          this.logToUI('Stopping WebUI server - no printers with WebUI enabled connected');
          await this.stop();
          this.logToUI('WebUI server stopped');
        }
      } else {
        console.log(`[WebUIManager] Server still required by ${this.registeredContexts.size} context(s)`);
      }
    } catch (error) {
      console.error('Error during WebUI context cleanup:', error);
    }
  }
  
  /**
   * Send message to UI log panel
   */
  private logToUI(message: string): void {
    // Skip UI logging in headless mode
    if (isHeadlessMode()) {
      // Just log to console in headless mode
      console.log(`[WebUI] ${message}`);
      return;
    }

    // Use proper import instead of require to avoid TypeScript warnings
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('log-message', message);
      }
    });

    // Also log to console for development
    console.log(`[WebUI] ${message}`);
  }
  
  /**
   * Handle WebUI startup errors
   */
  private async handleStartupError(error: unknown): Promise<void> {
    const { app, dialog } = await import('electron');
    const { AppError, ErrorCode } = await import('../../utils/error.utils');
    
    // Convert to AppError for consistent handling
    const appError = error instanceof AppError ? error : new AppError(
      error instanceof Error ? error.message : String(error),
      ErrorCode.NETWORK
    );
    
    // Log error to UI where users can see it
    this.logToUI(`WebUI startup failed: ${appError.message}`);
    this.logToUI('WebUI requires administrator privileges to bind to network ports');
    
    // Show simple admin privilege dialog
    await dialog.showMessageBox({
      type: 'error',
      title: 'Administrator Privileges Required',
      message: 'WebUI feature requires Administrator privileges',
      detail: 'The WebUI feature requires administrator privileges to bind to network ports.\n\nPlease restart this application as an administrator to use the WebUI feature.',
      buttons: ['Close Application'],
      defaultId: 0
    });
    
    // Exit the application after user acknowledges
    this.logToUI('Application closing - restart as administrator to enable WebUI');
    app.quit();
  }
  
  /**
   * Cleanup and dispose
   */
  public async dispose(): Promise<void> {
    await this.stop();
    this.authManager.dispose();
    this.webSocketManager.dispose();
    this.registeredContexts.clear();
    this.contextSerialNumbers.clear();
    this.removeAllListeners();
    WebUIManager.instance = null;
  }
}

/**
 * Get singleton instance of WebUIManager
 */
export function getWebUIManager(): WebUIManagerInstance {
  return WebUIManager.getInstance();
}

