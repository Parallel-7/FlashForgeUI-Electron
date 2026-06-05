/**
 * @fileoverview Tests for the AD5X IFS palette nearest-match helpers.
 *
 * Verifies the CIEDE2000 color snapping and material normalization in
 * `src/shared/ifs-palette.ts` against the full 24-swatch palette, a small
 * RGB neighborhood around each swatch, a curated set of known off-palette
 * colors (including cases a naive RGB/ΔE76 distance gets wrong), hex-format
 * variants, and the material mapping matrix. All fixtures are static; nothing
 * here contacts a Spoolman instance.
 *
 * @module shared/__tests__/ifs-palette
 */

import { IFS_COLORS, nearestColor, nearestMaterial } from '../ifs-palette.js';

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

describe('nearestColor', () => {
  describe('each swatch resolves to itself', () => {
    for (const swatch of IFS_COLORS) {
      it(`${swatch.name} (${swatch.hex}) -> ${swatch.name}`, () => {
        expect(nearestColor(swatch.hex)?.name).toBe(swatch.name);
      });
    }
  });

  describe('a +/-6 RGB neighborhood around each swatch snaps back to it', () => {
    const offsets = [-6, 0, 6];
    for (const swatch of IFS_COLORS) {
      const [r, g, b] = parseHex(swatch.hex);
      for (const dr of offsets) {
        for (const dg of offsets) {
          for (const db of offsets) {
            const hex = toHex(r + dr, g + dg, b + db);
            it(`${swatch.name} ${hex} -> ${swatch.name}`, () => {
              expect(nearestColor(hex)?.name).toBe(swatch.name);
            });
          }
        }
      }
    }
  });

  describe('saturated/obvious off-palette colors snap to the intuitive swatch', () => {
    // Pure primaries/secondaries plus neutrals — each has one obviously-correct
    // nearest palette swatch, guarding the basic sanity of the matcher.
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
        expect(nearestColor(hex)?.name).toBe(expected);
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
        expect(nearestColor(hex)?.name).toBe(expected);
      });
    }
  });

  describe('hex format variants', () => {
    it('accepts a hex without leading #', () => {
      expect(nearestColor('F72224')?.name).toBe('Red');
    });

    it('drops alpha from an RRGGBBAA hex', () => {
      expect(nearestColor('#F72224FF')?.name).toBe('Red');
    });

    it('expands #RGB shorthand', () => {
      // #F00 -> #FF0000 -> Red
      expect(nearestColor('#F00')?.name).toBe('Red');
    });

    it('returns null for an unparseable value', () => {
      expect(nearestColor('not-a-color')).toBeNull();
      expect(nearestColor('#12')).toBeNull();
      expect(nearestColor('')).toBeNull();
    });
  });
});

describe('nearestMaterial', () => {
  const cases: ReadonlyArray<[string, string | null]> = [
    ['PLA-CF', 'PLA-CF'],
    ['petg-cf', 'PETG-CF'],
    ['PLA+', 'PLA'],
    ['PLA Matte', 'PLA'],
    ['PETG-CF Pro', 'PETG-CF'],
    ['PCTG', null],
    ['PA6', null],
    ['Nylon', null],
  ];

  for (const [raw, expected] of cases) {
    it(`${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`, () => {
      expect(nearestMaterial(raw)).toBe(expected);
    });
  }

  it('returns null for empty or non-string input', () => {
    expect(nearestMaterial('')).toBeNull();
    expect(nearestMaterial('   ')).toBeNull();
    expect(nearestMaterial(undefined as unknown as string)).toBeNull();
  });
});
