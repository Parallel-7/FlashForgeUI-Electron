/**
 * @fileoverview Filament palette entry point — model → palette selection.
 *
 * Re-exports the palette base class / types and the per-model palettes, and
 * resolves which fixed palette applies to a given printer model. Consumers (the
 * material-station slot-editor UI and the material-config IPC handlers) should import from here
 * and call {@link getPaletteForModel} rather than hard-coding a model's palette.
 *
 * @module shared/palette
 */

import type { PrinterModelType } from './types/printer-backend/backend-operations.js';
import { AD5X_PALETTE } from './ad5x-palette.js';
import { CREATOR5_PALETTE } from './creator5-palette.js';
import type { Palette } from './palette-core.js';

export { Palette, type PaletteColor } from './palette-core.js';
export { AD5X_PALETTE, AD5X_COLORS, AD5X_MATERIALS } from './ad5x-palette.js';
export { CREATOR5_PALETTE, CREATOR5_COLORS, CREATOR5_MATERIALS } from './creator5-palette.js';

/**
 * Resolve the fixed filament palette for a printer model. The Creator 5 / 5 Pro
 * use their own newer palette; every other material-station printer (the AD5X)
 * uses the AD5X palette, which is also the safe default for an unknown/undefined
 * model.
 *
 * @param modelType Printer model type, or undefined when not yet known.
 * @returns The {@link Palette} to use for swatches and nearest-match snapping.
 */
export function getPaletteForModel(modelType: PrinterModelType | undefined | null): Palette {
  if (modelType === 'creator-5' || modelType === 'creator-5-pro') {
    return CREATOR5_PALETTE;
  }
  return AD5X_PALETTE;
}
