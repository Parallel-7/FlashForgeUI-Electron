/**
 * ConnectionStateManager.ts
 * Manages printer connection state and client instances
 * Tracks current connection status, printer details, and API client references
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient } from 'ff-api';
import { PrinterDetails, PrinterConnectionState } from '../types/printer';

/**
 * Internal connection state structure
 */
interface ConnectionState {
  primaryClient: FiveMClient | FlashForgeClient | null;
  secondaryClient: FlashForgeClient | null;
  details: PrinterDetails | null;
  isConnected: boolean;
  connectionStartTime: Date | null;
  lastActivityTime: Date | null;
}

/**
 * Service responsible for managing printer connection state
 * Tracks client instances, connection status, and printer details
 */
export class ConnectionStateManager extends EventEmitter {
  private static instance: ConnectionStateManager | null = null;
  private connectionState: ConnectionState = {
    primaryClient: null,
    secondaryClient: null,
    details: null,
    isConnected: false,
    connectionStartTime: null,
    lastActivityTime: null
  };

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of ConnectionStateManager
   */
  public static getInstance(): ConnectionStateManager {
    if (!ConnectionStateManager.instance) {
      ConnectionStateManager.instance = new ConnectionStateManager();
    }
    return ConnectionStateManager.instance;
  }

  /**
   * Set state to connecting
   */
  public setConnecting(printer: { name: string; ipAddress: string }): void {
    this.connectionState = {
      ...this.connectionState,
      isConnected: false,
      connectionStartTime: new Date(),
      lastActivityTime: new Date()
    };
    this.emit('state-changed', { state: 'connecting', printer });
  }

  /**
   * Set state to connected with client instances and printer details
   */
  public setConnected(
    details: PrinterDetails,
    primaryClient: FiveMClient | FlashForgeClient,
    secondaryClient?: FlashForgeClient
  ): void {
    this.connectionState = {
      primaryClient,
      secondaryClient: secondaryClient || null,
      details,
      isConnected: true,
      connectionStartTime: this.connectionState.connectionStartTime || new Date(),
      lastActivityTime: new Date()
    };
    this.emit('state-changed', { state: 'connected', details });
  }

  /**
   * Set state to disconnected and clear client references
   */
  public setDisconnected(): void {
    const previousDetails = this.connectionState.details;
    
    this.connectionState = {
      primaryClient: null,
      secondaryClient: null,
      details: null,
      isConnected: false,
      connectionStartTime: null,
      lastActivityTime: null
    };
    
    this.emit('state-changed', { state: 'disconnected', previousDetails });
  }

  /**
   * Get current connection state
   */
  public getState(): PrinterConnectionState {
    const { details, isConnected, connectionStartTime } = this.connectionState;
    
    return {
      isConnected,
      printerName: details?.Name,
      ipAddress: details?.IPAddress,
      clientType: details?.ClientType,
      isPrinting: false, // This should be updated based on actual printer status
      lastConnected: connectionStartTime || new Date()
    };
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.connectionState.isConnected && this.connectionState.primaryClient !== null;
  }

  /**
   * Get primary client instance
   */
  public getPrimaryClient(): FiveMClient | FlashForgeClient | null {
    return this.connectionState.primaryClient;
  }

  /**
   * Get secondary client instance (for dual API connections)
   */
  public getSecondaryClient(): FlashForgeClient | null {
    return this.connectionState.secondaryClient;
  }

  /**
   * Get current printer details
   */
  public getCurrentDetails(): PrinterDetails | null {
    return this.connectionState.details;
  }

  /**
   * Update last activity time
   */
  public updateLastActivity(): void {
    if (this.connectionState.isConnected) {
      this.connectionState.lastActivityTime = new Date();
    }
  }

  /**
   * Get connection duration in seconds
   */
  public getConnectionDuration(): number {
    if (!this.connectionState.isConnected || !this.connectionState.connectionStartTime) {
      return 0;
    }
    
    const now = new Date();
    return Math.floor((now.getTime() - this.connectionState.connectionStartTime.getTime()) / 1000);
  }

  /**
   * Check if connection is using dual API
   */
  public isDualAPI(): boolean {
    return this.connectionState.secondaryClient !== null;
  }

  /**
   * Get formatted connection status string
   */
  public getConnectionStatus(): string {
    if (!this.connectionState.isConnected) {
      return 'Disconnected';
    }

    const details = this.connectionState.details;
    if (!details) {
      return 'Connected (Unknown Printer)';
    }

    return `Connected to ${details.Name}`;
  }

  /**
   * Dispose all client connections
   */
  public async disposeClients(): Promise<void> {
    const { primaryClient, secondaryClient } = this.connectionState;

    if (primaryClient) {
      try {
        void primaryClient.dispose();
      } catch (error) {
        console.error('Error disposing primary client:', error);
      }
    }

    if (secondaryClient) {
      try {
        void secondaryClient.dispose();
      } catch (error) {
        console.error('Error disposing secondary client:', error);
      }
    }

    this.emit('clients-disposed');
  }

  /**
   * Clear all state and dispose resources
   */
  public async clear(): Promise<void> {
    await this.disposeClients();
    this.setDisconnected();
  }
}

// Export singleton getter function
export const getConnectionStateManager = (): ConnectionStateManager => {
  return ConnectionStateManager.getInstance();
};
