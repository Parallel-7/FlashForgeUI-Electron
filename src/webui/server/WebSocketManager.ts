/**
 * WebSocketManager - Handles real-time bidirectional communication for the web UI.
 * Manages WebSocket connections, authentication, and message broadcasting.
 * Integrates with WebUIManager to receive printer status updates and forward them to clients.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import * as http from 'http';
import { EventEmitter } from 'events';
import { getAuthManager } from './AuthManager';
import { getWebUIManager } from './WebUIManager';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { AppError, toAppError, ErrorCode } from '../../utils/error.utils';
import { 
  WebSocketCommandSchema,
  createValidationError
} from '../schemas/web-api.schemas';
import {
  WebSocketMessage,
  WebSocketCommand,
  PrinterStatusData
} from '../types/web-api.types';
import type { PollingData } from '../../types/polling';

/**
 * Branded type for WebSocketManager singleton
 */
type WebSocketManagerBrand = { readonly __brand: 'WebSocketManager' };
type WebSocketManagerInstance = WebSocketManager & WebSocketManagerBrand;

/**
 * Extended HTTP request interface that includes wsToken
 */
interface ExtendedIncomingMessage extends http.IncomingMessage {
  wsToken?: string;
}

/**
 * Client information stored for each WebSocket connection
 */
interface ClientInfo {
  readonly token: string;
  readonly connectedAt: Date;
  lastActivity: Date; // Mutable for updates
  readonly clientId: string;
}

// FormattedPrinterStatus is now replaced by PrinterStatusData from web-api.types.ts



/**
 * WebSocket Manager - Handles real-time communication
 */
export class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManagerInstance | null = null;
  
  // Manager dependencies
  private readonly authManager = getAuthManager();
  private readonly backendManager = getPrinterBackendManager();
  
  // WebSocket server
  private wss: WebSocketServer | null = null;
  
  // Client tracking
  private readonly clients: Map<WebSocket, ClientInfo> = new Map();
  private readonly clientsByToken: Map<string, Set<WebSocket>> = new Map();
  
  // Latest polling data storage
  private latestPollingData: PollingData | null = null;
  
  // Server state
  private isRunning: boolean = false;
  
  private constructor() {
    super();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketManagerInstance {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager() as WebSocketManagerInstance;
    }
    return WebSocketManager.instance;
  }
  
  /**
   * Initialize WebSocket server with HTTP server
   */
  public initialize(httpServer: http.Server): void {
    if (this.wss) {
      console.warn('WebSocket server already initialized');
      return;
    }
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });
    
    // Setup event handlers
    this.wss.on('connection', this.handleConnection.bind(this));
    
    this.isRunning = true;
    console.log('WebSocket server initialized');
  }
  
  /**
   * Verify client during WebSocket upgrade
   */
  private verifyClient(
    info: { origin: string; secure: boolean; req: http.IncomingMessage },
    callback: (res: boolean, code?: number, message?: string) => void
  ): void {
    try {
      // Extract token from URL query params or Authorization header
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token') || 
                   info.req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        callback(false, 401, 'Unauthorized: No token provided');
        return;
      }
      
      // Validate token
      const validation = this.authManager.validateToken(token);
      
      if (!validation.isValid) {
        callback(false, 401, 'Unauthorized: Invalid token');
        return;
      }
      
      // Store token for later use - properly typed
      (info.req as ExtendedIncomingMessage).wsToken = token;
      callback(true);
      
    } catch (error) {
      console.error('WebSocket verify client error:', error);
      callback(false, 500, 'Internal server error');
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const extendedReq = req as ExtendedIncomingMessage;
    const token = extendedReq.wsToken;
    
    if (!token) {
      console.error('WebSocket connection without token');
      ws.close(1008, 'Token required');
      return;
    }
    
    const clientId = this.generateClientId();
    
    // Create client info
    const clientInfo: ClientInfo = {
      token,
      connectedAt: new Date(),
      lastActivity: new Date(),
      clientId
    };
    
    // Store client
    this.clients.set(ws, clientInfo);
    
    // Add to token-based map for multi-tab support
    if (!this.clientsByToken.has(token)) {
      this.clientsByToken.set(token, new Set());
    }
    this.clientsByToken.get(token)!.add(ws);
    
    // Update client count
    this.updateClientCount();
    
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Send authentication success
    const authMessage: WebSocketMessage = {
      type: 'AUTH_SUCCESS',
      timestamp: new Date().toISOString(),
      clientId
    };
    this.sendToClient(ws, authMessage);
    
    // Send initial printer status if connected
    void this.sendInitialStatus(ws);
    
    // Setup event handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', (error) => this.handleError(ws, error));
    ws.on('pong', () => this.handlePong(ws));
    
    // Start ping interval for this client
    this.startPingInterval(ws);
  }
  
  /**
   * Handle incoming message from client
   */
  private async handleMessage(ws: WebSocket, data: RawData): Promise<void> {
    try {
      const clientInfo = this.clients.get(ws);
      if (!clientInfo) {
        console.error('Message from unknown client');
        return;
      }
      
      // Update last activity
      clientInfo.lastActivity = new Date();
      
      // Parse message safely
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(data.toString());
      } catch (parseError) {
        console.error('Failed to parse WebSocket message:', parseError);
        const errorMessage: WebSocketMessage = {
          type: 'ERROR',
          timestamp: new Date().toISOString(),
          error: 'Invalid JSON format'
        };
        this.sendToClient(ws, errorMessage);
        return;
      }
      
      // Validate as WebSocket command
      const validation = WebSocketCommandSchema.safeParse(parsedData);
      
      if (!validation.success) {
        const errorMessage: WebSocketMessage = {
          type: 'ERROR',
          timestamp: new Date().toISOString(),
          error: createValidationError(validation.error).error
        };
        this.sendToClient(ws, errorMessage);
        return;
      }
      
      const command = validation.data;
      
      // Handle command based on type
      await this.handleCommand(ws, command);
      
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      const errorMessage: WebSocketMessage = {
        type: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Failed to process message'
      };
      this.sendToClient(ws, errorMessage);
    }
  }
  
  /**
   * Handle WebSocket command
   */
  private async handleCommand(ws: WebSocket, command: WebSocketCommand): Promise<void> {
    try {
      switch (command.command) {
        case 'REQUEST_STATUS':
          await this.sendCurrentStatus(ws);
          break;
          
        case 'EXECUTE_GCODE': {
          if (!command.gcode) {
            throw new AppError('G-code command required', ErrorCode.VALIDATION);
          }
          const result = await this.backendManager.executeGCodeCommand(command.gcode);
          
          const response: WebSocketMessage = {
            type: 'COMMAND_RESULT',
            timestamp: new Date().toISOString(),
            command: command.command,
            success: result.success,
            error: result.error
          };
          this.sendToClient(ws, response);
          break;
        }
          
        case 'PING': {
          const pongMessage: WebSocketMessage = {
            type: 'PONG',
            timestamp: new Date().toISOString()
          };
          this.sendToClient(ws, pongMessage);
          break;
        }
          
        default: {
          // Exhaustiveness check
          const _exhaustive: never = command.command;
          throw new AppError(`Unknown command: ${_exhaustive}`, ErrorCode.VALIDATION);
        }
      }
    } catch (error) {
      const appError = toAppError(error);
      const errorMessage: WebSocketMessage = {
        type: 'ERROR',
        timestamp: new Date().toISOString(),
        error: appError.message
      };
      this.sendToClient(ws, errorMessage);
    }
  }
  
  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;
    
    console.log(`WebSocket client disconnected: ${clientInfo.clientId}`);
    
    // Remove from clients map
    this.clients.delete(ws);
    
    // Remove from token map
    const tokenClients = this.clientsByToken.get(clientInfo.token);
    if (tokenClients) {
      tokenClients.delete(ws);
      if (tokenClients.size === 0) {
        this.clientsByToken.delete(clientInfo.token);
      }
    }
    
    // Update client count
    this.updateClientCount();
  }
  
  /**
   * Handle WebSocket error
   */
  private handleError(ws: WebSocket, error: Error): void {
    console.error('WebSocket error:', error);
    // Close the connection on error
    ws.close();
  }
  
  /**
   * Handle pong response
   */
  private handlePong(ws: WebSocket): void {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
  }
  
  /**
   * Start ping interval for keep-alive
   */
  private startPingInterval(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.ping();
      } else {
        clearInterval(interval);
      }
    }, 30000); // Ping every 30 seconds
    
    // Clear interval when connection closes
    ws.on('close', () => clearInterval(interval));
  }
  
  /**
   * Send initial status to newly connected client
   */
  private async sendInitialStatus(ws: WebSocket): Promise<void> {
    try {
      // Use latest polling data if available
      if (this.latestPollingData) {
        const statusMessage: WebSocketMessage = {
          type: 'STATUS_UPDATE',
          timestamp: new Date().toISOString(),
          status: this.formatPollingData(this.latestPollingData)
        };
        this.sendToClient(ws, statusMessage);
      } else {
        // No data available yet
        const statusMessage: WebSocketMessage = {
          type: 'STATUS_UPDATE',
          timestamp: new Date().toISOString(),
          status: null
        };
        this.sendToClient(ws, statusMessage);
      }
    } catch (error) {
      console.error('Error sending initial status:', error);
    }
  }
  
  /**
   * Send current status to specific client
   */
  private async sendCurrentStatus(ws: WebSocket): Promise<void> {
    try {
      // Use latest polling data instead of calling backend directly
      if (this.latestPollingData) {
        const statusMessage: WebSocketMessage = {
          type: 'STATUS_UPDATE',
          timestamp: new Date().toISOString(),
          status: this.formatPollingData(this.latestPollingData)
        };
        this.sendToClient(ws, statusMessage);
      } else {
        // No data available
        const statusMessage: WebSocketMessage = {
          type: 'STATUS_UPDATE',
          timestamp: new Date().toISOString(),
          status: null
        };
        this.sendToClient(ws, statusMessage);
      }
    } catch (error) {
      console.error('Error sending current status:', error);
    }
  }
  
  /**
   * Format polling data for WebSocket transmission
   */
  private formatPollingData(data: PollingData): PrinterStatusData | null {
    if (!data.printerStatus) {
      return null;
    }
    
    const status = data.printerStatus;
    const currentJob = status.currentJob;
    
    // Extract temperature data with null safety
    const bedTemp = status.temperatures?.bed || { current: 0, target: 0 };
    const extruderTemp = status.temperatures?.extruder || { current: 0, target: 0 };
    
    // Extract filtration mode with null safety and ensure it's a valid type
    const rawFiltrationMode = status.filtration?.mode || 'none';
    const filtrationMode: 'external' | 'internal' | 'none' = 
      rawFiltrationMode === 'external' || rawFiltrationMode === 'internal' ? rawFiltrationMode : 'none';
    
    return {
      printerState: status.state, // Note: 'state' not 'printerState'
      bedTemperature: Math.round(bedTemp.current),
      bedTargetTemperature: Math.round(bedTemp.target),
      nozzleTemperature: Math.round(extruderTemp.current),
      nozzleTargetTemperature: Math.round(extruderTemp.target),
      // Progress from currentJob if available
      progress: currentJob ? currentJob.progress.percentage : 0,
      currentLayer: currentJob?.progress.currentLayer || undefined,
      totalLayers: currentJob?.progress.totalLayers || undefined,
      jobName: currentJob?.fileName || null,
      timeElapsed: currentJob?.progress.elapsedTime || undefined,
      timeRemaining: currentJob?.progress.timeRemaining || undefined,
      filtrationMode: filtrationMode,
      // Weight and length from job progress
      estimatedWeight: currentJob?.progress.weightUsed || undefined,
      estimatedLength: currentJob?.progress.lengthUsed || undefined,
      thumbnailData: data.thumbnailData || null, // Include thumbnail data
      // Extract lifetime statistics from cumulative stats
      // Backend provides filament usage in meters, same as main UI
      cumulativeFilament: status.cumulativeStats?.totalFilamentUsed || undefined,
      cumulativePrintTime: status.cumulativeStats?.totalPrintTime || undefined
    };
  }
  

  
  /**
   * Broadcast printer status to all connected clients
   * Accepts PollingData from the polling service
   */
  public async broadcastPrinterStatus(data: PollingData): Promise<void> {
    if (!this.isRunning || this.clients.size === 0) return;
    
    // Store latest data for new connections
    this.latestPollingData = data;
    
    const formattedStatus = this.formatPollingData(data);
    if (!formattedStatus) {
      return;
    }
    
    const statusMessage: WebSocketMessage = {
      type: 'STATUS_UPDATE',
      timestamp: new Date().toISOString(),
      status: formattedStatus
    };
    
    this.broadcast(statusMessage);
  }

  
  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    for (const [ws] of this.clients) {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.send(messageStr);
      }
    }
  }
  
  /**
   * Broadcast message to all clients with specific token
   */
  public broadcastToToken(token: string, message: WebSocketMessage): void {
    const clients = this.clientsByToken.get(token);
    if (!clients) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const ws of clients) {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.send(messageStr);
      }
    }
  }
  
  /**
   * Update client count in WebUIManager
   */
  private updateClientCount(): void {
    const webUIManager = getWebUIManager();
    webUIManager.updateClientCount(this.clients.size);
  }
  
  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get current client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get clients by token
   */
  public getClientsByToken(token: string): number {
    return this.clientsByToken.get(token)?.size || 0;
  }
  
  /**
   * Disconnect all clients with specific token
   */
  public disconnectToken(token: string): void {
    const clients = this.clientsByToken.get(token);
    if (!clients) return;
    
    for (const ws of clients) {
      ws.close(1000, 'Token revoked');
    }
  }
  
  /**
   * Check if server is running
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * Shutdown WebSocket server
   */
  public shutdown(): void {
    if (!this.wss) return;
    
    // Close all client connections
    for (const [ws] of this.clients) {
      ws.close(1000, 'Server shutting down');
    }
    
    // Clear maps
    this.clients.clear();
    this.clientsByToken.clear();
    
    // Close server
    this.wss.close(() => {
      console.log('WebSocket server shut down');
    });
    
    this.wss = null;
    this.isRunning = false;
  }
  
  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.shutdown();
    this.removeAllListeners();
    WebSocketManager.instance = null;
  }
}

/**
 * Get singleton instance of WebSocketManager
 */
export function getWebSocketManager(): WebSocketManagerInstance {
  return WebSocketManager.getInstance();
}
