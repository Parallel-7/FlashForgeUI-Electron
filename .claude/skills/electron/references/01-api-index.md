# Electron API Reference Index

Complete list of all Electron API modules. Each file contains the full API documentation including methods, events, and properties.

## Application Lifecycle

| File | Purpose |
|------|---------|
| `docs/api-app.md` | **APP** - Control your application's event lifecycle |
| `docs/api-auto-updater.md` | **AUTO-UPDATER** - Automatic app updates |
| `docs/api-command-line.md` | **COMMAND LINE** - Process command line arguments |
| `docs/api-environment-variables.md` | **ENVIRONMENT VARIABLES** - System environment variables |

## Windows & Views

| File | Purpose |
|------|---------|
| `docs/api-browser-window.md` | **BROWSER WINDOW** - Create and manage browser windows |
| `docs/api-base-window.md` | **BASE WINDOW** - Base class for window types |
| `docs/api-browser-view.md` | **BROWSER VIEW** - View to display additional web content |
| `docs/api-web-contents.md` | **WEB CONTENTS** - Render and control web pages |
| `docs/api-web-contents-view.md` | **WEB CONTENTS VIEW** - View for WebContents |
| `docs/api-webview-tag.md` | **WEBVIEW TAG** - Embed web pages using `<webview>` |
| `docs/api-window-open.md` | **WINDOW OPEN** - Handle window opening |
| `docs/api-view.md` | **VIEW** - Native view component |

## IPC (Inter-Process Communication)

| File | Purpose |
|------|---------|
| `docs/api-ipc-main.md` | **IPC MAIN** - Main process IPC (send/receive from renderer) |
| `docs/api-ipc-renderer.md` | **IPC RENDERER** - Renderer process IPC (send to main) |
| `docs/api-ipc-main-service-worker.md` | **IPC MAIN SERVICE WORKER** - IPC for service workers |
| `docs/api-context-bridge.md` | **CONTEXT BRIDGE** - Safe exposure of APIs from preload |
| `docs/api-message-channel-main.md` | **MESSAGE CHANNEL MAIN** - Message channels for IPC |
| `docs/api-message-port-main.md` | **MESSAGE PORT MAIN** | Message ports |
| `docs/api-parent-port.md` | **PARENT PORT** | Parent port for workers |

## Menus & UI Components

| File | Purpose |
|------|---------|
| `docs/api-menu.md` | **MENU** - Create native application menus |
| `docs/api-menu-item.md` | **MENU ITEM** - Individual menu items |
| `docs/api-tray.md` | **TRAY** - System tray icons and menus |
| `docs/api-dock.md` | **DOCK** - macOS dock icon and menu |
| `docs/api-share-menu.md` | **SHARE MENU** - macOS share menu |
| `docs/api-touch-bar.md` | **TOUCH BAR** - macOS Touch Bar |
| `docs/api-system-preferences.md` | **SYSTEM PREFERENCES** - System-level preferences |

## Touch Bar Components (macOS)

| File | Purpose |
|------|---------|
| `docs/api-touch-bar-button.md` | Touch Bar button |
| `docs/api-touch-bar-color-picker.md` | Touch Bar color picker |
| `docs/api-touch-bar-group.md` | Touch Bar item group |
| `docs/api-touch-bar-label.md` | Touch Bar text label |
| `docs/api-touch-bar-other-items-proxy.md` | Touch Bar other items |
| `docs/api-touch-bar-popover.md` | Touch Bar popover |
| `docs/api-touch-bar-scrubber.md` | Touch Bar scrubber |
| `docs/api-touch-bar-segmented-control.md` | Touch Bar segmented control |
| `docs/api-touch-bar-slider.md` | Touch Bar slider |
| `docs/api-touch-bar-spacer.md` | Touch Bar spacer |

## Dialogs & Notifications

| File | Purpose |
|------|---------|
| `docs/api-dialog.md` | **DIALOG** - Native system dialogs |
| `docs/api-notification.md` | **NOTIFICATION** - System notifications |
| `docs/api-push-notifications.md` | **PUSH NOTIFICATIONS** - Push notification support |

## Clipboard & Drag/Drop

| File | Purpose |
|------|---------|
| `docs/api-clipboard.md` | **CLIPBOARD** - System clipboard operations |
| `docs/api-desktop-capturer.md` | **DESKTOP CAPTURER** - Screen/audio capture |

## Networking & Requests

| File | Purpose |
|------|---------|
| `docs/api-net.md` | **NET** - HTTP/HTTPS requests |
| `docs/api-client-request.md` | **CLIENT REQUEST** - Client-side requests |
| `docs/api-web-request.md` | **WEB REQUEST** - Intercept and modify requests |
| `docs/api-protocol.md` | **PROTOCOL** - Custom protocol registration |
| `docs/api-navigation-history.md` | **NAVIGATION HISTORY** | Navigation history |

## Session & Cookies

| File | Purpose |
|------|---------|
| `docs/api-session.md` | **SESSION** - Session management, cookies, cache |
| `docs/api-cookies.md` | **COOKIES** - Cookie query/modification |
| `docs/api-net-log.md` | **NET LOG** - Network event logging |

## Screen & Display

| File | Purpose |
|------|---------|
| `docs/api-screen.md` | **SCREEN** - Display screen information |
| `docs/api-desktop-capturer.md` | **DESKTOP CAPTURER** | Screen capture |

## Power & System

| File | Purpose |
|------|---------|
| `docs/api-power-monitor.md` | **POWER MONITOR** - Power state changes |
| `docs/api-power-save-blocker.md` | **POWER SAVE BLOCKER** - Prevent sleep |
| `docs/api-crash-reporter.md` | **CRASH REPORTER** - Crash reporting |
| `docs/api-process.md` | **PROCESS** - Process information |
| `docs/api-command-line-switches.md` | **COMMAND LINE SWITCHES** - Chromium switches |

## Global Shortcut & Input

| File | Purpose |
|------|---------|
| `docs/api-global-shortcut.md` | **GLOBAL SHORTCUT** - Global keyboard shortcuts |
| `docs/api-content-tracing.md` | **CONTENT TRACING** - Chromium tracing |

## Shell & Files

| File | Purpose |
|------|---------|
| `docs/api-shell.md` | **SHELL** - File operations, open external items |
| `docs/api-in-app-purchase.md` | **IN APP PURCHASE** - macOS in-app purchases |

## Security & Storage

| File | Purpose |
|------|---------|
| `docs/api-safe-storage.md` | **SAFE STORAGE** - Encrypted string storage |

## Extensions & Services

| File | Purpose |
|------|---------|
| `docs/api-extensions.md` | **EXTENSIONS** - Chrome extension loading |
| `docs/api-extensions-api.md` | **EXTENSIONS API** | Extension API details |
| `docs/api-service-worker-main.md` | **SERVICE WORKER MAIN** | Service workers |
| `docs/api-service-workers.md` | **SERVICE WORKERS** | Service worker API |

## Advanced Features

| File | Purpose |
|------|---------|
| `docs/api-utility-process.md` | **UTILITY PROCESS** - Utility process for privileged operations |
| `docs/api-native-image.md` | **NATIVE IMAGE** - Image format conversion |
| `docs/api-native-theme.md` | **NATIVE THEME** - Native theme (dark/light mode) |
| `docs/api-image-view.md` | **IMAGE VIEW** | Image view component |
| `docs/api-download-item.md` | **DOWNLOAD ITEM** | Download management |
| `docs/api-debugger.md` | **DEBUGGER** | Chrome debugger protocol |
| `docs/api-incoming-message.md` | **INCOMING MESSAGE** | HTTP request messages |
| `docs/api-web-frame.md` | **WEB FRAME** | Frame manipulation (renderer) |
| `docs/api-web-frame-main.md` | **WEB FRAME MAIN** | Frame manipulation (main) |
| `docs/api-web-utils.md` | **WEB UTILS** | Web utilities |

## Finding the Right API

- **Creating windows?** → `api-browser-window.md`
- **Communication between processes?** → `api-ipc-main.md`, `api-ipc-renderer.md`
- **Menus/tray?** → `api-menu.md`, `api-tray.md`
- **Network requests?** → `api-net.md`, `api-web-request.md`
- **Cookies/sessions?** → `api-session.md`, `api-cookies.md`
- **System integration?** → `api-shell.md`, `api-notification.md`, `api-global-shortcut.md`
