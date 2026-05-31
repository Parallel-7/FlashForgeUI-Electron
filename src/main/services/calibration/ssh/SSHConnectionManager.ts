/**
 * @fileoverview SSH connection management for remote printer access.
 * Provides connection pooling, automatic reconnection, and timeout handling.
 * Uses the ssh2 library for native SSH connectivity.
 *
 * @module main/services/calibration/ssh/SSHConnectionManager
 */

import { EventEmitter } from 'events';
import { Client, type ConnectConfig } from 'ssh2';
import { type SSHConnectionConfig, SSHConnectionStatus } from '../../../../shared/types/calibration';

/**
 * Active SSH connection state.
 */
export interface SSHConnection {
  /** Unique connection ID (typically printer context ID) */
  id: string;
  /** Connection configuration */
  config: SSHConnectionConfig;
  /** SSH2 client instance */
  client: Client;
  /** Current connection status */
  status: SSHConnectionStatus;
  /** Timestamp of last activity */
  lastActivity: number;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Result of executing a command over SSH.
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Exit code from the command */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Events emitted by SSHConnectionManager.
 */
export interface SSHConnectionManagerEvents {
  'connection-status': (id: string, status: SSHConnectionStatus, error?: string) => void;
  'connection-error': (id: string, error: Error) => void;
  'connection-closed': (id: string) => void;
}

/**
 * Default SSH configuration values.
 */
const DEFAULT_CONFIG: Partial<SSHConnectionConfig> = {
  port: 22,
  timeout: 10000,
  keepaliveInterval: 10000,
  username: 'root',
};

/**
 * Manager for SSH connections to printers.
 * Maintains a pool of connections keyed by printer context ID.
 */
export class SSHConnectionManager extends EventEmitter {
  /** Active connections */
  private readonly connections: Map<string, SSHConnection> = new Map();

  /** Cleanup interval handle */
  private cleanupInterval: NodeJS.Timeout | null = null;

  /** Stale connection timeout (5 minutes) */
  private readonly staleTimeout = 5 * 60 * 1000;

  constructor() {
    super();
    this.startCleanupInterval();
  }

  /**
   * Start the periodic cleanup of stale connections.
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Check every minute
  }

  /**
   * Stop the cleanup interval.
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Connect to a printer via SSH.
   *
   * @param contextId - Printer context ID
   * @param config - SSH connection configuration
   * @returns Promise that resolves when connected
   */
  async connect(contextId: string, config: SSHConnectionConfig): Promise<void> {
    // Disconnect existing connection if any
    if (this.connections.has(contextId)) {
      await this.disconnect(contextId);
    }

    const fullConfig: SSHConnectionConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    } as SSHConnectionConfig;

    const client = new Client();

    const connection: SSHConnection = {
      id: contextId,
      config: fullConfig,
      client,
      status: SSHConnectionStatus.CONNECTING,
      lastActivity: Date.now(),
    };

    this.connections.set(contextId, connection);
    this.emit('connection-status', contextId, SSHConnectionStatus.CONNECTING);

    return new Promise((resolve, reject) => {
      const connectConfig: ConnectConfig = {
        host: fullConfig.host,
        port: fullConfig.port,
        username: fullConfig.username,
        readyTimeout: fullConfig.timeout,
        keepaliveInterval: fullConfig.keepaliveInterval,
      };

      // Add authentication
      if (fullConfig.privateKey) {
        connectConfig.privateKey = fullConfig.privateKey;
      } else if (fullConfig.password) {
        connectConfig.password = fullConfig.password;
      }

      // Connection event handlers
      client.on('ready', () => {
        connection.status = SSHConnectionStatus.CONNECTED;
        connection.lastActivity = Date.now();
        connection.error = undefined;
        this.emit('connection-status', contextId, SSHConnectionStatus.CONNECTED);
        resolve();
      });

      client.on('error', (err: Error) => {
        connection.status = SSHConnectionStatus.ERROR;
        connection.error = err.message;
        this.emit('connection-status', contextId, SSHConnectionStatus.ERROR, err.message);
        this.emit('connection-error', contextId, err);
        reject(err);
      });

      client.on('close', () => {
        if (connection.status !== SSHConnectionStatus.DISCONNECTED) {
          connection.status = SSHConnectionStatus.DISCONNECTED;
          this.emit('connection-status', contextId, SSHConnectionStatus.DISCONNECTED);
          this.emit('connection-closed', contextId);
        }
      });

      client.on('end', () => {
        connection.status = SSHConnectionStatus.DISCONNECTED;
      });

      // Initiate connection
      client.connect(connectConfig);
    });
  }

  /**
   * Disconnect from a printer.
   *
   * @param contextId - Printer context ID
   */
  async disconnect(contextId: string): Promise<void> {
    const connection = this.connections.get(contextId);
    if (!connection) {
      return;
    }

    return new Promise((resolve) => {
      connection.status = SSHConnectionStatus.DISCONNECTED;
      connection.client.end();

      // Give it a moment to close gracefully
      setTimeout(() => {
        this.connections.delete(contextId);
        this.emit('connection-status', contextId, SSHConnectionStatus.DISCONNECTED);
        resolve();
      }, 100);
    });
  }

  /**
   * Check if a connection is active.
   *
   * @param contextId - Printer context ID
   * @returns True if connected
   */
  isConnected(contextId: string): boolean {
    const connection = this.connections.get(contextId);
    return connection?.status === SSHConnectionStatus.CONNECTED;
  }

  /**
   * Get connection status.
   *
   * @param contextId - Printer context ID
   * @returns Connection status or 'disconnected' if not found
   */
  getStatus(contextId: string): SSHConnectionStatus {
    const connection = this.connections.get(contextId);
    return connection?.status || SSHConnectionStatus.DISCONNECTED;
  }

  /**
   * Get connection details.
   *
   * @param contextId - Printer context ID
   * @returns Connection object or undefined
   */
  getConnection(contextId: string): SSHConnection | undefined {
    return this.connections.get(contextId);
  }

  /**
   * Execute a command on the remote printer.
   *
   * @param contextId - Printer context ID
   * @param command - Command to execute
   * @returns Command result
   */
  async executeCommand(contextId: string, command: string): Promise<CommandResult> {
    const connection = this.connections.get(contextId);

    if (!connection) {
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: 'Not connected',
      };
    }

    if (connection.status !== SSHConnectionStatus.CONNECTED) {
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: `Connection status: ${connection.status}`,
      };
    }

    connection.lastActivity = Date.now();

    return new Promise((resolve) => {
      connection.client.exec(command, (err, stream) => {
        if (err) {
          resolve({
            success: false,
            exitCode: -1,
            stdout: '',
            stderr: '',
            error: err.message,
          });
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        stream.on('close', (code: number) => {
          exitCode = code;
          resolve({
            success: code === 0,
            exitCode,
            stdout,
            stderr,
          });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });
  }

  /**
   * Refresh a connection by reconnecting.
   *
   * @param contextId - Printer context ID
   */
  async refreshConnection(contextId: string): Promise<void> {
    const connection = this.connections.get(contextId);
    if (!connection) {
      throw new Error('No connection to refresh');
    }

    await this.connect(contextId, connection.config);
  }

  /**
   * Clean up stale connections that haven't been used recently.
   */
  cleanupStaleConnections(): void {
    const now = Date.now();

    for (const [contextId, connection] of this.connections) {
      if (now - connection.lastActivity > this.staleTimeout) {
        this.disconnect(contextId).catch(() => {
          // Ignore errors during cleanup
        });
      }
    }
  }

  /**
   * Disconnect all connections and cleanup.
   */
  async shutdown(): Promise<void> {
    this.stopCleanupInterval();

    const disconnectPromises: Promise<void>[] = [];
    for (const contextId of this.connections.keys()) {
      disconnectPromises.push(this.disconnect(contextId));
    }

    await Promise.all(disconnectPromises);
  }

  /**
   * Get all active connection IDs.
   */
  getActiveConnectionIds(): string[] {
    return Array.from(this.connections.keys()).filter(
      (id) => this.connections.get(id)?.status === SSHConnectionStatus.CONNECTED
    );
  }

  /**
   * Update last activity timestamp for a connection.
   *
   * @param contextId - Printer context ID
   */
  touch(contextId: string): void {
    const connection = this.connections.get(contextId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }
}

/**
 * Singleton instance.
 */
let sshManagerInstance: SSHConnectionManager | null = null;

/**
 * Get the SSHConnectionManager singleton.
 */
export function getSSHConnectionManager(): SSHConnectionManager {
  if (!sshManagerInstance) {
    sshManagerInstance = new SSHConnectionManager();
  }
  return sshManagerInstance;
}
