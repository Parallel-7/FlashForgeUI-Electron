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
 *   `process.execPath` there is correct. In short: prefer APPIMAGE when set, else process.execPath -
 *   minus the `.bin` suffix the packaged Linux launcher wrapper introduces (see resolveLinuxExecPath).
 * - The entry also carries TryExec (so a moved or uninstalled binary makes the entry a silent no-op
 *   rather than a failing launch) and Icon (so KDE's Autostart panel renders the row properly).
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

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
 * Suffix the Linux build gives the real Electron binary when it is moved aside for the
 * sandbox-aware launcher script (see `scripts/linux/after-pack.cjs`). Kept in sync with that hook.
 */
const WRAPPED_BINARY_SUFFIX = '.bin';

/**
 * Quote a single argument for a Desktop Entry `Exec=` line per the freedesktop Desktop Entry
 * Specification: the argument is wrapped in double quotes and the reserved characters `"`, backtick,
 * `$` and `\` are escaped with a preceding backslash. Wrapping in double quotes also covers spaces
 * and other reserved characters (parentheses, `&`, `;`, etc.) that can appear in install paths.
 */
const quoteDesktopExecArg = (value: string): string => {
  // Literal percent signs are field codes to the Exec parser and must be doubled. This is applied
  // before quoting because `%` is not one of the backslash-escaped characters - `%%` is its own
  // escape mechanism, independent of the surrounding double quotes.
  const percentEscaped = value.replace(/%/g, '%%');
  const escaped = percentEscaped.replace(/(["`$\\])/g, '\\$1');
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
   * ConfigManager loads asynchronously, so getConfig() returns defaults until the load settles.
   * Applying those defaults eagerly is not harmless on Linux: StartAtBoot defaults to false, and
   * a false value DELETES the autostart entry - so a user with start-at-boot enabled would have
   * their `.desktop` file removed and then rewritten moments later when the load completes. The
   * initial apply is therefore deferred until the config is loaded; the per-key listeners are
   * registered immediately either way so live toggles are never missed.
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (this.configManager.isConfigLoaded()) {
      const config = this.configManager.getConfig();
      this.applyLoginItemSettings(config.StartAtBoot, config.StartMinimized);
    } else {
      this.configManager.once('config-loaded', () => {
        const loadedConfig = this.configManager.getConfig();
        this.applyLoginItemSettings(loadedConfig.StartAtBoot, loadedConfig.StartMinimized);
      });
    }

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
   *
   * One wrinkle on .deb/.rpm: the Linux build wraps the Electron binary in a launcher script
   * (`scripts/linux/after-pack.cjs`) and moves the real binary aside to `<name>.bin`, so
   * `process.execPath` points at the `.bin`. Autostart should invoke the launcher - the supported
   * entry point - so a trailing `.bin` is dropped when the sibling launcher actually exists.
   */
  private resolveLinuxExecPath(): string {
    const appImagePath = process.env.APPIMAGE?.trim();
    if (appImagePath && appImagePath.length > 0) {
      return appImagePath;
    }

    const execPath = process.execPath;
    if (execPath.endsWith(WRAPPED_BINARY_SUFFIX)) {
      const launcherPath = execPath.slice(0, -WRAPPED_BINARY_SUFFIX.length);
      if (existsSync(launcherPath)) {
        return launcherPath;
      }
    }
    return execPath;
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
      // TryExec makes a stale entry fail silently instead of loudly: if the binary has been moved,
      // renamed or uninstalled, the autostart spec requires the entry to be skipped rather than
      // executed. Unlike Exec this is a plain path, not a quoted/escaped command line.
      `TryExec=${execPath}`,
      // Icon is optional for autostart itself, but KDE's Autostart control panel and several
      // session managers list the entry with its icon; without it the row renders blank. The name
      // matches the icon the .deb/.rpm install into hicolor.
      `Icon=${app.getName()}`,
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
