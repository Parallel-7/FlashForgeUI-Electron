/**
 * @fileoverview System tray service providing a persistent, always-reachable entry point to the
 * main window.
 *
 * Added alongside the start-at-boot / start-minimized work for issue #75. A hidden start is only
 * safe if there is a guaranteed way back to the window, and minimizing to the taskbar is not that
 * guarantee on every platform: Electron does not support "minimized" as a window state on Wayland,
 * and several Linux desktop environments ignore programmatic minimize entirely, so a window asked
 * to minimize may end up with no visible taskbar presence at all. The tray icon is the reliable
 * fallback - it is present regardless of window state and independent of the window manager's
 * minimize behavior.
 *
 * Behavior:
 * - Left-click (and double-click, which Windows reports separately) surfaces the main window
 * - Context menu offers Show and Quit
 * - Desktop mode only; headless runs never create a tray
 * - Hosts the minimize-to-tray target (`hideToTray`) used when the MinimizeToTray setting is on
 *
 * Note that tray support itself is not universal on Linux: GNOME has no built-in StatusNotifierItem
 * host and needs an extension (e.g. AppIndicator) for the icon to appear. Tray creation failing is
 * therefore treated as non-fatal and logged rather than thrown - the app remains fully usable, and
 * relaunching still surfaces the window through the single-instance handler.
 *
 * That optionality is why `hideToTray()` checks `isAvailable()` before hiding: a hidden window with
 * no tray icon is unreachable, so the absence of a tray downgrades the request to a plain minimize
 * rather than stranding the user (issue #75).
 *
 * Key exports:
 * - TrayService class: singleton managing the tray lifecycle
 * - getTrayService(): singleton accessor
 *
 * @module services/TrayService
 */

import path from 'node:path';

import { app, Menu, nativeImage, Notification, Tray } from 'electron';
import log from 'electron-log';

import { getWindowManager } from '../windows/WindowManager.js';

/**
 * Tray icon edge length in pixels. Linux and macOS status areas expect a small image and will not
 * downscale a full-size application icon gracefully; Windows tolerates either but looks best with
 * a scaled image too.
 */
const TRAY_ICON_SIZE = 22;

/**
 * System tray orchestration service.
 */
class TrayService {
  private static instance: TrayService | null = null;

  private tray: Tray | null = null;

  /**
   * Whether the "still running in the tray" hint has been shown this session. Deliberately not
   * persisted: the hint is cheap, and re-teaching once per launch matches how easily users forget
   * where a hidden window went.
   */
  private hasShownHideHint = false;

  private constructor() {
    // Singleton - use getTrayService()
  }

  /**
   * Get singleton instance.
   */
  public static getInstance(): TrayService {
    if (!TrayService.instance) {
      TrayService.instance = new TrayService();
    }
    return TrayService.instance;
  }

  /**
   * Create the tray icon and wire its menu. Safe to call repeatedly; subsequent calls are ignored
   * while a tray already exists.
   */
  public initialize(): void {
    if (this.tray) {
      return;
    }

    try {
      const icon = this.buildTrayIcon();
      if (icon.isEmpty()) {
        log.warn('[Tray] Tray icon image could not be loaded - skipping tray creation.');
        return;
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip(app.getName());
      this.tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: `Show ${app.getName()}`,
            click: (): void => this.surfaceMainWindow(),
          },
          { type: 'separator' },
          {
            label: 'Quit',
            click: (): void => app.quit(),
          },
        ])
      );

      // Windows reports single and double clicks as distinct events; both should surface the app.
      this.tray.on('click', () => this.surfaceMainWindow());
      this.tray.on('double-click', () => this.surfaceMainWindow());

      log.info('[Tray] System tray icon created.');
    } catch (error: unknown) {
      // Tray support is optional (notably absent on stock GNOME). Never let it break startup.
      log.error(`[Tray] Failed to create system tray icon: ${String(error)}`);
      this.tray = null;
    }
  }

  /**
   * Whether a tray icon actually exists. Creation is best-effort (see initialize), so callers that
   * intend to hide the window MUST check this first - hiding with no tray icon leaves no way back.
   */
  public isAvailable(): boolean {
    return this.tray !== null;
  }

  /**
   * Hide the main window into the tray.
   *
   * `hide()` (rather than `minimize()`) is what removes the taskbar/dock button on Windows and
   * Linux, which is the behavior requested in issue #75 - a minimized window keeps its taskbar
   * entry. macOS keeps the dock icon regardless; that is platform convention and not worth fighting.
   *
   * Falls back to a plain minimize when no tray icon exists so the window is never orphaned.
   */
  public hideToTray(): void {
    const mainWindow = getWindowManager().getMainWindow();
    if (!mainWindow) {
      log.warn('[Tray] Hide requested but no main window exists.');
      return;
    }

    if (!this.isAvailable()) {
      log.warn('[Tray] Hide requested but no tray icon exists - minimizing instead.');
      mainWindow.minimize();
      return;
    }

    mainWindow.hide();
    this.showHideHint();
  }

  /**
   * Restore, show and focus the main window. Mirrors the single-instance handler so both recovery
   * paths behave identically.
   */
  public surfaceMainWindow(): void {
    const mainWindow = getWindowManager().getMainWindow();
    if (!mainWindow) {
      log.warn('[Tray] Show requested but no main window exists.');
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }

  /**
   * Destroy the tray icon. Called during shutdown so the icon does not linger in the status area.
   */
  public destroy(): void {
    if (!this.tray) {
      return;
    }

    this.tray.destroy();
    this.tray = null;
    this.hasShownHideHint = false;
    log.info('[Tray] System tray icon destroyed.');
  }

  /**
   * Show a one-shot desktop notification the first time the window is hidden this session, so the
   * window does not simply appear to have vanished.
   *
   * Uses Electron's Notification directly rather than NotificationService: that service's payload
   * type is a discriminated union of printer events (PrintComplete, ConnectionLost, ...), and
   * widening it for a single UI hint would ripple into the notification coordinator and Discord
   * forwarding for no benefit.
   */
  private showHideHint(): void {
    if (this.hasShownHideHint) {
      return;
    }
    this.hasShownHideHint = true;

    if (!Notification.isSupported()) {
      return;
    }

    try {
      new Notification({
        title: app.getName(),
        body: `${app.getName()} is still running in the system tray.`,
        silent: true,
      }).show();
    } catch (error: unknown) {
      // A failed hint must never break hiding the window.
      log.warn(`[Tray] Failed to show minimize-to-tray hint: ${String(error)}`);
    }
  }

  /**
   * Load and scale the tray image.
   *
   * Uses the same `src/icons` location as NotificationService so both surfaces stay consistent.
   * PNG is used on every platform: it scales predictably, and Windows accepts it for tray icons.
   */
  private buildTrayIcon(): Electron.NativeImage {
    const iconPath = path.join(app.getAppPath(), 'src', 'icons', 'icon.png');
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
      return image;
    }
    return image.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  }
}

/**
 * Singleton accessor.
 */
export const getTrayService = (): TrayService => TrayService.getInstance();

export { TrayService };
