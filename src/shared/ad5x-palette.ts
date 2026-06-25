/**
 * @fileoverview AD5X IFS material/color palette (firmware-confirmed).
 *
 * The AD5X material-station UI renders a fixed set of 14 materials and 24 colors;
 * arbitrary values won't draw an icon. These are the AD5X-specific data; the
 * matching machinery lives in `palette-core.ts` ({@link Palette}). The Creator 5
 * series uses a different, newer palette — see `creator5-palette.ts`.
 *
 * The 14 materials, 24 colors, and matching algorithm are ported verbatim from the
 * validated reference implementation (`IfsPalette.kt`) and verified against all 24
 * swatches plus live-Spoolman fixtures.
 *
 * @module shared/ad5x-palette
 */

import { Palette, type PaletteColor } from './palette-core.js';

/** The 14 materials the AD5X UI renders (order matches the API docs). */
export const AD5X_MATERIALS: readonly string[] = [
  'PLA', 'PLA-CF', 'PETG', 'PETG-CF', 'ABS', 'TPU', 'SILK',
  'PA', 'PA-CF', 'PAHT-CF', 'PC', 'PC-ABS', 'PET-CF', 'PPS-CF',
];

/** The 24 colors the AD5X UI renders. */
export const AD5X_COLORS: readonly PaletteColor[] = [
  { name: 'White', hex: '#FFFFFF' }, { name: 'Yellow', hex: '#FEF043' },
  { name: 'Light Green', hex: '#DCF478' }, { name: 'Green', hex: '#0ACC38' },
  { name: 'Dark Green', hex: '#067749' }, { name: 'Teal', hex: '#0C6283' },
  { name: 'Cyan', hex: '#0DE2A0' }, { name: 'Light Blue', hex: '#75D9F3' },
  { name: 'Blue', hex: '#45A8F9' }, { name: 'Dark Blue', hex: '#2750E0' },
  { name: 'Purple', hex: '#46328E' }, { name: 'Violet', hex: '#A03CF7' },
  { name: 'Magenta', hex: '#F330F9' }, { name: 'Pink', hex: '#D4B0DC' },
  { name: 'Coral', hex: '#F95D73' }, { name: 'Red', hex: '#F72224' },
  { name: 'Brown', hex: '#7C4B00' }, { name: 'Orange', hex: '#F98D33' },
  { name: 'Cream', hex: '#FDEBD5' }, { name: 'Tan', hex: '#D3C4A3' },
  { name: 'Dark Brown', hex: '#AF7836' }, { name: 'Gray', hex: '#898989' },
  { name: 'Light Gray', hex: '#BCBCBC' }, { name: 'Black', hex: '#161616' },
];

/** The AD5X fixed palette (colors + materials + nearest-match helpers). */
export const AD5X_PALETTE = new Palette(AD5X_COLORS, AD5X_MATERIALS);
