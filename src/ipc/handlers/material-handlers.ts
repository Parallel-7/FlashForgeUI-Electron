/**
 * Material station related IPC handlers.
 * Handles material station status requests and future material control operations.
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
