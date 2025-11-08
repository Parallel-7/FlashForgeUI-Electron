/**
 * @fileoverview Multi-context coordinator for print state monitoring services.
 *
 * Manages PrintStateMonitor instances across multiple printer contexts, ensuring
 * each printer connection has its own isolated state monitoring instance.
 *
 * Key Responsibilities:
 * - Create PrintStateMonitor instances for new printer contexts
 * - Destroy monitors when contexts are removed
 * - Provide access to monitors by context ID
 * - Maintain lifecycle and cleanup for all monitors
 *
 * @exports MultiContextPrintStateMonitor - Multi-context state monitor coordinator
 */

import { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterPollingService } from './PrinterPollingService';

/**
 * Multi-context coordinator for print state monitoring
 * Manages per-context PrintStateMonitor instances
 */
export class MultiContextPrintStateMonitor {
  private monitors: Map<string, PrintStateMonitor> = new Map();

  /**
   * Create a print state monitor for a specific context
   */
  public createMonitorForContext(
    contextId: string,
    pollingService: PrinterPollingService
  ): void {
    // Check if monitor already exists
    if (this.monitors.has(contextId)) {
      console.warn(`[MultiContextPrintStateMonitor] Monitor already exists for context ${contextId}`);
      return;
    }

    // Create new monitor
    const monitor = new PrintStateMonitor(contextId);
    monitor.setPollingService(pollingService);

    // Store monitor
    this.monitors.set(contextId, monitor);

    console.log(`[MultiContextPrintStateMonitor] Created monitor for context ${contextId}`);
  }

  /**
   * Get print state monitor for a specific context
   */
  public getMonitor(contextId: string): PrintStateMonitor | undefined {
    return this.monitors.get(contextId);
  }

  /**
   * Check if monitor exists for context
   */
  public hasMonitor(contextId: string): boolean {
    return this.monitors.has(contextId);
  }

  /**
   * Destroy monitor for a specific context
   */
  public destroyMonitor(contextId: string): void {
    const monitor = this.monitors.get(contextId);

    if (monitor) {
      monitor.dispose();
      this.monitors.delete(contextId);
      console.log(`[MultiContextPrintStateMonitor] Destroyed monitor for context ${contextId}`);
    }
  }

  /**
   * Get all monitors (for debugging/testing)
   */
  public getAllMonitors(): Map<string, PrintStateMonitor> {
    return new Map(this.monitors);
  }

  /**
   * Get count of active monitors
   */
  public getMonitorCount(): number {
    return this.monitors.size;
  }

  /**
   * Dispose all monitors
   */
  public dispose(): void {
    console.log('[MultiContextPrintStateMonitor] Disposing all monitors');

    for (const [contextId, monitor] of this.monitors) {
      monitor.dispose();
      console.log(`[MultiContextPrintStateMonitor] Disposed monitor for context ${contextId}`);
    }

    this.monitors.clear();
  }
}

// Singleton instance
let instance: MultiContextPrintStateMonitor | null = null;

/**
 * Get singleton instance of MultiContextPrintStateMonitor
 */
export function getMultiContextPrintStateMonitor(): MultiContextPrintStateMonitor {
  if (!instance) {
    instance = new MultiContextPrintStateMonitor();
  }
  return instance;
}
