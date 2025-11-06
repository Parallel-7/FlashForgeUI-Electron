/**
 * @fileoverview Multi-context notification coordinator for managing notifications across multiple printer contexts.
 *
 * This service manages per-context PrinterNotificationCoordinator instances, ensuring that
 * each connected printer gets its own notification coordinator that monitors its state
 * independently. Notifications are sent for ALL connected printers regardless of which
 * context is currently active in the UI.
 *
 * Key Features:
 * - Creates notification coordinator for each printer context
 * - Connects coordinators to their respective polling services
 * - Ensures notifications work for all printers simultaneously
 * - Handles coordinator cleanup when contexts are removed
 * - Integrates with headless mode detection
 *
 * Architecture:
 * - Maps context IDs to PrinterNotificationCoordinator instances
 * - Listens to PrinterContextManager events for context lifecycle
 * - Shares single NotificationService instance across all coordinators
 * - Independent notification state per printer context
 *
 * Usage:
 * ```typescript
 * const coordinator = getMultiContextNotificationCoordinator();
 *
 * // Coordinators are created automatically when contexts are created
 * // and polling services are attached
 * ```
 *
 * @module services/MultiContextNotificationCoordinator
 */

import { EventEmitter } from 'events';
import { getPrinterContextManager } from '../managers/PrinterContextManager';
import { getNotificationService, NotificationService } from './notifications/NotificationService';
import { PrinterNotificationCoordinator } from './notifications/PrinterNotificationCoordinator';
import type { PrinterPollingService } from './PrinterPollingService';

/**
 * Manages notification coordinators for all printer contexts
 */
export class MultiContextNotificationCoordinator extends EventEmitter {
  private readonly coordinators = new Map<string, PrinterNotificationCoordinator>();
  private readonly notificationService: NotificationService;
  private isInitialized = false;

  constructor() {
    super();
    this.notificationService = getNotificationService();
  }

  /**
   * Initialize the multi-context notification coordinator
   * Sets up event listeners for context lifecycle events
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[MultiContextNotificationCoordinator] Already initialized');
      return;
    }

    const contextManager = getPrinterContextManager();

    // Listen for context removal to cleanup coordinators
    contextManager.on('context-removed', (event: unknown) => {
      const removeEvent = event as { contextId: string };
      this.removeCoordinatorForContext(removeEvent.contextId);
    });

    this.isInitialized = true;
    console.log('[MultiContextNotificationCoordinator] Initialized');
  }

  /**
   * Create and configure notification coordinator for a context
   * Called when polling service is ready for a context
   *
   * @param contextId - Context ID to create coordinator for
   * @param pollingService - Polling service to attach to coordinator
   */
  public createCoordinatorForContext(contextId: string, pollingService: PrinterPollingService): void {
    // Check if coordinator already exists
    if (this.coordinators.has(contextId)) {
      console.warn(`[MultiContextNotificationCoordinator] Coordinator already exists for context ${contextId}`);
      return;
    }

    // Create new coordinator for this context
    const coordinator = new PrinterNotificationCoordinator(this.notificationService);

    // Connect polling service to coordinator
    coordinator.setPollingService(pollingService);

    // Store coordinator
    this.coordinators.set(contextId, coordinator);

    // Update context manager reference
    const contextManager = getPrinterContextManager();
    contextManager.updateNotificationCoordinator(contextId, coordinator);

    console.log(`[MultiContextNotificationCoordinator] Created coordinator for context ${contextId}`);

    // Emit event
    this.emit('coordinator-created', { contextId });
  }

  /**
   * Remove and dispose coordinator for a context
   * Called when context is removed
   *
   * @param contextId - Context ID to remove coordinator for
   */
  private removeCoordinatorForContext(contextId: string): void {
    const coordinator = this.coordinators.get(contextId);
    if (!coordinator) {
      return;
    }

    // Dispose coordinator
    coordinator.dispose();

    // Remove from map
    this.coordinators.delete(contextId);

    // Update context manager reference
    const contextManager = getPrinterContextManager();
    contextManager.updateNotificationCoordinator(contextId, null);

    console.log(`[MultiContextNotificationCoordinator] Removed coordinator for context ${contextId}`);

    // Emit event
    this.emit('coordinator-removed', { contextId });
  }

  /**
   * Get coordinator for a specific context
   *
   * @param contextId - Context ID
   * @returns Coordinator instance or undefined
   */
  public getCoordinator(contextId: string): PrinterNotificationCoordinator | undefined {
    return this.coordinators.get(contextId);
  }

  /**
   * Get all active coordinators
   *
   * @returns Array of all coordinator instances
   */
  public getAllCoordinators(): PrinterNotificationCoordinator[] {
    return Array.from(this.coordinators.values());
  }

  /**
   * Get number of active coordinators
   *
   * @returns Count of coordinators
   */
  public getCoordinatorCount(): number {
    return this.coordinators.size;
  }

  /**
   * Dispose all coordinators and cleanup
   */
  public dispose(): void {
    console.log('[MultiContextNotificationCoordinator] Disposing all coordinators...');

    // Dispose all coordinators
    for (const [contextId, coordinator] of this.coordinators) {
      coordinator.dispose();
      console.log(`[MultiContextNotificationCoordinator] Disposed coordinator for context ${contextId}`);
    }

    // Clear map
    this.coordinators.clear();

    // Remove all event listeners
    this.removeAllListeners();

    this.isInitialized = false;
    console.log('[MultiContextNotificationCoordinator] Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global multi-context notification coordinator instance
 */
let globalMultiContextNotificationCoordinator: MultiContextNotificationCoordinator | null = null;

/**
 * Get global multi-context notification coordinator instance
 */
export function getMultiContextNotificationCoordinator(): MultiContextNotificationCoordinator {
  if (!globalMultiContextNotificationCoordinator) {
    globalMultiContextNotificationCoordinator = new MultiContextNotificationCoordinator();
  }
  return globalMultiContextNotificationCoordinator;
}

/**
 * Reset global multi-context notification coordinator (for testing)
 */
export function resetMultiContextNotificationCoordinator(): void {
  if (globalMultiContextNotificationCoordinator) {
    globalMultiContextNotificationCoordinator.dispose();
    globalMultiContextNotificationCoordinator = null;
  }
}

