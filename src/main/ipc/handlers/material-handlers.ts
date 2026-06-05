/**
 * @fileoverview Material station IPC handlers for material management operations.
 *
 * Provides IPC handlers for material station control operations on AD5X printers.
 * Material station *status* is delivered through the centralized polling system
 * (MainProcessPollingCoordinator -> 'polling-update'); this module hosts the
 * write-side control operations.
 *
 * Key exports:
 * - registerMaterialHandlers(): Registers material station IPC handlers
 *
 * IPC Channels:
 * - `material:configure-slot` - Snap a Spoolman spool's material/color onto the
 *   AD5X fixed palette and apply it to a slot via the printer's `msConfig_cmd`.
 *
 * @module ipc/handlers/material-handlers
 */

import { nearestColor, nearestMaterial } from '@shared/ifs-palette.js';
import { ipcMain } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager.js';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { SpoolmanService } from '../../services/SpoolmanService.js';

/**
 * Request payload for `material:configure-slot`.
 */
interface ConfigureSlotRequest {
  /** Target slot number (1-4). */
  slot: number;
  /** Spoolman spool ID whose material/color should be applied. */
  spoolId: number;
  /** Optional context ID; defaults to the active context. */
  contextId?: string;
}

/**
 * Result returned to the renderer after a slot-configuration attempt.
 */
interface ConfigureSlotResult {
  success: boolean;
  error?: string;
  /** Slot that was configured (1-4). */
  slot?: number;
  /** Recognized material applied, or null if the slot's material was preserved. */
  material?: string | null;
  /** Snapped palette color name (e.g. "Red"). */
  colorName?: string;
  /** Snapped palette color hex (e.g. "#F72224"). */
  colorHex?: string;
  /** Source spool display name, for the confirmation message. */
  spoolName?: string;
}

/**
 * Register all material station related IPC handlers
 */
export function registerMaterialHandlers(backendManager: PrinterBackendManager): void {
  // Configure an AD5X slot from a Spoolman spool: snap material + color, then apply.
  ipcMain.handle('material:configure-slot', async (_event, request: ConfigureSlotRequest): Promise<ConfigureSlotResult> => {
    try {
      const { slot, spoolId } = request;

      if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
        return { success: false, error: 'Invalid slot number (expected 1-4)' };
      }

      if (!Number.isInteger(spoolId) || spoolId < 0) {
        return { success: false, error: 'Invalid spool ID' };
      }

      // Resolve the target context.
      const contextManager = getPrinterContextManager();
      const contextId = request.contextId || contextManager.getActiveContextId();
      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      // Validate Spoolman configuration.
      const config = getConfigManager().getConfig();
      if (!config.SpoolmanEnabled) {
        return { success: false, error: 'Spoolman integration is disabled' };
      }
      if (!config.SpoolmanServerUrl) {
        return { success: false, error: 'Spoolman server URL not configured' };
      }

      // Fetch the full spool so we can apply the color fallback logic.
      const service = new SpoolmanService(config.SpoolmanServerUrl);
      const spool = await service.getSpoolById(spoolId);
      const filament = spool.filament;
      const spoolName = filament.name || `Spool ${spoolId}`;

      // Resolve color: prefer color_hex, fall back to the first multi_color_hexes entry.
      const rawColor =
        filament.color_hex || filament.multi_color_hexes?.split(',')[0]?.trim() || null;
      if (!rawColor) {
        return { success: false, error: 'Spool has no color in Spoolman', spoolName };
      }

      const snappedColor = nearestColor(rawColor);
      if (!snappedColor) {
        return { success: false, error: `Could not interpret spool color "${rawColor}"`, spoolName };
      }

      // Resolve material: keep the slot's current material when unrecognized.
      const snappedMaterial = filament.material ? nearestMaterial(filament.material) : null;

      let materialToApply = snappedMaterial;
      if (!materialToApply) {
        // Preserve the slot's current material rather than writing an unrecognized string.
        const station = backendManager.getMaterialStationStatus(contextId);
        const currentSlot = station?.slots.find((s) => s.slotId === slot);
        materialToApply = currentSlot?.materialType ?? null;
      }

      if (!materialToApply) {
        return {
          success: false,
          error: 'Spool material is not recognized and the slot has no current material to keep',
          spoolName,
          colorName: snappedColor.name,
          colorHex: snappedColor.hex,
        };
      }

      const result = await backendManager.configureMaterialSlot(
        contextId,
        slot,
        materialToApply,
        snappedColor.hex
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to configure slot',
          slot,
          material: snappedMaterial,
          colorName: snappedColor.name,
          colorHex: snappedColor.hex,
          spoolName,
        };
      }

      return {
        success: true,
        slot,
        material: materialToApply,
        colorName: snappedColor.name,
        colorHex: snappedColor.hex,
        spoolName,
      };
    } catch (error) {
      console.error('[MaterialHandlers] configure-slot error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
