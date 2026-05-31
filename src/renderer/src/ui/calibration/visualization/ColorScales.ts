/**
 * @fileoverview Color scale utilities for heatmap visualization.
 * Provides color gradient generation for bed mesh heatmaps.
 * Supports multiple color schemes: viridis, plasma, inferno, coolwarm.
 *
 * @module renderer/ui/calibration/visualization/ColorScales
 */

/**
 * RGB color tuple.
 */
export type RGB = [number, number, number];

/**
 * Available color scheme names.
 */
export type ColorScheme = 'viridis' | 'plasma' | 'inferno' | 'coolwarm';

/**
 * Color stop definition for gradient.
 */
export interface ColorStop {
  position: number;
  color: RGB;
}

/**
 * Viridis color scale - perceptually uniform, colorblind-friendly.
 * From matplotlib's viridis colormap.
 */
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

/**
 * Plasma color scale - perceptually uniform, high contrast.
 */
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

/**
 * Inferno color scale - perceptually uniform, dark to bright.
 */
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

/**
 * Coolwarm color scale - diverging, blue to red through white.
 * Good for showing deviation from a center value.
 */
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

/**
 * Color scale registry.
 */
const COLOR_SCALES: Record<ColorScheme, ColorStop[]> = {
  viridis: VIRIDIS_STOPS,
  plasma: PLASMA_STOPS,
  inferno: INFERNO_STOPS,
  coolwarm: COOLWARM_STOPS,
};

/**
 * Linearly interpolate between two values.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value to the range [0, 1].
 *
 * @param value - Value to clamp
 * @returns Clamped value
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Get color from a color scale at a normalized position.
 *
 * @param scheme - Color scheme to use
 * @param t - Normalized position (0-1)
 * @returns RGB color tuple
 */
export function getColor(scheme: ColorScheme, t: number): RGB {
  const stops = COLOR_SCALES[scheme];
  const normalizedT = clamp01(t);

  // Find surrounding color stops
  let lowerStop = stops[0];
  let upperStop = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (normalizedT >= stops[i].position && normalizedT <= stops[i + 1].position) {
      lowerStop = stops[i];
      upperStop = stops[i + 1];
      break;
    }
  }

  // Interpolate between stops
  const range = upperStop.position - lowerStop.position;
  const localT = range > 0 ? (normalizedT - lowerStop.position) / range : 0;

  return [
    Math.round(lerp(lowerStop.color[0], upperStop.color[0], localT)),
    Math.round(lerp(lowerStop.color[1], upperStop.color[1], localT)),
    Math.round(lerp(lowerStop.color[2], upperStop.color[2], localT)),
  ];
}

/**
 * Convert RGB to CSS color string.
 *
 * @param rgb - RGB color tuple
 * @param alpha - Optional alpha value (0-1)
 * @returns CSS color string
 */
export function rgbToCSS(rgb: RGB, alpha?: number): string {
  if (alpha !== undefined) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Convert RGB to hex color string.
 *
 * @param rgb - RGB color tuple
 * @returns Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/**
 * Get CSS color from color scale at normalized position.
 *
 * @param scheme - Color scheme to use
 * @param t - Normalized position (0-1)
 * @param alpha - Optional alpha value
 * @returns CSS color string
 */
export function getCSSColor(scheme: ColorScheme, t: number, alpha?: number): string {
  return rgbToCSS(getColor(scheme, t), alpha);
}

/**
 * Generate a gradient of colors for a given number of steps.
 *
 * @param scheme - Color scheme to use
 * @param steps - Number of color steps
 * @returns Array of RGB colors
 */
export function generateGradient(scheme: ColorScheme, steps: number): RGB[] {
  const colors: RGB[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps > 1 ? i / (steps - 1) : 0.5;
    colors.push(getColor(scheme, t));
  }
  return colors;
}

/**
 * Create a color mapper for a given value range.
 *
 * @param scheme - Color scheme to use
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Function that maps values to CSS colors
 */
export function createColorMapper(scheme: ColorScheme, min: number, max: number): (value: number) => string {
  const range = max - min;
  return (value: number): string => {
    const t = range > 0 ? (value - min) / range : 0.5;
    return getCSSColor(scheme, t);
  };
}

/**
 * Create a diverging color mapper centered on zero.
 * Useful for deviation visualization.
 *
 * @param scheme - Color scheme to use (coolwarm recommended)
 * @param maxAbsValue - Maximum absolute value for scaling
 * @returns Function that maps values to CSS colors
 */
export function createDivergingMapper(scheme: ColorScheme, maxAbsValue: number): (value: number) => string {
  return (value: number): string => {
    // Map [-maxAbsValue, maxAbsValue] to [0, 1]
    const t = maxAbsValue > 0 ? (value / maxAbsValue + 1) / 2 : 0.5;
    return getCSSColor(scheme, t);
  };
}

/**
 * Generate CSS gradient string for use in backgrounds.
 *
 * @param scheme - Color scheme to use
 * @param direction - Gradient direction (e.g., "to right", "to bottom")
 * @param steps - Number of color steps
 * @returns CSS linear-gradient string
 */
export function generateCSSGradient(scheme: ColorScheme, direction: string = 'to right', steps: number = 10): string {
  const colors = generateGradient(scheme, steps);
  const colorStops = colors.map((rgb, i) => {
    const position = (i / (colors.length - 1)) * 100;
    return `${rgbToCSS(rgb)} ${position}%`;
  });
  return `linear-gradient(${direction}, ${colorStops.join(', ')})`;
}

/**
 * Get the list of available color schemes.
 *
 * @returns Array of color scheme names
 */
export function getAvailableSchemes(): ColorScheme[] {
  return Object.keys(COLOR_SCALES) as ColorScheme[];
}
