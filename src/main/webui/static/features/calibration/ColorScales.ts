/**
 * @fileoverview Color scale utilities for heatmap visualization (WebUI copy).
 * Browser-pure port of src/renderer/src/ui/calibration/visualization/ColorScales.ts
 * for the static WebUI client (which cannot import renderer modules).
 * Supports multiple color schemes: viridis, plasma, inferno, coolwarm.
 */

/** RGB color tuple. */
export type RGB = [number, number, number];

/** Available color scheme names. */
export type ColorScheme = 'viridis' | 'plasma' | 'inferno' | 'coolwarm';

/** Color stop definition for gradient. */
export interface ColorStop {
  position: number;
  color: RGB;
}

const VIRIDIS_STOPS: ColorStop[] = [
  { position: 0.0, color: [68, 1, 84] },
  { position: 0.1, color: [72, 40, 120] },
  { position: 0.2, color: [62, 74, 137] },
  { position: 0.3, color: [49, 104, 142] },
  { position: 0.4, color: [38, 130, 142] },
  { position: 0.5, color: [31, 158, 137] },
  { position: 0.6, color: [53, 183, 121] },
  { position: 0.7, color: [109, 205, 89] },
  { position: 0.8, color: [180, 222, 44] },
  { position: 0.9, color: [223, 227, 24] },
  { position: 1.0, color: [253, 231, 37] },
];

const PLASMA_STOPS: ColorStop[] = [
  { position: 0.0, color: [13, 8, 135] },
  { position: 0.1, color: [75, 3, 161] },
  { position: 0.2, color: [125, 3, 168] },
  { position: 0.3, color: [168, 34, 150] },
  { position: 0.4, color: [203, 70, 121] },
  { position: 0.5, color: [229, 107, 93] },
  { position: 0.6, color: [248, 148, 65] },
  { position: 0.7, color: [253, 195, 40] },
  { position: 0.8, color: [240, 249, 33] },
  { position: 1.0, color: [240, 249, 33] },
];

const INFERNO_STOPS: ColorStop[] = [
  { position: 0.0, color: [0, 0, 4] },
  { position: 0.1, color: [40, 11, 84] },
  { position: 0.2, color: [89, 13, 115] },
  { position: 0.3, color: [137, 27, 100] },
  { position: 0.4, color: [181, 50, 64] },
  { position: 0.5, color: [219, 87, 26] },
  { position: 0.6, color: [244, 130, 7] },
  { position: 0.7, color: [252, 180, 31] },
  { position: 0.8, color: [250, 230, 102] },
  { position: 1.0, color: [252, 255, 164] },
];

const COOLWARM_STOPS: ColorStop[] = [
  { position: 0.0, color: [59, 76, 192] },
  { position: 0.1, color: [98, 130, 234] },
  { position: 0.2, color: [141, 176, 254] },
  { position: 0.3, color: [184, 208, 249] },
  { position: 0.4, color: [221, 221, 221] },
  { position: 0.5, color: [245, 245, 245] },
  { position: 0.6, color: [249, 196, 178] },
  { position: 0.7, color: [244, 154, 123] },
  { position: 0.8, color: [221, 96, 73] },
  { position: 0.9, color: [192, 40, 40] },
  { position: 1.0, color: [180, 4, 38] },
];

const COLOR_SCALES: Record<ColorScheme, ColorStop[]> = {
  viridis: VIRIDIS_STOPS,
  plasma: PLASMA_STOPS,
  inferno: INFERNO_STOPS,
  coolwarm: COOLWARM_STOPS,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Get color from a color scale at a normalized position (0-1). */
export function getColor(scheme: ColorScheme, t: number): RGB {
  const stops = COLOR_SCALES[scheme];
  const normalizedT = clamp01(t);

  let lowerStop = stops[0];
  let upperStop = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (normalizedT >= stops[i].position && normalizedT <= stops[i + 1].position) {
      lowerStop = stops[i];
      upperStop = stops[i + 1];
      break;
    }
  }

  const range = upperStop.position - lowerStop.position;
  const localT = range > 0 ? (normalizedT - lowerStop.position) / range : 0;

  return [
    Math.round(lerp(lowerStop.color[0], upperStop.color[0], localT)),
    Math.round(lerp(lowerStop.color[1], upperStop.color[1], localT)),
    Math.round(lerp(lowerStop.color[2], upperStop.color[2], localT)),
  ];
}

/** Convert RGB to CSS color string. */
export function rgbToCSS(rgb: RGB, alpha?: number): string {
  if (alpha !== undefined) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Get CSS color from color scale at normalized position. */
export function getCSSColor(scheme: ColorScheme, t: number, alpha?: number): string {
  return rgbToCSS(getColor(scheme, t), alpha);
}

/** Create a color mapper for a given value range. */
export function createColorMapper(scheme: ColorScheme, min: number, max: number): (value: number) => string {
  const range = max - min;
  return (value: number): string => {
    const t = range > 0 ? (value - min) / range : 0.5;
    return getCSSColor(scheme, t);
  };
}
