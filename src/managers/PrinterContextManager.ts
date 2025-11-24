/**
 * @fileoverview Manages multiple printer contexts for simultaneous multi-printer connections.
 *
 * The PrinterContextManager is a singleton service that coordinates multiple printer
 * connections by maintaining separate contexts for each printer. Each context contains
 * all the state needed for a complete printer connection: backend, polling service,
 * camera proxy, and connection state.
 *
 * Key Responsibilities:
 * - Create and manage printer contexts with unique IDs
 * - Track the active context for UI/API operations
 * - Provide context switching with proper event notifications
 * - Clean up resources when contexts are removed
 * - Emit events for UI synchronization
 *
 * Architecture:
 * - Uses EventEmitter pattern for loose coupling with UI/services
 * - Maintains Map of contexts indexed by unique string IDs
 * - Tracks single active context ID for default operations
 * - Delegates resource cleanup to context owners (backends, services)
 *
 * Usage:
 * ```typescript
 * const manager = PrinterContextManager.getInstance();
 *
 * // Create new context for a printer
 * const contextId = manager.createContext(printerDetails);
 *
 * // Switch to a different context
 * manager.switchContext(contextId);
 *
 * // Get active context for operations
 * const context = manager.getActiveContext();
 * if (context?.backend) {
 *   await context.backend.sendGCode('M105');
 * }
 * ```
 *
 * Events:
 * - 'context-created': (contextId: string) - New context created
 * - 'context-removed': (contextId: string) - Context removed and cleaned up
 * - 'context-switched': (contextId: string, previousId: string | null) - Active context changed
 *
 * Related:
 * - PrinterBackendManager: Manages backends within contexts
 * - PrinterPollingService: Per-context polling service
 * - CameraProxyService: Per-context camera streaming
 */

import { EventEmitter } from 'events';
import { PrinterDetails } from '../types/printer.js';
import type { BasePrinterBackend } from '../printer-backends/BasePrinterBackend.js';
import type { PrinterPollingService } from '../services/PrinterPollingService.js';
import type { PrinterNotificationCoordinator } from '../services/notifications/PrinterNotificationCoordinator.js';
import type {
  PrinterContextInfo,
  ContextConnectionState,
  ContextSwitchEvent,
  ContextCreatedEvent,
  ContextRemovedEvent
} from '../types/PrinterContext.js';
import type { ActiveSpoolData } from '../types/spoolman.js';
import { getSpoolmanIntegrationService } from '../services/SpoolmanIntegrationService.js';

/**
 * Complete printer context containing all state for a single printer connection
 * This is the internal representation with full service references
 */
export interface PrinterContext {
  /** Unique identifier for this context */
  readonly id: string;

  /** Display name for the tab (usually printer name) */
  name: string;

  /** Printer details from connection */
  printerDetails: PrinterDetails;

  /** Active backend instance (null if not connected) */
  backend: BasePrinterBackend | null;

  /** Current connection state */
  connectionState: ContextConnectionState;

  /** Polling service for this context (null if not active) */
  pollingService: PrinterPollingService | null;

  /** Notification coordinator for this context (null if not active) */
  notificationCoordinator: PrinterNotificationCoordinator | null;

  /** Camera proxy port for this context (null if no camera) */
  cameraProxyPort: number | null;

  /** Whether this is the active context */
  isActive: boolean;

  /** When this context was created */
  createdAt: Date;

  /** Last activity timestamp */
  lastActivity: Date;

  /** Active Spoolman spool ID (null if no spool selected) */
  activeSpoolId: number | null;

  /** Active Spoolman spool data for UI display (null if no spool selected) */
  activeSpoolData: ActiveSpoolData | null;
}

/**
 * Branded type for PrinterContextManager to ensure singleton pattern
 */
type PrinterContextManagerBrand = { readonly __brand: 'PrinterContextManager' };
type PrinterContextManagerInstance = PrinterContextManager & PrinterContextManagerBrand;

/**
 * Singleton manager for multiple printer contexts
 * Provides context creation, switching, and lifecycle management
 */
export class PrinterContextManager extends EventEmitter {
  private static instance: PrinterContextManagerInstance | null = null;

  /** Map of all contexts indexed by ID */
  private readonly contexts = new Map<string, PrinterContext>();

  /** ID of the currently active context */
  private activeContextId: string | null = null;

  /** Counter for generating unique context IDs */
  private contextIdCounter = 0;

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of PrinterContextManager
   */
  public static getInstance(): PrinterContextManagerInstance {
    if (!PrinterContextManager.instance) {
      PrinterContextManager.instance = new PrinterContextManager() as PrinterContextManagerInstance;
    }
    return PrinterContextManager.instance;
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    this.contextIdCounter++;
    return `context-${this.contextIdCounter}-${Date.now()}`;
  }

  /**
   * Create a new printer context
   *
   * @param printerDetails - Printer details from connection
   * @returns Unique context ID
   *
   * @fires context-created
   */
  public createContext(printerDetails: PrinterDetails): string {
    const contextId = this.generateContextId();
    const now = new Date();

    const context: PrinterContext = {
      id: contextId,
      name: printerDetails.Name,
      printerDetails,
      backend: null,
      connectionState: 'connecting',
      pollingService: null,
      notificationCoordinator: null,
      cameraProxyPort: null,
      isActive: false,
      createdAt: now,
      lastActivity: now,
      activeSpoolId: null,
      activeSpoolData: null
    };

    this.contexts.set(contextId, context);

    // Emit creation event
    const event: ContextCreatedEvent = {
      contextId,
      contextInfo: this.contextToInfo(context)
    };
    this.emit('context-created', event);

    console.log(`[PrinterContextManager] Created context ${contextId} for printer: ${printerDetails.Name}`);

    return contextId;
  }

  /**
   * Remove a context and clean up its resources
   *
   * @param contextId - ID of context to remove
   *
   * @fires context-removed
   * @throws Error if context doesn't exist
   */
  public removeContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} does not exist`);
    }

    const wasActive = context.isActive;

    // If removing active context, clear active ID
    if (this.activeContextId === contextId) {
      this.activeContextId = null;
    }

    // Remove from map (cleanup of backend/services is handled externally)
    this.contexts.delete(contextId);

    // Emit removal event
    const event: ContextRemovedEvent = {
      contextId,
      wasActive
    };
    this.emit('context-removed', event);

    console.log(`[PrinterContextManager] Removed context ${contextId}`);
  }

  /**
   * Switch to a different context
   *
   * @param contextId - ID of context to switch to
   *
   * @fires context-switched
   * @throws Error if context doesn't exist
   */
  public switchContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} does not exist`);
    }

    const previousContextId = this.activeContextId;

    // Deactivate previous context
    if (previousContextId) {
      const previousContext = this.contexts.get(previousContextId);
      if (previousContext) {
        previousContext.isActive = false;
      }
    }

    // Activate new context
    context.isActive = true;
    context.lastActivity = new Date();
    this.activeContextId = contextId;

    // Emit switch event
    const event: ContextSwitchEvent = {
      contextId,
      previousContextId,
      contextInfo: this.contextToInfo(context)
    };
    this.emit('context-switched', event);

    console.log(`[PrinterContextManager] Switched from ${previousContextId || 'none'} to ${contextId}`);
  }

  /**
   * Get the currently active context
   *
   * @returns Active context or null if none
   */
  public getActiveContext(): PrinterContext | null {
    if (!this.activeContextId) {
      return null;
    }
    return this.contexts.get(this.activeContextId) || null;
  }

  /**
   * Get active context ID
   *
   * @returns Active context ID or null if none
   */
  public getActiveContextId(): string | null {
    return this.activeContextId;
  }

  /**
   * Get a specific context by ID
   *
   * @param contextId - Context ID to retrieve
   * @returns Context or undefined if not found
   */
  public getContext(contextId: string): PrinterContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Get all contexts
   *
   * @returns Array of all contexts
   */
  public getAllContexts(): PrinterContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Get serializable info for all contexts
   *
   * @returns Array of context info objects safe for IPC
   */
  public getAllContextsInfo(): PrinterContextInfo[] {
    return this.getAllContexts().map(ctx => this.contextToInfo(ctx));
  }

  /**
   * Check if a context exists
   *
   * @param contextId - Context ID to check
   * @returns True if context exists
   */
  public hasContext(contextId: string): boolean {
    return this.contexts.has(contextId);
  }

  /**
   * Get number of contexts
   *
   * @returns Total number of contexts
   */
  public getContextCount(): number {
    return this.contexts.size;
  }

  /**
   * Update context connection state
   *
   * @param contextId - Context to update
   * @param state - New connection state
   */
  public updateConnectionState(contextId: string, state: ContextConnectionState): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.connectionState = state;
      context.lastActivity = new Date();
    }
  }

  /**
   * Update context backend reference
   *
   * @param contextId - Context to update
   * @param backend - Backend instance or null
   */
  public updateBackend(contextId: string, backend: BasePrinterBackend | null): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.backend = backend;
      context.lastActivity = new Date();
    }
  }

  /**
   * Update context printer details (for settings changes)
   *
   * @param contextId - Context to update
   * @param printerDetails - Updated printer details
   */
  public updatePrinterDetails(contextId: string, printerDetails: PrinterDetails): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.printerDetails = printerDetails;
      context.lastActivity = new Date();
      console.log(`[PrinterContextManager] Updated printer details for context ${contextId}`);

      // Emit context-updated event for listeners (e.g., camera setup)
      this.emit('context-updated', contextId);
    }
  }

  /**
   * Update context polling service reference
   *
   * @param contextId - Context to update
   * @param pollingService - Polling service instance or null
   */
  public updatePollingService(contextId: string, pollingService: PrinterPollingService | null): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.pollingService = pollingService;
      context.lastActivity = new Date();
    }
  }

  /**
   * Update context notification coordinator reference
   *
   * @param contextId - Context to update
   * @param notificationCoordinator - Notification coordinator instance or null
   */
  public updateNotificationCoordinator(contextId: string, notificationCoordinator: PrinterNotificationCoordinator | null): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.notificationCoordinator = notificationCoordinator;
      context.lastActivity = new Date();
    }
  }

  /**
   * Resolve the context ID for a notification coordinator instance.
   *
   * @param coordinator - Notification coordinator to locate
   * @returns Context ID or null if coordinator is not registered
   */
  public getContextIdForNotificationCoordinator(coordinator: PrinterNotificationCoordinator): string | null {
    for (const [contextId, context] of this.contexts.entries()) {
      if (context.notificationCoordinator === coordinator) {
        return contextId;
      }
    }
    return null;
  }

  /**
   * Update context camera proxy port
   *
   * @param contextId - Context to update
   * @param port - Camera proxy port or null
   */
  public updateCameraPort(contextId: string, port: number | null): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.cameraProxyPort = port;
      context.lastActivity = new Date();
    }
  }

  /**
   * Convert internal context to serializable info
   * Safe to send over IPC
   *
   * @param context - Internal context object
   * @returns Serializable context info
   */
  private contextToInfo(context: PrinterContext): PrinterContextInfo {
    const cameraUrl = context.cameraProxyPort
      ? `http://localhost:${context.cameraProxyPort}/stream`
      : undefined;

    return {
      id: context.id,
      name: context.name,
      ip: context.printerDetails.IPAddress,
      model: context.printerDetails.printerModel,
      serialNumber: context.printerDetails.SerialNumber || null,
      status: context.connectionState,
      isActive: context.isActive,
      hasCamera: context.cameraProxyPort !== null,
      cameraUrl,
      createdAt: context.createdAt.toISOString(),
      lastActivity: context.lastActivity.toISOString()
    };
  }

  /**
   * Set active spool for a context
   * Delegates to SpoolmanIntegrationService for persistence
   *
   * @param contextId - Context ID (defaults to active context if not provided)
   * @param spoolData - Active spool data (null to clear)
   * @deprecated Use SpoolmanIntegrationService.setActiveSpool() or clearActiveSpool() directly
   */
  public async setActiveSpool(contextId: string | undefined, spoolData: ActiveSpoolData | null): Promise<void> {
    try {
      const { getSpoolmanIntegrationService } = await import('../services/SpoolmanIntegrationService.js');
      const service = getSpoolmanIntegrationService();

      if (spoolData) {
        await service.setActiveSpool(contextId, spoolData);
      } else {
        await service.clearActiveSpool(contextId);
      }
    } catch (error) {
      console.error('[PrinterContextManager] Failed to set active spool:', error);
      throw error;
    }
  }

  /**
   * Get active spool for a context
   * Delegates to SpoolmanIntegrationService for consistency
   *
   * @param contextId - Context ID (defaults to active context if not provided)
   * @returns Active spool data or null if no spool selected
   * @deprecated Use SpoolmanIntegrationService.getActiveSpool() directly
   */
  public getActiveSpool(contextId?: string): ActiveSpoolData | null {
    try {
      const service = getSpoolmanIntegrationService();
      return service.getActiveSpool(contextId);
    } catch {
      // Service not initialized yet - return null during early initialization
      return null;
    }
  }

  /**
   * Get active spool ID for a context
   * Delegates to SpoolmanIntegrationService for consistency
   *
   * @param contextId - Context ID (defaults to active context if not provided)
   * @returns Active spool ID or null if no spool selected
   * @deprecated Use SpoolmanIntegrationService.getActiveSpool() and access .id directly
   */
  public getActiveSpoolId(contextId?: string): number | null {
    const spoolData = this.getActiveSpool(contextId);
    return spoolData?.id || null;
  }

  /**
   * Reset manager state (for testing or app reset)
   * WARNING: Does not clean up context resources - caller must handle cleanup
   */
  public reset(): void {
    this.contexts.clear();
    this.activeContextId = null;
    this.contextIdCounter = 0;
    console.log('[PrinterContextManager] Reset to initial state');
  }
}

/**
 * Get singleton instance of PrinterContextManager
 * Convenience function for imports
 */
export function getPrinterContextManager(): PrinterContextManagerInstance {
  return PrinterContextManager.getInstance();
}

