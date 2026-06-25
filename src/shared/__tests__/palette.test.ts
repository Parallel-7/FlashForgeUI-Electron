/**
 * @fileoverview Tests for the filament palette base class and per-model palettes.
 *
 * Verifies the shared CIEDE2000 color snapping and material normalization in
 * `palette-core.ts` against BOTH firmware-confirmed palettes (AD5X and Creator 5):
 * the full 24-swatch self-match, a small RGB neighborhood around each swatch, a
 * curated set of known off-palette colors (including cases a naive RGB/ΔE76
 * distance gets wrong), hex-format variants, and each model's material matrix.
 * Also checks `getPaletteForModel` selection and that the two palettes really
 * differ. All fixtures are static; nothing here contacts a Spoolman instance.
 *
 * @module shared/__tests__/palette
 */

import { AD5X_COLORS, AD5X_MATERIALS, AD5X_PALETTE } from '../ad5x-palette.js';
import { CREATOR5_COLORS, CREATOR5_MATERIALS, CREATOR5_PALETTE } from '../creator5-palette.js';
import type { Palette } from '../palette-core.js';
import { getPaletteForModel } from '../palette.js';

/** Build a #RRGGBB hex from clamped RGB components. */
function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, n));
  const part = (n: number): string => clamp(n).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Color-matching suite that should pass identically for every model's palette. */
function describeColorMatching(label: string, palette: Palette): void {
  describe(`${label} — nearestColor`, () => {
    describe('each swatch resolves to itself', () => {
      for (const swatch of palette.colors) {
        it(`${swatch.name} (${swatch.hex}) -> ${swatch.name}`, () => {
          expect(palette.nearestColor(swatch.hex)?.name).toBe(swatch.name);
        });
      }
    });

    describe('a +/-6 RGB neighborhood around each swatch snaps back to it', () => {
      const offsets = [-6, 0, 6];
      for (const swatch of palette.colors) {
        const [r, g, b] = parseHex(swatch.hex);
        for (const dr of offsets) {
          for (const dg of offsets) {
            for (const db of offsets) {
              const hex = toHex(r + dr, g + dg, b + db);
              it(`${swatch.name} ${hex} -> ${swatch.name}`, () => {
                expect(palette.nearestColor(hex)?.name).toBe(swatch.name);
              });
            }
          }
        }
      }
    });

    describe('saturated/obvious off-palette colors snap to the intuitive swatch', () => {
      // Pure primaries/secondaries plus neutrals — each has one obviously-correct
      // nearest palette swatch by NAME (both palettes share swatch names).
      const fixtures: ReadonlyArray<[string, string]> = [
        ['#FF0000', 'Red'],
        ['#00FF00', 'Green'],
        ['#FFFF00', 'Yellow'],
        ['#00FFFF', 'Light Blue'],
        ['#FF00FF', 'Magenta'],
        ['#FFA500', 'Orange'], // CSS "orange"
        ['#FFFFFF', 'White'],
        ['#000000', 'Black'],
        ['#808080', 'Gray'], // mid-grey
      ];
      for (const [hex, expected] of fixtures) {
        it(`${hex} -> ${expected}`, () => {
          expect(palette.nearestColor(hex)?.name).toBe(expected);
        });
      }
    });

    describe('perceptual edge cases a naive RGB/ΔE76 distance gets wrong', () => {
      // The cases that motivate CIEDE2000 over a plain Lab/RGB distance: ΔE76
      // mis-snaps pure blue to Violet and burgundy to Coral; CIEDE2000 maps them
      // to Dark Blue and Red as a human would.
      const fixtures: ReadonlyArray<[string, string]> = [
        ['#0000FF', 'Dark Blue'], // ΔE76 picks Violet
        ['#951e23', 'Red'], // burgundy — ΔE76 picks Coral
        ['#6c4f4c', 'Brown'], // muted warm grey-brown
      ];
      for (const [hex, expected] of fixtures) {
        it(`${hex} -> ${expected}`, () => {
          expect(palette.nearestColor(hex)?.name).toBe(expected);
        });
      }
    });

    describe('hex format variants', () => {
      it('accepts a hex without leading #', () => {
        expect(palette.nearestColor('FF0000')?.name).toBe('Red');
      });
      it('drops alpha from an RRGGBBAA hex', () => {
        expect(palette.nearestColor('#FF0000FF')?.name).toBe('Red');
      });
      it('expands #RGB shorthand', () => {
        expect(palette.nearestColor('#F00')?.name).toBe('Red');
      });
      it('returns null for an unparseable value', () => {
        expect(palette.nearestColor('not-a-color')).toBeNull();
        expect(palette.nearestColor('#12')).toBeNull();
        expect(palette.nearestColor('')).toBeNull();
      });
    });
  });
}

describeColorMatching('AD5X', AD5X_PALETTE);
describeColorMatching('Creator 5', CREATOR5_PALETTE);

describe('AD5X — nearestMaterial', () => {
  const cases: ReadonlyArray<[string, string | null]> = [
    ['PLA-CF', 'PLA-CF'],
    ['petg-cf', 'PETG-CF'],
    ['PLA+', 'PLA'],
    ['PLA Matte', 'PLA'],
    ['PETG-CF Pro', 'PETG-CF'],
    ['TPU', 'TPU'], // AD5X has a generic TPU
    ['ASA', null], // ASA is Creator-5-only
    ['PCTG', null],
    ['Nylon', null],
  ];
  for (const [raw, expected] of cases) {
    it(`${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`, () => {
      expect(AD5X_PALETTE.nearestMaterial(raw)).toBe(expected);
    });
  }
});

describe('Creator 5 — nearestMaterial', () => {
  const cases: ReadonlyArray<[string, string | null]> = [
    ['PLA-CF', 'PLA-CF'],
    ['ASA', 'ASA'], // new on the Creator 5
    ['asa pro', 'ASA'],
    ['S-Multi', 'S-Multi'],
    ['TPU-95A', 'TPU-95A'],
    ['PVA', 'PVA'],
    ['TPU', null], // generic TPU is absent on the Creator 5 (only durometer variants)
    ['Nylon', null],
  ];
  for (const [raw, expected] of cases) {
    it(`${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`, () => {
      expect(CREATOR5_PALETTE.nearestMaterial(raw)).toBe(expected);
    });
  }

  it('returns null for empty or non-string input', () => {
    expect(CREATOR5_PALETTE.nearestMaterial('')).toBeNull();
    expect(CREATOR5_PALETTE.nearestMaterial('   ')).toBeNull();
    expect(CREATOR5_PALETTE.nearestMaterial(undefined as unknown as string)).toBeNull();
  });
});

describe('palette shape & selection', () => {
  it('both palettes expose 24 colors', () => {
    expect(AD5X_COLORS).toHaveLength(24);
    expect(CREATOR5_COLORS).toHaveLength(24);
  });

  it('AD5X has 14 materials, Creator 5 has 21', () => {
    expect(AD5X_MATERIALS).toHaveLength(14);
    expect(CREATOR5_MATERIALS).toHaveLength(21);
  });

  it('the two palettes really differ (Creator 5 is not the AD5X palette)', () => {
    // Same names, different values — e.g. "Blue".
    const ad5xBlue = AD5X_COLORS.find((c) => c.name === 'Blue')?.hex;
    const c5Blue = CREATOR5_COLORS.find((c) => c.name === 'Blue')?.hex;
    expect(ad5xBlue).toBe('#45A8F9');
    expect(c5Blue).toBe('#4CAAF8');
    expect(c5Blue).not.toBe(ad5xBlue);
  });

  it('getPaletteForModel routes Creator 5 models to the C5 palette, others to AD5X', () => {
    expect(getPaletteForModel('creator-5')).toBe(CREATOR5_PALETTE);
    expect(getPaletteForModel('creator-5-pro')).toBe(CREATOR5_PALETTE);
    expect(getPaletteForModel('ad5x')).toBe(AD5X_PALETTE);
    expect(getPaletteForModel('adventurer-5m')).toBe(AD5X_PALETTE);
    expect(getPaletteForModel(undefined)).toBe(AD5X_PALETTE);
    expect(getPaletteForModel(null)).toBe(AD5X_PALETTE);
  });
});
