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
 * Applies to printers with a material station (AD5X and the Creator 5 / 5 Pro);
 * the fixed palette is selected per-printer via `@shared/palette`.
 *
 * IPC Channels:
 * - `material:configure-slot` - Snap a Spoolman spool's material/color onto the
 *   printer's fixed palette and apply it to a slot via the printer's `msConfig_cmd`.
 * - `material:set-slot` - Apply an explicit material + color (already chosen from
 *   the fixed palette by the renderer) to a slot. Spoolman-independent.
 *
 * @module ipc/handlers/material-handlers
 */

import { getPaletteForModel } from '@shared/palette.js';
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
 * Request payload for `material:set-slot` — an explicit, Spoolman-independent
 * slot write. The renderer has already chosen `materialName`/`colorHex` from the
 * printer's fixed palette via the manual slot editor.
 */
interface SetSlotRequest {
  /** Target slot number (1-4). */
  slot: number;
  /** Material name to write (one of the printer's recognized materials). */
  materialName: string;
  /** Color hex to write (with or without leading "#"). */
  colorHex: string;
  /** Optional context ID; defaults to the active context. */
  contextId?: string;
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

      // Snap onto the printer's own fixed palette (the Creator 5 series uses a
      // different palette than the AD5X). Fall back to the AD5X palette if the
      // model can't be resolved.
      const modelType = backendManager.getBackendForContext(contextId)?.getCapabilities().modelType;
      const palette = getPaletteForModel(modelType);

      const snappedColor = palette.nearestColor(rawColor);
      if (!snappedColor) {
        return { success: false, error: `Could not interpret spool color "${rawColor}"`, spoolName };
      }

      // Resolve material: keep the slot's current material when unrecognized.
      const snappedMaterial = filament.material ? palette.nearestMaterial(filament.material) : null;

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

  // Manually set an AD5X slot's material + color (chosen from the fixed palette
  // in the renderer's slot editor). No Spoolman dependency.
  ipcMain.handle('material:set-slot', async (_event, request: SetSlotRequest): Promise<ConfigureSlotResult> => {
    try {
      const { slot, materialName, colorHex } = request;

      if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
        return { success: false, error: 'Invalid slot number (expected 1-4)' };
      }
      if (typeof materialName !== 'string' || materialName.trim() === '') {
        return { success: false, error: 'Material name is required' };
      }
      if (typeof colorHex !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(colorHex.trim())) {
        return { success: false, error: 'A valid 6-digit hex color is required' };
      }

      const contextManager = getPrinterContextManager();
      const contextId = request.contextId || contextManager.getActiveContextId();
      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      const material = materialName.trim();
      const hex = colorHex.trim();
      const result = await backendManager.configureMaterialSlot(contextId, slot, material, hex);

      if (!result.success) {
        return { success: false, error: result.error || 'Failed to configure slot', slot };
      }

      return { success: true, slot, material, colorHex: hex };
    } catch (error) {
      console.error('[MaterialHandlers] set-slot error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
