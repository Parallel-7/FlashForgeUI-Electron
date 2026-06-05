/**
 * @fileoverview AD5X IFS material/color palette and nearest-match helpers.
 *
 * Pure, framework-agnostic module (no DOM/Electron deps) importable by both the
 * main and renderer processes. The AD5X printer only renders a fixed set of 14
 * materials and 24 colors on its material-station UI; arbitrary values won't draw
 * an icon. These helpers snap an arbitrary Spoolman material/color onto that fixed
 * palette:
 *
 * - {@link nearestColor} snaps a hex color to the nearest of the 24 swatches using
 *   CIEDE2000 distance (not plain ΔE76, which mismatches saturated blue/red regions).
 * - {@link nearestMaterial} snaps a raw material string to one of the 14 recognized
 *   materials via exact (normalized) match, else leading-token match, else null.
 *
 * The 14 materials, 24 colors, and matching algorithm are ported verbatim from the
 * validated reference implementation (`IfsPalette.kt`) and verified against all 24
 * swatches plus live-Spoolman fixtures.
 *
 * @module shared/ifs-palette
 */

export interface PaletteColor {
  /** Human-readable swatch name, e.g. "Dark Blue". */
  name: string;
  /** Hex code with leading '#', e.g. "#2750E0". */
  hex: string;
}

/** The 14 materials the AD5X UI renders (order matches the API docs). */
export const IFS_MATERIALS: readonly string[] = [
  'PLA', 'PLA-CF', 'PETG', 'PETG-CF', 'ABS', 'TPU', 'SILK',
  'PA', 'PA-CF', 'PAHT-CF', 'PC', 'PC-ABS', 'PET-CF', 'PPS-CF',
];

/** The 24 colors the AD5X UI renders. */
export const IFS_COLORS: readonly PaletteColor[] = [
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

type Lab = readonly [number, number, number];

function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 8) h = h.slice(0, 6); // drop alpha
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
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
  const Xn = 95.047, Yn = 100.0, Zn = 108.883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
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
  const T = 1 - 0.17 * Math.cos(rad(hbarp - 30)) + 0.24 * Math.cos(rad(2 * hbarp))
    + 0.32 * Math.cos(rad(3 * hbarp + 6)) - 0.2 * Math.cos(rad(4 * hbarp - 63));
  const dtheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(rad(2 * dtheta)) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

const PALETTE_LAB: ReadonlyArray<{ color: PaletteColor; lab: Lab }> = IFS_COLORS.map((color) => {
  const lab = hexToLab(color.hex);
  if (!lab) throw new Error(`Invalid palette hex: ${color.hex}`);
  return { color, lab };
});

/** Snap an arbitrary hex (#RRGGBB, RRGGBB, RRGGBBAA, or #RGB) to the nearest palette swatch via CIEDE2000. Returns null if unparseable. */
export function nearestColor(hex: string): PaletteColor | null {
  const lab = hexToLab(hex);
  if (!lab) return null;
  let best: PaletteColor | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const entry of PALETTE_LAB) {
    const d = ciede2000(lab, entry.lab);
    if (d < bestD) { bestD = d; best = entry.color; }
  }
  return best;
}

function normalizeMaterial(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
const MATERIAL_NORM = new Map<string, string>(IFS_MATERIALS.map((m) => [normalizeMaterial(m), m]));

/** Snap a raw Spoolman material to a recognized material: exact (normalized) match, else leading-token match, else null (caller keeps current slot material). */
export function nearestMaterial(raw: string): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const exact = MATERIAL_NORM.get(normalizeMaterial(raw));
  if (exact) return exact;
  const leading = raw.trim().split(/\s+/)[0];
  return MATERIAL_NORM.get(normalizeMaterial(leading)) ?? null;
}
