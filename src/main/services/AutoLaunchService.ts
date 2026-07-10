/**
 * @fileoverview Auto launch service managing OS login-item registration for start-at-boot and start-minimized behavior.
 *
 * Provides centralized, platform-aware management of the "Start with system" (StartAtBoot)
 * and "Start minimized" (StartMinimized) preferences introduced in issue #75:
 * - Reads StartAtBoot / StartMinimized from ConfigManager and re-applies on per-key changes
 * - Registers the application as an OS login item. On Windows/macOS this uses Electron's NATIVE
 *   app.setLoginItemSettings (openAtLogin, openAsHidden on macOS, and a `--hidden` launch argument
 *   for minimized starts). Electron's setLoginItemSettings is a no-op on Linux (macOS/Windows only),
 *   so on Linux the service writes a freedesktop autostart `.desktop` file instead (see below).
 * - Skips OS registration in development (unpackaged) builds where electron.exe cannot be a login item,
 *   while still honoring live config toggles and persistence (ConfigManager owns persistence)
 * - Reports whether the current process was launched hidden via the `--hidden` flag so the main
 *   window can start minimized/hidden instead of flashing on screen
 *
 * Linux autostart:
 * - Follows the freedesktop.org Desktop Entry / Autostart specification, honored across all major
 *   desktop environments (GNOME, KDE, XFCE, Cinnamon, MATE, etc.): a `.desktop` file placed in
 *   `$XDG_CONFIG_HOME/autostart/` (defaulting to `~/.config/autostart/`).
 * - The `Exec=` line must reference a path that stays valid across reboots. For an AppImage,
 *   `process.execPath` is unstable — it points into the ephemeral `/tmp/.mount_XXXXXX/` FUSE mount
 *   that changes every launch and vanishes on exit — so the AppImage runtime instead exports the
 *   real, fixed `.AppImage` location in `process.env.APPIMAGE`; that is what we write. For non-AppImage
 *   packaging (.deb/.rpm) there is no FUSE mount and `process.execPath` already IS the stable installed
 *   binary path (e.g. `/opt/FlashForgeUI/flashforgeui`), and no APPIMAGE var is set — so falling back to
 *   `process.execPath` there is correct. In short: prefer APPIMAGE when set, else process.execPath.
 * - Disabling start-at-boot removes the `.desktop` file.
 *
 * Key exports:
 * - AutoLaunchService class: singleton service mirroring AutoUpdateService structure
 * - getAutoLaunchService(): singleton accessor
 *
 * The service intentionally avoids the `auto-launch` npm package: on Windows/macOS Electron's
 * built-in setLoginItemSettings is the correct native path (Windows registry run keys, macOS
 * SMAppService), and on Linux a hand-written freedesktop autostart entry is simpler, dependency-free,
 * and works across every distro without shelling out.
 *
 * @module services/AutoLaunchService
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix as pathPosix } from 'node:path';

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
 * Filename of the freedesktop autostart entry written under `$XDG_CONFIG_HOME/autostart/` on Linux.
 * Kept stable so toggling the preference always targets the same file for creation and removal.
 */
const LINUX_AUTOSTART_FILENAME = 'flashforgeui.desktop';

/**
 * Quote a single argument for a Desktop Entry `Exec=` line per the freedesktop Desktop Entry
 * Specification: the argument is wrapped in double quotes and the reserved characters `"`, backtick,
 * `$` and `\` are escaped with a preceding backslash. Wrapping in double quotes also covers spaces
 * and other reserved characters (parentheses, `&`, `;`, etc.) that can appear in install paths.
 */
const quoteDesktopExecArg = (value: string): string => {
  const escaped = value.replace(/(["`$\\])/g, '\\$1');
  return `"${escaped}"`;
};

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
   * Platform routing: Linux uses a freedesktop autostart `.desktop` file (Electron's
   * setLoginItemSettings is a no-op there); Windows/macOS use the native setLoginItemSettings.
   * openAsHidden is macOS-only in Electron's API; on Windows the `--hidden` argument is what
   * triggers a minimized launch. In development (unpackaged) builds the registration is skipped
   * because the dev binary cannot meaningfully be registered as a login item; the config toggle
   * still persists via ConfigManager and will take effect in packaged builds.
   *
   * @param startAtBoot - Whether the app should launch at OS login.
   * @param startMinimized - Whether the app should launch minimized/hidden.
   */
  private applyLoginItemSettings(startAtBoot: boolean, startMinimized: boolean): void {
    const environmentService = getEnvironmentDetectionService();
    if (!environmentService.isPackaged()) {
      log.info(
        '[AutoLaunch] Skipping OS autostart registration in development mode (toggle persisted to config only).'
      );
      return;
    }

    if (process.platform === 'linux') {
      this.applyLinuxAutostart(startAtBoot, startMinimized);
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
   * Resolve the absolute path + filename of the Linux autostart entry.
   *
   * Uses `$XDG_CONFIG_HOME/autostart/` when the variable is set (per the XDG Base Directory
   * spec), otherwise the `~/.config/autostart/` default. Both are honored uniformly across the
   * major desktop environments, so this works regardless of distro.
   */
  private getLinuxAutostartFile(): { dir: string; file: string } {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
    const configHome =
      xdgConfigHome && xdgConfigHome.length > 0
        ? xdgConfigHome
        : pathPosix.join(homedir(), '.config');
    const dir = pathPosix.join(configHome, 'autostart');
    return { dir, file: pathPosix.join(dir, LINUX_AUTOSTART_FILENAME) };
  }

  /**
   * Resolve the executable path to launch on Linux autostart.
   *
   * Prefers `process.env.APPIMAGE`: an AppImage is mounted at an ephemeral `/tmp/.mount_XXXXXX/`
   * FUSE path (`process.execPath`) that changes every launch and disappears on exit, so a
   * `.desktop` entry referencing it would be dead after the first reboot. APPIMAGE holds the
   * stable path to the actual `.AppImage` file. Non-AppImage packaging (.deb/.rpm, or a plain
   * unpacked run) has no APPIMAGE env var and falls back to `process.execPath`.
   */
  private resolveLinuxExecPath(): string {
    const appImagePath = process.env.APPIMAGE?.trim();
    return appImagePath && appImagePath.length > 0 ? appImagePath : process.execPath;
  }

  /**
   * Create or remove the freedesktop autostart `.desktop` entry for Linux.
   *
   * When startAtBoot is false the entry is removed (if present). When true, a spec-compliant
   * Desktop Entry is written with the resolved exec path and the `--hidden` argument appended when
   * startMinimized is set. Filesystem errors are logged rather than thrown so a failed write never
   * crashes app startup.
   *
   * @param startAtBoot - Whether the app should launch at login.
   * @param startMinimized - Whether the autostart launch should pass `--hidden`.
   */
  private applyLinuxAutostart(startAtBoot: boolean, startMinimized: boolean): void {
    const { dir, file } = this.getLinuxAutostartFile();

    if (!startAtBoot) {
      try {
        rmSync(file, { force: true });
        log.info(`[AutoLaunch] Removed Linux autostart entry (${file}).`);
      } catch (error: unknown) {
        log.error(`[AutoLaunch] Failed to remove Linux autostart entry: ${String(error)}`);
      }
      return;
    }

    const execPath = this.resolveLinuxExecPath();
    const execLine = startMinimized
      ? `${quoteDesktopExecArg(execPath)} ${HIDDEN_LAUNCH_ARG}`
      : quoteDesktopExecArg(execPath);

    const contents = [
      '[Desktop Entry]',
      'Type=Application',
      'Version=1.0',
      `Name=${app.getName()}`,
      'Comment=Automatically start FlashForgeUI at login',
      `Exec=${execLine}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n');

    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, contents, { encoding: 'utf8' });
      log.info(`[AutoLaunch] Wrote Linux autostart entry (${file}, exec=${execLine}).`);
    } catch (error: unknown) {
      log.error(`[AutoLaunch] Failed to write Linux autostart entry: ${String(error)}`);
    }
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
