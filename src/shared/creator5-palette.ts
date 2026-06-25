/**
 * @fileoverview Creator 5 / Creator 5 Pro material/color palette (firmware-confirmed).
 *
 * The Creator 5 series does NOT reuse the AD5X palette. Ghidra RE of `firmwareExe`
 * (C5 Pro 1.7.8, cross-checked byte-identical in 1.9.2) shows its own newer 24-color
 * picker palette (the authoritative `#RRGGBB` string table loaded by C++ static init,
 * matching live `/detail` output — e.g. a slot reported `#4CAAF8`) and an expanded
 * 21-material list. Every color differs from the AD5X equivalent except pure white,
 * so reusing the AD5X palette would snap to slightly-wrong values.
 *
 * The matching machinery is shared from `palette-core.ts` ({@link Palette}); only the
 * data below differs. Swatch names are assigned by positional analogy to the AD5X
 * palette (the hue progression is identical); the firmware stores hex values only.
 *
 * Source: `workspace/creator5-analysis/11-creator5-filament-palette.md`.
 *
 * @module shared/creator5-palette
 */

import { Palette, type PaletteColor } from './palette-core.js';

/**
 * The 21 materials the Creator 5 UI renders (firmware order, `0x00b28fec`+).
 * New vs the AD5X 14: ASA, S-PAHT, S-Multi, HIPS, PVA, and three TPU durometers
 * (TPU-90A / TPU-95A / TPU-64D — the AD5X's single generic "TPU" is absent here).
 */
export const CREATOR5_MATERIALS: readonly string[] = [
  'PLA', 'PETG', 'PLA-CF', 'PETG-CF', 'ABS', 'ASA', 'SILK', 'PET-CF',
  'PAHT-CF', 'S-PAHT', 'S-Multi', 'PA-CF', 'HIPS', 'PVA', 'TPU-90A',
  'TPU-95A', 'TPU-64D', 'PC', 'PA', 'PC-ABS', 'PPS-CF',
];

/**
 * The 24 colors the Creator 5 UI renders (authoritative `#RRGGBB` table,
 * firmware order, `0x00b290e4`+). Values differ from every AD5X swatch except White.
 */
export const CREATOR5_COLORS: readonly PaletteColor[] = [
  { name: 'White', hex: '#FFFFFF' }, { name: 'Yellow', hex: '#FFF245' },
  { name: 'Light Green', hex: '#DEF578' }, { name: 'Green', hex: '#21CC3D' },
  { name: 'Dark Green', hex: '#167A4B' }, { name: 'Teal', hex: '#156682' },
  { name: 'Cyan', hex: '#24E4A0' }, { name: 'Light Blue', hex: '#7BD9F0' },
  { name: 'Blue', hex: '#4CAAF8' }, { name: 'Dark Blue', hex: '#2E54DD' },
  { name: 'Purple', hex: '#48358C' }, { name: 'Violet', hex: '#A341F7' },
  { name: 'Magenta', hex: '#F435F6' }, { name: 'Pink', hex: '#D5B4DE' },
  { name: 'Coral', hex: '#FA6173' }, { name: 'Red', hex: '#F82D29' },
  { name: 'Brown', hex: '#805003' }, { name: 'Orange', hex: '#F9903B' },
  { name: 'Cream', hex: '#FCEBD7' }, { name: 'Tan', hex: '#D5C5A1' },
  { name: 'Dark Brown', hex: '#B17C38' }, { name: 'Gray', hex: '#8C8C89' },
  { name: 'Light Gray', hex: '#BEBEBE' }, { name: 'Black', hex: '#1B1B1B' },
];

/** The Creator 5 / 5 Pro fixed palette (colors + materials + nearest-match helpers). */
export const CREATOR5_PALETTE = new Palette(CREATOR5_COLORS, CREATOR5_MATERIALS);
