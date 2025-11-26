/**
 * @fileoverview Shared theme utilities for dialog renderers.
 *
 * Provides reusable functions for applying theme colors to dialogs and lightening colors
 * for hover states. Use these helpers to add live theme update support to any dialog.
 */

import type { ThemeColors } from '../../types/config.js';

/**
 * Lightens a hex color by a percentage
 * @param hex Hex color string (e.g., '#4285f4')
 * @param percent Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;

  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Applies theme colors to the document root CSS variables
 * @param theme The theme colors to apply
 */
export function applyDialogTheme(theme: ThemeColors): void {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-secondary', theme.secondary);
  root.style.setProperty('--theme-background', theme.background);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-text', theme.text);

  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);
  root.style.setProperty('--theme-primary-hover', primaryHover);
  root.style.setProperty('--theme-secondary-hover', secondaryHover);
  root.style.setProperty('--button-bg', theme.primary);
  root.style.setProperty('--button-hover', primaryHover);
}
