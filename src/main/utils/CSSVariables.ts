/**
 * @fileoverview CSS Variables injection utility for conditional UI styling
 *
 * This utility provides functions to inject CSS variables into dialog windows
 * based on the RoundedUI configuration setting, allowing seamless switching
 * between rounded and square UI designs without code duplication.
 *
 * Also injects theme color variables for consistent theming across all dialogs.
 */

import { BrowserWindow } from 'electron';
import { getConfigManager } from '../managers/ConfigManager.js';
import { isRoundedUISupported } from './RoundedUICompatibility.js';
import { DEFAULT_THEME } from '@shared/types/config.js';
import { computeThemePalette } from '@shared/themeColorUtils.js';

/**
 * Injects CSS variables into a window based on the current RoundedUI configuration
 * and active theme profile. Platform class injection is now handled securely via IPC
 * in the renderer process.
 * @param window The BrowserWindow to inject variables into
 */
export function injectUIStyleVariables(window: BrowserWindow): void {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const useRoundedUI = config.RoundedUI && isRoundedUISupported();
  const theme = config.DesktopTheme || DEFAULT_THEME;

  const palette = computeThemePalette(theme);
  const primaryHover = palette.primaryHover;
  const secondaryHover = palette.secondaryHover;
  const uiBorderColor = palette.uiBorderColor;
  const uiBackground = useRoundedUI ? 'transparent' : theme.background;
  const uiBoxShadow = useRoundedUI ? palette.roundedBoxShadow : 'none';

  const cssVariables = `
    :root {
      /* RoundedUI variables */
      --ui-padding: ${useRoundedUI ? '16px' : '0px'};
      --ui-border-radius: ${useRoundedUI ? '12px' : '0px'};
      --ui-background: ${uiBackground};
      --ui-border: ${useRoundedUI ? `1px solid ${uiBorderColor}` : 'none'};
      --ui-box-shadow: ${uiBoxShadow};
      --container-background: ${theme.surface};
      --header-border-radius-top: ${useRoundedUI ? '12px' : '0px'};
      --footer-border-radius-bottom: ${useRoundedUI ? '12px' : '0px'};

      /* Theme color variables */
      --theme-primary: ${theme.primary};
      --theme-secondary: ${theme.secondary};
      --theme-background: ${theme.background};
      --theme-surface: ${theme.surface};
      --theme-text: ${theme.text};
      --theme-primary-hover: ${primaryHover};
      --theme-secondary-hover: ${secondaryHover};
      --surface-muted: ${palette.surfaceMuted};
      --surface-elevated: ${palette.surfaceElevated};
      --dialog-header-text-color: ${palette.dialogHeaderTextColor};
      --container-text-color: ${palette.containerTextColor};
      --border-color: ${palette.borderColor};
      --border-color-light: ${palette.borderColorLight};
      --border-color-focus: ${palette.borderColorFocus};
      --scrollbar-track-color: ${palette.scrollbarTrackColor};
      --scrollbar-thumb-color: ${palette.scrollbarThumbColor};
      --scrollbar-thumb-hover-color: ${palette.scrollbarThumbHoverColor};
      --scrollbar-thumb-active-color: ${palette.scrollbarThumbActiveColor};

      /* Legacy button variables for backward compatibility */
      --button-bg: ${theme.primary};
      --button-hover: ${primaryHover};
      --button-text-color: ${palette.buttonTextColor};
      --accent-text-color: ${palette.accentTextColor};
    }
  `;

  // Insert CSS variables immediately
  // Platform class injection is now handled securely via IPC
  void window.webContents.insertCSS(cssVariables);
}

/**
 * Gets the window configuration options based on RoundedUI setting
 * @returns Window configuration object with appropriate transparency and frame settings
 */
export function getUIWindowOptions(): { frame: boolean; transparent: boolean } {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const roundedUI = config.RoundedUI;
  
  // Use rounded UI configuration only when enabled and supported on this platform
  const useRoundedUI = roundedUI && isRoundedUISupported();
  
  return {
    frame: !useRoundedUI,
    transparent: useRoundedUI
  };
}
