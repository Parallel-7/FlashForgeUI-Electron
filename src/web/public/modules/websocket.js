// src/web/public/modules/websocket.js

/**
 * WebSocket Communication Module
 * Handles WebSocket connection, message routing, and reconnection logic
 */
class WebSocketManager {
  constructor(uiUtils, authManager) {
    this.ui = uiUtils;
    this.auth = authManager;
    this.socket = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
  }

  /**
   * Register message handlers for different message types
   * @param {Object} handlers Map of message type to handler function
   */
  registerHandlers(handlers) {
    Object.entries(handlers).forEach(([type, handler]) => {
      this.messageHandlers.set(type, handler);
    });
  }

  /**
   * Connect to WebSocket server with authentication token
   * @param {string} token Authentication token
   * @returns {Promise<boolean>} Whether connection was successful
   */
  connectWithToken(token) {
    return new Promise((resolve) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

      // Close existing connection
      this.disconnect();

      // Create new WebSocket connection
      this.socket = new WebSocket(wsUrl);
      window.socket = this.socket; // Make available globally for compatibility

      // Setup event handlers
      this.socket.addEventListener('open', () => {
        console.log('WebSocket connected');
        window.isConnected = true;
        this.reconnectAttempts = 0;
        
        this.ui.updateConnectionStatus('Connected to server', true);
        this.auth.showMainUI();
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Send initial data request
        this.sendCommand('request-printer-data');
        
        resolve(true);
      });

      this.socket.addEventListener('message', (event) => {
        this.handleMessage(event);
      });

      this.socket.addEventListener('close', () => {
        console.log('WebSocket disconnected');
        window.isConnected = false;
        this.stopHeartbeat();
        
        this.ui.updateConnectionStatus('Disconnected from server', false);
        
        // Cleanup resources
        this.cleanupResources();
        
        // Attempt reconnection
        this.scheduleReconnect(token);
        
        resolve(false);
      });

      this.socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        
        if (window.isConnected) {
          this.ui.showToast('Connection error', 'error');
        }
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      const handler = this.messageHandlers.get(message.type);
      
      if (handler) {
        handler(message);
      } else {
        console.log('Unhandled message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing server message:', error);
    }
  }

  /**
   * Send command to server via WebSocket
   * @param {string} command Command name
   * @param {*} data Command data
   * @param {boolean} silent Whether to suppress error messages
   */
  sendCommand(command, data = null, silent = false) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      if (!silent && window.isConnected) {
        this.ui.showToast('Not connected to server', 'error');
      }
      return;
    }

    const isSilent = silent || command === 'request-printer-data';
    
    const message = {
      type: 'command',
      command,
      data,
      silent: isSilent
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendCommand('request-printer-data', null, true);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleanup resources on disconnect
   */
  cleanupResources() {
    // Cleanup preview player if it exists
    if (window.previewPlayer) {
      try {
        if (window.previewPlayer.destroy) {
          window.previewPlayer.destroy();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      window.previewPlayer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   * @param {string} token Authentication token
   */
  scheduleReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.ui.showToast('Connection lost. Please refresh the page.', 'error', 10000);
      return;
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!window.isConnected) {
        console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connectWithToken(token);
      }
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      window.socket = null;
    }
    
    window.isConnected = false;
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean} Whether WebSocket is connected
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Handle command response messages
   * @param {Object} message Command response message
   */
  handleCommandResponse(message) {
    const { command, success, message: responseMessage } = message;

    // Skip showing toasts for automatic data requests
    if (command === 'request-printer-data') {
      return;
    }

    // Show result toast
    if (success) {
      this.ui.showToast('Command successful', 'success');
    } else {
      this.ui.showToast(`Command failed: ${responseMessage}`, 'error');
    }
  }
}

// Export for use by other modules
window.WebSocketManager = WebSocketManager;
