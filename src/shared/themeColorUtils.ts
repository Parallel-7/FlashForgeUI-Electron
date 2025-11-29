/**
 * @fileoverview Shared theme color utilities for deriving runtime CSS variables.
 */

import type { ThemeColors } from '@shared/types/config.js';

function clampColorValue(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function normalizeHex(hex: string): string {
  if (!hex) {
    return hex;
  }
  return hex.startsWith('#') ? hex : `#${hex}`;
}

function parseHexNumber(hex: string): number | null {
  const normalized = normalizeHex(hex);
  const numeric = Number.parseInt(normalized.replace('#', ''), 16);
  if (Number.isNaN(numeric)) {
    console.warn(`Invalid hex color: ${hex}, returning original value.`);
    return null;
  }
  return numeric;
}

function mixColor(hex: string, percent: number, target: number): string {
  const numeric = parseHexNumber(hex);
  if (numeric === null) {
    return hex;
  }

  const limitedPercent = Math.min(Math.max(percent, 0), 100) / 100;
  const r = clampColorValue(
    Math.floor(((numeric >> 16) & 0xff) + ((target - ((numeric >> 16) & 0xff)) * limitedPercent))
  );
  const g = clampColorValue(
    Math.floor(((numeric >> 8) & 0xff) + ((target - ((numeric >> 8) & 0xff)) * limitedPercent))
  );
  const b = clampColorValue(
    Math.floor((numeric & 0xff) + ((target - (numeric & 0xff)) * limitedPercent))
  );

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function lightenColor(hex: string, percent: number): string {
  return mixColor(hex, percent, 255);
}

export function darkenColor(hex: string, percent: number): string {
  return mixColor(hex, percent, 0);
}

export function hexToRgba(hex: string, alpha: number): string {
  const numeric = parseHexNumber(hex);
  if (numeric === null) {
    return hex;
  }

  const r = (numeric >> 16) & 0xff;
  const g = (numeric >> 8) & 0xff;
  const b = numeric & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLuminance(hex: string): number {
  const numeric = parseHexNumber(hex);
  if (numeric === null) {
    return 0;
  }

  const r = (numeric >> 16) & 0xff;
  const g = (numeric >> 8) & 0xff;
  const b = numeric & 0xff;

  const srgb = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function getContrastingTextColor(hex: string): string {
  return getLuminance(hex) > 0.5 ? '#111111' : '#ffffff';
}

export interface ComputedThemePalette {
  primaryHover: string;
  secondaryHover: string;
  surfaceMuted: string;
  surfaceElevated: string;
  borderColor: string;
  borderColorLight: string;
  borderColorFocus: string;
  buttonTextColor: string;
  accentTextColor: string;
  dialogHeaderTextColor: string;
  containerTextColor: string;
  scrollbarTrackColor: string;
  scrollbarThumbColor: string;
  scrollbarThumbHoverColor: string;
  scrollbarThumbActiveColor: string;
  uiBorderColor: string;
  roundedBoxShadow: string;
}

export function computeThemePalette(theme: ThemeColors): ComputedThemePalette {
  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);
  const surfaceIsLight = getLuminance(theme.surface) > 0.5;
  const surfaceMuted = darkenColor(theme.surface, 6);
  const surfaceElevated = surfaceIsLight ? darkenColor(theme.surface, 12) : lightenColor(theme.surface, 12);
  const borderBaseColor = surfaceIsLight ? darkenColor(theme.surface, 30) : lightenColor(theme.surface, 30);
  const borderSoftColor = surfaceIsLight ? darkenColor(theme.surface, 18) : lightenColor(theme.surface, 18);
  const borderFocusColor = surfaceIsLight ? darkenColor(theme.surface, 40) : lightenColor(theme.surface, 40);
  const uiBorderColor = surfaceIsLight ? darkenColor(theme.surface, 45) : lightenColor(theme.surface, 45);
  const primaryIsLight = getLuminance(theme.primary) > 0.5;
  const scrollbarTrackColor = surfaceIsLight ? lightenColor(theme.surface, 10) : darkenColor(theme.surface, 10);
  const scrollbarThumbColor = primaryIsLight ? darkenColor(theme.primary, 12) : lightenColor(theme.primary, 8);
  const scrollbarThumbHoverColor = primaryIsLight ? darkenColor(theme.primary, 20) : lightenColor(theme.primary, 14);
  const scrollbarThumbActiveColor = primaryIsLight ? darkenColor(theme.primary, 28) : lightenColor(theme.primary, 18);

  return {
    primaryHover,
    secondaryHover,
    surfaceMuted,
    surfaceElevated,
    borderColor: hexToRgba(borderBaseColor, 0.35),
    borderColorLight: hexToRgba(borderSoftColor, 0.25),
    borderColorFocus: hexToRgba(borderFocusColor, 0.5),
    buttonTextColor: getContrastingTextColor(theme.secondary),
    accentTextColor: getContrastingTextColor(theme.primary),
     dialogHeaderTextColor: getContrastingTextColor(surfaceMuted),
    containerTextColor: getContrastingTextColor(theme.surface),
    scrollbarTrackColor,
    scrollbarThumbColor,
    scrollbarThumbHoverColor,
    scrollbarThumbActiveColor,
    uiBorderColor,
    roundedBoxShadow: surfaceIsLight ? '0 8px 32px rgba(0, 0, 0, 0.25)' : '0 8px 32px rgba(0, 0, 0, 0.55)'
  };
}
