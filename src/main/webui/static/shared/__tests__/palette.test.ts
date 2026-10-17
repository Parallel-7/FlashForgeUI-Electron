/**
 * @fileoverview Sanity coverage for the WebUI-local filament palette port,
 * guarding the per-model selection and nearest-match snapping used by the
 * material-station slot editor.
 */

import {
  AD5X_PALETTE,
  CREATOR5_PALETTE,
  getPaletteForModel,
} from '../palette.js';

describe('webui palette', () => {
  it('selects the Creator 5 palette for creator-5 models and AD5X otherwise', () => {
    expect(getPaletteForModel('creator-5')).toBe(CREATOR5_PALETTE);
    expect(getPaletteForModel('creator-5-pro')).toBe(CREATOR5_PALETTE);
    expect(getPaletteForModel('ad5x')).toBe(AD5X_PALETTE);
    expect(getPaletteForModel(undefined)).toBe(AD5X_PALETTE);
    expect(getPaletteForModel(null)).toBe(AD5X_PALETTE);
  });

  it('exposes 24 colors for both models with distinct blues', () => {
    expect(AD5X_PALETTE.colors).toHaveLength(24);
    expect(CREATOR5_PALETTE.colors).toHaveLength(24);
    // The Creator 5 blue differs from the AD5X blue (every color but White differs).
    const ad5xBlue = AD5X_PALETTE.colors.find((c) => c.name === 'Blue')?.hex;
    const c5Blue = CREATOR5_PALETTE.colors.find((c) => c.name === 'Blue')?.hex;
    expect(ad5xBlue).not.toEqual(c5Blue);
  });

  it('snaps an exact swatch hex to itself', () => {
    expect(AD5X_PALETTE.nearestColor('#FFFFFF')?.name).toBe('White');
    expect(AD5X_PALETTE.nearestColor('#F72224')?.name).toBe('Red');
    expect(CREATOR5_PALETTE.nearestColor('#4CAAF8')?.name).toBe('Blue');
  });

  it('snaps materials by exact then leading-token match', () => {
    expect(AD5X_PALETTE.nearestMaterial('PLA')).toBe('PLA');
    expect(AD5X_PALETTE.nearestMaterial('pla+')).toBe('PLA');
    expect(AD5X_PALETTE.nearestMaterial('PLA Silk')).toBe('PLA');
    expect(CREATOR5_PALETTE.nearestMaterial('ASA')).toBe('ASA');
    expect(AD5X_PALETTE.nearestMaterial('Unobtanium')).toBeNull();
  });
});
