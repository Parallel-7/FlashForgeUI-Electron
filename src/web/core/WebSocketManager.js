// src/web/core/WebSocketManager.js
const WebSocket = require('ws');

/**
 * WebSocketManager - Handles all WebSocket connections and client management
 * Separated from main server to focus on WebSocket-specific concerns
 */
class WebSocketManager {
  constructor() {
    this.wsServer = null;
    this.clients = new Set();
    this.clientDataCache = {};
    this.authService = null;
    this.messageHandler = null;
  }

  /**
   * Initialize WebSocket server with authentication
   */
  initialize(httpServer, authService) {
    this.authService = authService;

    // Setup WebSocket server with custom auth verification
    this.wsServer = new WebSocket.Server({
      server: httpServer,
      verifyClient: this.verifyClient.bind(this)
    });

    // Setup connection handling
    this.wsServer.on('connection', this.handleConnection.bind(this));
  }

  /**
   * Register message handler for processing client commands
   */
  registerMessageHandler(handler) {
    this.messageHandler = handler;
  }

  /**
   * Verify WebSocket client authentication
   */
  verifyClient(info, callback) {
    try {
      // Get token from URL query parameters
      const urlStr = info.req.url;
      const queryParams = new URLSearchParams(urlStr.split('?')[1] || '');
      const token = queryParams.get('token');

      const isValid = this.authService && this.authService.verifyToken(token);
      callback(isValid, isValid ? 200 : 401, isValid ? 'Authorized' : 'Unauthorized');
    } catch (error) {
      console.error('WebSocket client verification error:', error);
      callback(false, 401, 'Error during authentication');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws) {
    console.log('New WebUI client connected');
    this.clients.add(ws);

    // Send initial data if available
    this.sendInitialData(ws);

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        this.routeMessage(ws, msg);
      } catch (err) {
        console.error('Error parsing WebUI client message:', err);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('WebUI client disconnected');
      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Send initial data to newly connected client
   */
  sendInitialData(ws) {
    if (this.clientDataCache.printerInfo) {
      ws.send(JSON.stringify({
        type: 'printer-data',
        data: this.clientDataCache.printerInfo
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'printer-disconnected'
      }));
    }
  }

  /**
   * Route message to appropriate handler
   */
  routeMessage(ws, message) {
    if (this.messageHandler) {
      this.messageHandler.handleMessage(ws, message);
    } else {
      console.warn('No message handler registered for WebSocket message:', message.type);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToClients(type, data = null) {
    try {
      const message = JSON.stringify({ type, data });

      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    } catch (err) {
      console.error(`Error broadcasting message of type '${type}':`, err);
    }
  }

  /**
   * Send message to specific client by WebSocket instance
   */
  sendToClient(ws, type, data = null) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }));
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error sending message of type '${type}' to client:`, err);
      return false;
    }
  }

  /**
   * Get client ID by WebSocket instance
   */
  getClientId(ws) {
    const clients = [...this.clients];
    return clients.indexOf(ws);
  }

  /**
   * Update cached client data
   */
  updateClientDataCache(key, data) {
    this.clientDataCache[key] = data;
  }

  /**
   * Get number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get clients array for external access
   */
  getClients() {
    return [...this.clients];
  }

  /**
   * Close all connections and shutdown
   */
  shutdown() {
    // Close all WebSocket connections
    for (const client of this.clients) {
      client.terminate();
    }
    this.clients.clear();

    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Clear cache
    this.clientDataCache = {};
    
    console.log('WebSocketManager shutdown completed');
  }
}

module.exports = WebSocketManager;
