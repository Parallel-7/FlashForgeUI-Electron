/**
 * @fileoverview Manager for tracking printer connection state across multiple printer contexts.
 *
 * Provides centralized connection state management for multi-printer support:
 * - Per-context connection state tracking
 * - Client instance storage (primary and secondary clients)
 * - Printer details management
 * - Connection status monitoring (connected/disconnected, timestamps)
 * - Event emission for connection state changes
 * - Activity tracking for connection health monitoring
 *
 * Key exports:
 * - ConnectionStateManager class: Multi-context connection state tracker
 * - getConnectionStateManager(): Singleton accessor
 *
 * The manager maintains a separate connection state for each printer context, enabling
 * independent tracking of multiple simultaneous printer connections. State includes client
 * instances, printer details, connection status, and activity timestamps.
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient } from '@ghosttypes/ff-api';
import { PrinterDetails, PrinterConnectionState } from '../types/printer';
import { getPrinterContextManager } from '../managers/PrinterContextManager';

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
 * Service responsible for managing printer connection state per context
 * Tracks client instances, connection status, and printer details for multiple printers
 */
export class ConnectionStateManager extends EventEmitter {
  private static instance: ConnectionStateManager | null = null;
  private readonly contextManager = getPrinterContextManager();

  // Multi-context state storage
  private readonly contextStates = new Map<string, ConnectionState>();

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
   * Set state to connecting for a specific context
   *
   * @param contextId - Context ID for this connection
   * @param printer - Printer info
   */
  public setConnecting(contextId: string, printer: { name: string; ipAddress: string }): void {
    const now = new Date();
    const state: ConnectionState = {
      primaryClient: null,
      secondaryClient: null,
      details: null,
      isConnected: false,
      connectionStartTime: now,
      lastActivityTime: now
    };

    this.contextStates.set(contextId, state);

    // Update context manager
    this.contextManager.updateConnectionState(contextId, 'connecting');

    this.emit('state-changed', { contextId, state: 'connecting', printer });
  }

  /**
   * Set state to connected with client instances and printer details
   *
   * @param contextId - Context ID for this connection
   * @param details - Printer details
   * @param primaryClient - Primary API client
   * @param secondaryClient - Optional secondary API client
   */
  public setConnected(
    contextId: string,
    details: PrinterDetails,
    primaryClient: FiveMClient | FlashForgeClient,
    secondaryClient?: FlashForgeClient
  ): void {
    const existingState = this.contextStates.get(contextId);
    const state: ConnectionState = {
      primaryClient,
      secondaryClient: secondaryClient || null,
      details,
      isConnected: true,
      connectionStartTime: existingState?.connectionStartTime || new Date(),
      lastActivityTime: new Date()
    };

    this.contextStates.set(contextId, state);

    // Update context manager
    this.contextManager.updateConnectionState(contextId, 'connected');

    this.emit('state-changed', { contextId, state: 'connected', details });
  }

  /**
   * Set state to disconnected and clear client references
   *
   * @param contextId - Context ID for this disconnection
   */
  public setDisconnected(contextId: string): void {
    const existingState = this.contextStates.get(contextId);
    const previousDetails = existingState?.details;

    // Update context manager
    this.contextManager.updateConnectionState(contextId, 'disconnected');

    // Remove from map
    this.contextStates.delete(contextId);

    this.emit('state-changed', { contextId, state: 'disconnected', previousDetails });
  }

  /**
   * Get connection state for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Connection state
   */
  public getState(contextId: string): PrinterConnectionState {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return {
        isConnected: false,
        printerName: undefined,
        ipAddress: undefined,
        clientType: undefined,
        isPrinting: false,
        lastConnected: new Date()
      };
    }

    const { details, isConnected, connectionStartTime } = state;

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
   * Check if currently connected for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns True if connected
   */
  public isConnected(contextId: string): boolean {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return false;
    }

    return state.isConnected && state.primaryClient !== null;
  }

  /**
   * Get primary client instance for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Primary client or null
   */
  public getPrimaryClient(contextId: string): FiveMClient | FlashForgeClient | null {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return null;
    }

    return state.primaryClient;
  }

  /**
   * Get secondary client instance (for dual API connections)
   *
   * @param contextId - Context ID (required)
   * @returns Secondary client or null
   */
  public getSecondaryClient(contextId: string): FlashForgeClient | null {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return null;
    }

    return state.secondaryClient;
  }

  /**
   * Get current printer details for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Printer details or null
   */
  public getCurrentDetails(contextId: string): PrinterDetails | null {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return null;
    }

    return state.details;
  }

  /**
   * Update last activity time for a specific context
   *
   * @param contextId - Context ID (required)
   */
  public updateLastActivity(contextId: string): void {
    const state = this.contextStates.get(contextId);
    if (state && state.isConnected) {
      state.lastActivityTime = new Date();
    }
  }

  /**
   * Get connection duration in seconds for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Duration in seconds
   */
  public getConnectionDuration(contextId: string): number {
    const state = this.contextStates.get(contextId);
    if (!state || !state.isConnected || !state.connectionStartTime) {
      return 0;
    }

    const now = new Date();
    return Math.floor((now.getTime() - state.connectionStartTime.getTime()) / 1000);
  }

  /**
   * Check if connection is using dual API for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns True if using dual API
   */
  public isDualAPI(contextId: string): boolean {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return false;
    }

    return state.secondaryClient !== null;
  }

  /**
   * Get formatted connection status string for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Status string
   */
  public getConnectionStatus(contextId: string): string {
    const state = this.contextStates.get(contextId);
    if (!state || !state.isConnected) {
      return 'Disconnected';
    }

    const details = state.details;
    if (!details) {
      return 'Connected (Unknown Printer)';
    }

    return `Connected to ${details.Name}`;
  }

  /**
   * Dispose client connections for a specific context
   *
   * @param contextId - Context ID to dispose clients for
   */
  public async disposeClientsForContext(contextId: string): Promise<void> {
    const state = this.contextStates.get(contextId);
    if (!state) {
      return;
    }

    const { primaryClient, secondaryClient } = state;

    if (primaryClient) {
      try {
        void primaryClient.dispose();
      } catch (error) {
        console.error(`Error disposing primary client for context ${contextId}:`, error);
      }
    }

    if (secondaryClient) {
      try {
        void secondaryClient.dispose();
      } catch (error) {
        console.error(`Error disposing secondary client for context ${contextId}:`, error);
      }
    }

    this.emit('clients-disposed', { contextId });
  }


  /**
   * Clear state and dispose resources for a specific context
   *
   * @param contextId - Context ID to clear
   */
  public async clearContext(contextId: string): Promise<void> {
    await this.disposeClientsForContext(contextId);
    this.setDisconnected(contextId);
  }


  /**
   * Clear all contexts and dispose all resources
   */
  public async clearAll(): Promise<void> {
    const contextIds = Array.from(this.contextStates.keys());

    for (const contextId of contextIds) {
      await this.clearContext(contextId);
    }

    this.contextStates.clear();
  }
}

// Export singleton getter function
export const getConnectionStateManager = (): ConnectionStateManager => {
  return ConnectionStateManager.getInstance();
};

