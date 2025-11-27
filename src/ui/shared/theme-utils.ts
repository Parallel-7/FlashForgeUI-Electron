/**
 * @fileoverview Shared theme utilities for dialog renderers.
 *
 * Provides reusable functions for applying theme colors to dialogs and lightening colors
 * for hover states. Use these helpers to add live theme update support to any dialog.
 */

import type { ThemeColors } from '../../types/config.js';
import { computeThemePalette, lightenColor } from '../../utils/themeColorUtils.js';

/**
 * Applies theme colors to the document root CSS variables
 * @param theme The theme colors to apply
 */
export function applyDialogTheme(theme: ThemeColors): void {
  const root = document.documentElement;
  const palette = computeThemePalette(theme);
  const computedStyles = getComputedStyle(root);
  const currentBackground = computedStyles.getPropertyValue('--ui-background').trim().toLowerCase();
  const shouldStayTransparent = currentBackground === 'transparent' || currentBackground === 'rgba(0, 0, 0, 0)';
  const currentBorder = computedStyles.getPropertyValue('--ui-border').trim();
  const hasBorder = currentBorder && currentBorder !== 'none';
  const currentBoxShadow = computedStyles.getPropertyValue('--ui-box-shadow').trim();
  const hasBoxShadow = currentBoxShadow && currentBoxShadow !== 'none';

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
  root.style.setProperty('--button-text-color', palette.buttonTextColor);
  root.style.setProperty('--accent-text-color', palette.accentTextColor);
  root.style.setProperty('--surface-muted', palette.surfaceMuted);
  root.style.setProperty('--surface-elevated', palette.surfaceElevated);
  root.style.setProperty('--border-color', palette.borderColor);
  root.style.setProperty('--border-color-light', palette.borderColorLight);
  root.style.setProperty('--border-color-focus', palette.borderColorFocus);
  root.style.setProperty('--scrollbar-track-color', palette.scrollbarTrackColor);
  root.style.setProperty('--scrollbar-thumb-color', palette.scrollbarThumbColor);
  root.style.setProperty('--scrollbar-thumb-hover-color', palette.scrollbarThumbHoverColor);
  root.style.setProperty('--scrollbar-thumb-active-color', palette.scrollbarThumbActiveColor);
  root.style.setProperty('--container-text-color', palette.containerTextColor);
  root.style.setProperty('--dialog-header-text-color', palette.dialogHeaderTextColor);
  root.style.setProperty('--container-background', theme.surface);

  if (shouldStayTransparent) {
    root.style.setProperty('--ui-background', 'transparent');
  } else {
    root.style.setProperty('--ui-background', theme.background);
  }

  if (hasBorder) {
    root.style.setProperty('--ui-border', `1px solid ${palette.uiBorderColor}`);
  }

  if (hasBoxShadow) {
    root.style.setProperty('--ui-box-shadow', palette.roundedBoxShadow);
  }
}
