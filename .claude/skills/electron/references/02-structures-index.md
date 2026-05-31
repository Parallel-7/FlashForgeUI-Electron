# Electron Structures Index

Type definitions, interfaces, and data structures used throughout the Electron API. These define the shape of objects passed to and returned from Electron APIs.

## Window & Display Structures

| File | Purpose |
|------|---------|
| `docs/api-structures-base-window-options.md` | Options for creating BaseWindow |
| `docs/api-structures-browser-window-options.md` | Options for creating BrowserWindow |
| `docs/api-structures-web-preferences.md` | WebPreferences for window behavior |
| `docs/api-structures-display.md` | Display information |
| `docs/api-structures-rectangle.md` | Rectangle (x, y, width, height) |
| `docs/api-structures-size.md` | Size (width, height) |
| `docs/api-structures-point.md` | Point (x, y) |

## IPC & Communication Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/ipc-main-event.md` | IPC Main event object |
| `docs/api-structures/ipc-main-invoke-event.md` | IPC Main invoke event |
| `docs/api-structures/ipc-main-service-worker-event.md` | IPC Main service worker event |
| `docs/api-structures/ipc-main-service-worker-invoke-event.md` | IPC Main service worker invoke event |
| `docs/api-structures/ipc-renderer-event.md` | IPC Renderer event object |
| `docs/api-structures/post-body.md` | Post body for IPC |

## Input Event Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/input-event.md` | Base input event |
| `docs/api-structures/keyboard-event.md` | Keyboard event |
| `docs/api-structures/keyboard-input-event.md` | Keyboard input event |
| `docs/api-structures/mouse-input-event.md` | Mouse input event |
| `docs/api-structures/mouse-wheel-input-event.md` | Mouse wheel input event |
| `docs/api-structures/shortcut-details.md` | Shortcut details |

## Menu & UI Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/thumbar-button.md` | Thumbnail toolbar button (Windows taskbar) |
| `docs/api-structures/jump-list-category.md` | Jump list category (Windows) |
| `docs/api-structures/jump-list-item.md` | Jump list item (Windows) |
| `docs/api-structures/sharing-item.md` | Sharing item |
| `docs/api-structures/scrubber-item.md` | Scrubber item (Touch Bar) |
| `docs/api-structures/segmented-control-segment.md` | Segmented control segment |

## Notification Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/notification-action.md` | Notification action |
| `docs/api-structures/notification-response.md` | Notification response |

## Process & Memory Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/process-metric.md` | Process metric information |
| `docs/api-structures/cpu-usage.md` | CPU usage information |
| `docs/api-structures/memory-info.md` | Memory information |
| `docs/api-structures/memory-usage-details.md` | Memory usage details |
| `docs/api-structures/process-memory-info.md` | Process memory info |

## Certificate & Security Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/certificate.md` | Certificate information |
| `docs/api-structures/certificate-principal.md` | Certificate principal |

## Cookie & Networking Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/cookie.md` | Cookie information |
| `docs/api-structures/upload-file.md` | Upload file |
| `docs/api-structures/upload-raw-data.md` | Upload raw data |
| `docs/api-structures/upload-data.md` | Upload data |
| `docs/api-structures/file-path-with-headers.md` | File path with headers |
| `docs/api-structures/mime-typed-buffer.md` | MIME-typed buffer |

## Protocol & Request Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/custom-scheme.md` | Custom scheme definition |
| `docs/api-structures/protocol-request.md` | Protocol request |
| `docs/api-structures/protocol-response.md` | Protocol response |
| `docs/api-structures/protocol-response-upload-data.md` | Protocol response upload data |
| `docs/api-structures/web-request-filter.md` | Web request filter |
| `docs/api-structures/referrer.md` | Referrer information |
| `docs/api-structures/proxy-config.md` | Proxy configuration |

## Permission Request Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/permission-request.md` | Generic permission request |
| `docs/api-structures/filesystem-permission-request.md` | Filesystem permission request |
| `docs/api-structures/media-access-permission-request.md` | Media access permission |
| `docs/api-structures/open-external-permission-request.md` | Open external permission |

## Navigation Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/navigation-entry.md` | Navigation history entry |
| `docs/api-structures/web-source.md` | Web source information |
| `docs/api-structures/window-open-handler-response.md` | Window open handler response |

## Service Worker Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/service-worker-info.md` | Service worker information |
| `docs/api-structures/shared-worker-info.md` | Shared worker information |

## Shared Dictionary Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/shared-dictionary-info.md` | Shared dictionary info |
| `docs/api-structures/shared-dictionary-usage-info.md` | Shared dictionary usage |

## Device Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/bluetooth-device.md` | Bluetooth device |
| `docs/api-structures/hid-device.md` | HID device |
| `docs/api-structures/usb-device.md` | USB device |
| `docs/api-structures/serial-port.md` | Serial port |

## In-App Purchase Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/product.md` | Product information |
| `docs/api-structures/transaction.md` | Transaction information |
| `docs/api-structures/product-discount.md` | Product discount |
| `docs/api-structures/product-subscription-period.md` | Subscription period |
| `docs/api-structures/payment-discount.md` | Payment discount |

## Extension Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/extension.md` | Extension information |
| `docs/api-structures/extension-info.md` | Extension info details |

## Preload Script Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/preload-script.md` | Preload script definition |
| `docs/api-structures/preload-script-registration.md` | Preload script registration |

## Other Structures

| File | Purpose |
|------|---------|
| `docs/api-structures/task.md` | Task information |
| `docs/api-structures/gpu-feature-status.md` | GPU feature status |
| `docs/api-structures/trace-config.md` | Trace configuration |
| `docs/api-structures/trace-categories-and-options.md` | Trace categories and options |
| `docs/api-structures/crash-report.md` | Crash report details |
| `docs/api-structures/desktop-capturer-source.md` | Desktop capturer source |
| `docs/api-structures/file-filter.md` | File filter for dialogs |
| `docs/api-structures/printer-info.md` | Printer information |
| `docs/api-structures/render-process-gone-details.md` | Render process gone details |
| `docs/api-structures/resolved-host.md` | Resolved host information |
| `docs/api-structures/resolved-endpoint.md` | Resolved endpoint |
| `docs/api-structures/color-space.md` | Color space |
| `docs/api-structures/user-default-types.md` | User defaults (macOS) |
| `docs/api-structures/window-session-end-event.md` | Window session end event |
| `docs/api-structures/offscreen-shared-texture.md` | Offscreen shared texture |
| `docs/api-structures/shared-texture-handle.md` | Shared texture handle |

## Finding the Right Structure

- **Window options?** → `base-window-options`, `browser-window-options`, `web-preferences`
- **IPC events?** → `ipc-main-event`, `ipc-renderer-event`
- **Input handling?** → `keyboard-event`, `mouse-input-event`
- **Menus?** → `thumbar-button`, `jump-list-item`
- **Permissions?** → `permission-request`, `media-access-permission-request`
- **Network/protocol?** → `protocol-request`, `upload-file`, `cookie`
