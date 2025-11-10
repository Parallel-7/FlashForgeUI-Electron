/**
 * @fileoverview CSS Variables injection utility for conditional UI styling
 * 
 * This utility provides functions to inject CSS variables into dialog windows
 * based on the RoundedUI configuration setting, allowing seamless switching
 * between rounded and square UI designs without code duplication.
 */

import { BrowserWindow } from 'electron';
import { getConfigManager } from '../managers/ConfigManager';
import { isRoundedUISupported } from './RoundedUICompatibility';

/**
 * Injects CSS variables into a window based on the current RoundedUI configuration
 * Platform class injection is now handled securely via IPC in the renderer process
 * @param window The BrowserWindow to inject variables into
 */
export function injectUIStyleVariables(window: BrowserWindow): void {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const useRoundedUI = config.RoundedUI && isRoundedUISupported();
  
  const cssVariables = `
    :root {
      --ui-padding: ${useRoundedUI ? '16px' : '0px'};
      --ui-border-radius: ${useRoundedUI ? '12px' : '0px'};
      --ui-background: ${useRoundedUI ? 'transparent' : '#3a3a3a'};
      --ui-border: ${useRoundedUI ? '1px solid #555' : 'none'};
      --ui-box-shadow: ${useRoundedUI ? '0 8px 32px rgba(0, 0, 0, 0.5)' : 'none'};
      --container-background: #3a3a3a;
      --header-border-radius-top: ${useRoundedUI ? '12px' : '0px'};
      --footer-border-radius-bottom: ${useRoundedUI ? '12px' : '0px'};
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
