/**
 * @fileoverview Filament palette for the WebUI material-station slot editor.
 *
 * The WebUI static client compiles standalone (rootDir = static dir) and is served
 * as raw ES modules, so it cannot import the main/renderer `@shared/palette`. This
 * is a faithful local port of `src/shared/palette-core.ts` + `ad5x-palette.ts` +
 * `creator5-palette.ts`: FlashForge printers only render a fixed set of materials
 * and colors on their material station, so arbitrary Spoolman values must be
 * snapped to the nearest recognized swatch (CIEDE2000). The Creator 5 series uses a
 * different, newer palette than the AD5X — resolve per model via
 * {@link getPaletteForModel}.
 *
 * @module webui/static/shared/palette
 */

export interface PaletteColor {
  /** Human-readable swatch name, e.g. "Dark Blue". */
  name: string;
  /** Hex code with leading '#', e.g. "#2750E0". */
  hex: string;
}

type Lab = readonly [number, number, number];

function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 8) h = h.slice(0, 6); // drop alpha
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function hexToLab(hex: string): Lab | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = srgbToLinear(rgb[0]) * 100;
  const g = srgbToLinear(rgb[1]) * 100;
  const b = srgbToLinear(rgb[2]) * 100;
  const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

function hueDeg(b: number, ap: number): number {
  if (ap === 0 && b === 0) return 0;
  let h = deg(Math.atan2(b, ap));
  if (h < 0) h += 360;
  return h;
}

function ciede2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dtheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(rad(2 * dtheta)) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

function normalizeMaterial(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * A model's fixed filament palette: recognized colors + materials, plus the
 * nearest-match helpers that snap arbitrary input onto them. The matching behavior
 * is identical across models (data-only difference).
 */
export class Palette {
  public readonly colors: readonly PaletteColor[];
  public readonly materials: readonly string[];

  private readonly paletteLab: ReadonlyArray<{ color: PaletteColor; lab: Lab }>;
  private readonly materialNorm: ReadonlyMap<string, string>;

  constructor(colors: readonly PaletteColor[], materials: readonly string[]) {
    this.colors = colors;
    this.materials = materials;
    this.paletteLab = colors.map((color) => {
      const lab = hexToLab(color.hex);
      if (!lab) throw new Error(`Invalid palette hex: ${color.hex}`);
      return { color, lab };
    });
    this.materialNorm = new Map(materials.map((m) => [normalizeMaterial(m), m]));
  }

  /** Snap an arbitrary hex to the nearest palette swatch via CIEDE2000. */
  public nearestColor(hex: string): PaletteColor | null {
    const lab = hexToLab(hex);
    if (!lab) return null;
    let best: PaletteColor | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const entry of this.paletteLab) {
      const d = ciede2000(lab, entry.lab);
      if (d < bestD) {
        bestD = d;
        best = entry.color;
      }
    }
    return best;
  }

  /** Snap a raw material to a recognized material: exact, else leading token, else null. */
  public nearestMaterial(raw: string): string | null {
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    const exact = this.materialNorm.get(normalizeMaterial(raw));
    if (exact) return exact;
    const leading = raw.trim().split(/\s+/)[0];
    return this.materialNorm.get(normalizeMaterial(leading)) ?? null;
  }
}

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

/** The AD5X fixed palette. */
export const AD5X_PALETTE = new Palette(AD5X_COLORS, AD5X_MATERIALS);

/**
 * The 21 materials the Creator 5 UI renders (firmware order). New vs AD5X: ASA,
 * S-PAHT, S-Multi, HIPS, PVA, and three TPU durometers.
 */
export const CREATOR5_MATERIALS: readonly string[] = [
  'PLA', 'PETG', 'PLA-CF', 'PETG-CF', 'ABS', 'ASA', 'SILK', 'PET-CF',
  'PAHT-CF', 'S-PAHT', 'S-Multi', 'PA-CF', 'HIPS', 'PVA', 'TPU-90A',
  'TPU-95A', 'TPU-64D', 'PC', 'PA', 'PC-ABS', 'PPS-CF',
];

/** The 24 colors the Creator 5 UI renders (differ from every AD5X swatch except White). */
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

/** The Creator 5 / 5 Pro fixed palette. */
export const CREATOR5_PALETTE = new Palette(CREATOR5_COLORS, CREATOR5_MATERIALS);

/**
 * Resolve the fixed filament palette for a printer model. The Creator 5 / 5 Pro
 * use their own newer palette; every other material-station printer (the AD5X)
 * uses the AD5X palette, which is also the safe default for an unknown model.
 */
export function getPaletteForModel(modelType: string | undefined | null): Palette {
  if (modelType === 'creator-5' || modelType === 'creator-5-pro') {
    return CREATOR5_PALETTE;
  }
  return AD5X_PALETTE;
}
