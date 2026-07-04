/**
 * @fileoverview Auto launch service managing OS login-item registration for start-at-boot and start-minimized behavior.
 *
 * Provides centralized, platform-aware management of the "Start with system" (StartAtBoot)
 * and "Start minimized" (StartMinimized) preferences introduced in issue #75:
 * - Reads StartAtBoot / StartMinimized from ConfigManager and re-applies on per-key changes
 * - Registers the application as an OS login item via Electron's NATIVE app.setLoginItemSettings
 *   (openAtLogin, openAsHidden on macOS, and a `--hidden` launch argument for minimized starts)
 * - Skips OS registration in development (unpackaged) builds where electron.exe cannot be a login item,
 *   while still honoring live config toggles and persistence (ConfigManager owns persistence)
 * - Reports whether the current process was launched hidden via the `--hidden` flag so the main
 *   window can start minimized/hidden instead of flashing on screen
 *
 * Key exports:
 * - AutoLaunchService class: singleton service mirroring AutoUpdateService structure
 * - getAutoLaunchService(): singleton accessor
 *
 * The service intentionally avoids the `auto-launch` npm package because this project ships an
 * NSIS installer (not Squirrel); Electron's built-in setLoginItemSettings is the correct native
 * path for Windows registry run keys and macOS SMAppService.
 *
 * @module services/AutoLaunchService
 */

import { app } from 'electron';
import log from 'electron-log';

import type { ConfigManager } from '../managers/ConfigManager.js';
import { getConfigManager } from '../managers/ConfigManager.js';
import { getEnvironmentDetectionService } from './EnvironmentDetectionService.js';

/**
 * Command-line flag used to indicate a hidden (minimized) launch.
 * Passed by the OS login item on Windows and surfaced via process.argv for detection.
 */
const HIDDEN_LAUNCH_ARG = '--hidden';

/**
 * Auto launch orchestration service.
 *
 * Mirrors AutoUpdateService's singleton + initialize() pattern: a single instance captured a
 * ConfigManager reference in its constructor, initialize() reads the current config and wires
 * per-key listeners so toggling StartAtBoot / StartMinimized re-applies the OS login item live.
 */
class AutoLaunchService {
  private static instance: AutoLaunchService | null = null;

  private readonly configManager: ConfigManager;
  private initialized: boolean = false;

  private constructor() {
    this.configManager = getConfigManager();
  }

  /**
   * Get singleton instance.
   */
  public static getInstance(): AutoLaunchService {
    if (!AutoLaunchService.instance) {
      AutoLaunchService.instance = new AutoLaunchService();
    }
    return AutoLaunchService.instance;
  }

  /**
   * Read current StartAtBoot / StartMinimized preferences, apply the OS login item, and
   * subscribe to per-key config changes so live toggles stay in sync.
   *
   * ConfigManager loads asynchronously, so getConfig() may initially return defaults. The
   * per-key `config:<key>` events also fire during load (for values that differ from defaults),
   * which re-applies the correct registration once the saved values are available. This mirrors
   * AutoUpdateService's initialize() behavior.
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const config = this.configManager.getConfig();
    this.applyLoginItemSettings(config.StartAtBoot, config.StartMinimized);

    this.configManager.on('config:StartAtBoot', (startAtBoot: boolean) => {
      const currentConfig = this.configManager.getConfig();
      this.applyLoginItemSettings(startAtBoot, currentConfig.StartMinimized);
    });

    this.configManager.on('config:StartMinimized', (startMinimized: boolean) => {
      const currentConfig = this.configManager.getConfig();
      this.applyLoginItemSettings(currentConfig.StartAtBoot, startMinimized);
    });
  }

  /**
   * Apply the OS login item registration for the given preferences.
   *
   * openAsHidden is macOS-only in Electron's API; on Windows the `--hidden` argument is what
   * triggers a minimized launch. In development (unpackaged) builds the registration is skipped
   * because the dev electron.exe cannot meaningfully be registered as a login item; the config
   * toggle still persists via ConfigManager and will take effect in packaged builds.
   *
   * @param startAtBoot - Whether the app should launch at OS login.
   * @param startMinimized - Whether the app should launch minimized/hidden.
   */
  private applyLoginItemSettings(startAtBoot: boolean, startMinimized: boolean): void {
    const environmentService = getEnvironmentDetectionService();
    if (!environmentService.isPackaged()) {
      log.info(
        '[AutoLaunch] Skipping OS login-item registration in development mode (toggle persisted to config only).'
      );
      return;
    }

    const openAsHidden = process.platform === 'darwin' && startAtBoot && startMinimized;
    const args = startMinimized ? [HIDDEN_LAUNCH_ARG] : [];

    app.setLoginItemSettings({
      openAtLogin: startAtBoot,
      openAsHidden,
      args,
    });

    log.info(
      `[AutoLaunch] Login item settings applied (openAtLogin=${startAtBoot}, openAsHidden=${openAsHidden}, args=[${args.join(',')}]).`
    );
  }

  /**
   * Determine whether the current process was launched hidden (minimized).
   *
   * Checks both the persisted OS login item launch arguments (Windows, via getLoginItemSettings)
   * and the live process.argv fallback that covers macOS auto-launch and manual `--hidden` runs.
   * Used by createMainWindow to decide whether to show or minimize the window on startup.
   */
  public wasLaunchedHidden(): boolean {
    const launchItems = app.getLoginItemSettings().launchItems;
    if (Array.isArray(launchItems)) {
      for (const item of launchItems) {
        if (Array.isArray(item.args) && item.args.includes(HIDDEN_LAUNCH_ARG)) {
          return true;
        }
      }
    }
    return process.argv.includes(HIDDEN_LAUNCH_ARG);
  }
}

/**
 * Singleton accessor.
 */
export const getAutoLaunchService = (): AutoLaunchService => AutoLaunchService.getInstance();

export { AutoLaunchService };
