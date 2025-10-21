/**
 * @fileoverview CSS Variables injection utility for conditional UI styling
 * 
 * This utility provides functions to inject CSS variables into dialog windows
 * based on the RoundedUI configuration setting, allowing seamless switching
 * between rounded and square UI designs without code duplication.
 */

import { BrowserWindow } from 'electron';
import { getConfigManager } from '../managers/ConfigManager';

/**
 * Injects CSS variables into a window based on the current RoundedUI configuration
 * Platform class injection is now handled securely via IPC in the renderer process
 * @param window The BrowserWindow to inject variables into
 */
export function injectUIStyleVariables(window: BrowserWindow): void {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const roundedUI = config.RoundedUI;
  
  const cssVariables = `
    :root {
      --ui-padding: ${roundedUI ? '16px' : '0px'};
      --ui-border-radius: ${roundedUI ? '12px' : '0px'};
      --ui-background: ${roundedUI ? 'transparent' : '#3a3a3a'};
      --ui-border: ${roundedUI ? '1px solid #555' : 'none'};
      --ui-box-shadow: ${roundedUI ? '0 8px 32px rgba(0, 0, 0, 0.5)' : 'none'};
      --container-background: #3a3a3a;
      --header-border-radius-top: ${roundedUI ? '12px' : '0px'};
      --footer-border-radius-bottom: ${roundedUI ? '12px' : '0px'};
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
  
  // Use rounded UI configuration only if enabled and not on macOS
  const useRoundedUI = roundedUI && process.platform !== 'darwin';
  
  return {
    frame: !useRoundedUI,
    transparent: useRoundedUI
  };
}
