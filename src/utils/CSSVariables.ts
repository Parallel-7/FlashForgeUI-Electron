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
import { DEFAULT_THEME } from '../types/config.js';

/**
 * Lightens a hex color by a percentage
 * @param hex Hex color string (e.g., '#4285f4')
 * @param percent Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);

  // Guard against invalid hex values
  if (isNaN(num)) {
    console.warn(`Invalid hex color for lightening: ${hex}, returning original`);
    return hex;
  }

  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

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

  // Compute hover states (15% lighter - same logic as renderer.ts)
  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);

  const cssVariables = `
    :root {
      /* RoundedUI variables */
      --ui-padding: ${useRoundedUI ? '16px' : '0px'};
      --ui-border-radius: ${useRoundedUI ? '12px' : '0px'};
      --ui-background: ${useRoundedUI ? 'transparent' : '#3a3a3a'};
      --ui-border: ${useRoundedUI ? '1px solid #555' : 'none'};
      --ui-box-shadow: ${useRoundedUI ? '0 8px 32px rgba(0, 0, 0, 0.5)' : 'none'};
      --container-background: #3a3a3a;
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

      /* Legacy button variables for backward compatibility */
      --button-bg: ${theme.primary};
      --button-hover: ${primaryHover};
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
