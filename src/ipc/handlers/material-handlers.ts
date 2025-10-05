/**
 * @fileoverview Material station IPC handlers for material management operations.
 *
 * Provides IPC handlers for material station operations on AD5X printers:
 * - Material station status monitoring (currently via centralized polling)
 * - Future material control operations (slot selection, eject, load)
 * - Material information queries
 *
 * Key exports:
 * - registerMaterialHandlers(): Registers material station IPC handlers
 *
 * Note: Material station status is currently provided through the centralized polling system
 * via MainProcessPollingCoordinator and the 'polling-update' IPC channel. This module serves
 * as a placeholder for future direct material control operations when implemented.
 *
 * Planned future handlers:
 * - set-active-material-slot: Change active material slot
 * - eject-material: Eject filament from slot
 * - load-material: Load filament into slot
 * - get-material-info: Query detailed material information
 */

import type { PrinterBackendManager } from '../../managers/PrinterBackendManager';

/**
 * Register all material station related IPC handlers
 */
export function registerMaterialHandlers(_backendManager: PrinterBackendManager): void {
  // Note: Material station status is now included in the centralized polling updates
  // from MainProcessPollingCoordinator via the 'polling-update' IPC channel

  // TODO: Add material station control handlers here when implemented
  // Examples:
  // - set-active-material-slot
  // - eject-material
  // - load-material
  // - get-material-info
}
