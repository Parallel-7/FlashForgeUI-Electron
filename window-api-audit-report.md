# Window API Usage Audit Report

**Generated:** 2025-11-25  
**Scope:** Complete audit of `window.api.*` and `window.*` usage across the FlashForgeUI-Electron codebase  
**Purpose:** Identify areas for API namespace organization and cleanup of `window.*` usage patterns

**Latest Scan Command:** `npm run find:window -- --context=1`  
**Result:** 398 `window.*` references across 55 files (via the new TypeScript helper script described below).  
**Most common identifiers:** `window.api` (113 refs), `window.lucideHelpers` (26), `window.uploaderAPI` (24), `window.addEventListener` / `window.localStorage` (17), `window.printerSelectionAPI` (15), `window.settingsAPI` (14), `window.ifsDialogAPI` / `window.dialogAPI` / `window.updateDialogAPI` / `window.logDialogAPI` (≈10 each). Use the helper to keep these counts fresh before remediation.

---

## Helper Tooling

`scripts/find-window-usage.ts` now provides a repeatable scan for any `window.*` pattern. The script walks the repo (default `src`) and prints each hit with configurable context plus a frequency summary:

- Run `npm run find:window -- --context=2` for full context.
- Filter to specific namespaces with `--pattern=<regex>` (e.g., `--pattern=window\.api`, `--pattern=window\.uploaderAPI`).
- Limit search roots via `--root=src,src/webui/static`.

The script executes via `ts-node --esm` (no TMPDIR hacks) and avoids comment-only matches. Re-run it before each cleanup sweep to spot new globals quickly.

---

## Executive Summary

This report catalogs all usage of `window.api.*` and other `window.*` patterns across four major areas of the codebase:
1. **Renderer & Renderer Utilities** - Main window renderer code
2. **UI Components** - Component system and GridStack UI
3. **Dialog Windows & Settings** - All dialog windows and settings UI
4. **WebUI Static Client** - Headless WebUI browser code

**Key Findings:**
- **Total `window.api.*` calls:** 113 across renderer + dialog windows (per latest helper run)
- **Total `window.*` references overall:** 398 across 55 files (includes BrowserWindow usage in the main process)
- **WebUI uses NO `window.api.*`** - relies on REST/WebSocket transport instead
- **Browser standard APIs:** Extensively used (`localStorage`, timers, viewport APIs)
- **Custom globals:** `window.lucideHelpers`, `window.lucide`, `window.GridStack`, dialog-specific APIs for each window
- **New helper script:** `npm run find:window` surfaces every occurrence with line context + identifier counts

---

## Section 1: Renderer & Renderer Utilities

### Files Audited
- `src/renderer.ts`
- `src/renderer/gridController.ts`
- `src/renderer/logging.ts`
- `src/renderer/perPrinterStorage.ts`
- `src/renderer/shortcutButtons.ts`

### Total `window.api.*` Calls: 38

### API Namespaces Used

#### Core IPC Methods
| Method | Count | Files | Purpose |
|--------|-------|-------|---------|
| `window.api.send()` | 13 | renderer.ts, gridController.ts, shortcutButtons.ts | One-way IPC messages (dialogs, palette, config) |
| `window.api.receive()` | 20 | renderer.ts, gridController.ts, shortcutButtons.ts | Event listeners (contexts, polling, backend, logs) |
| `window.api.invoke()` | 2 | renderer.ts, logging.ts | Promise-based IPC (renderer-ready, request-logs) |
| `window.api.removeAllListeners()` | 1 | renderer.ts | Cleanup on window unload |

#### Scoped API Namespaces
| Namespace | Count | Files | Methods |
|-----------|-------|-------|---------|
| `window.api.requestConfig()` | 4 | renderer.ts, gridController.ts | Request app configuration |
| `window.api.printerContexts.*` | 3 | renderer.ts | `switch()`, `remove()`, `getAll()` |

### Key IPC Channels

**Printer Context Management:**
- `printer-context-created`
- `printer-context-switched`
- `printer-context-removed`
- `printer-context-updated`

**Polling & Backend:**
- `polling-update` - Real-time printer data
- `backend-initialized`
- `backend-initialization-failed`
- `backend-disposed`

**Configuration & Logging:**
- `config-loaded`
- `config-updated`
- `log-message`
- `log-dialog-request-logs`

**Grid & Palette:**
- `palette:opened`
- `palette:update-status`
- `edit-mode:toggle`
- `grid:add-component`
- `grid:remove-component`

**Shortcut Configuration:**
- `shortcut-config:updated`
- `shortcut-config:get-current-request`
- `shortcut-config:save-request`
- `shortcut-config:get-components-request`

### Non-API Window Usage
| Pattern | File | Line(s) | Purpose |
|---------|------|---------|---------|
| `window.PLATFORM` | renderer.ts | 565-568 | Platform detection for CSS (set by preload) |
| `window.addEventListener('beforeunload')` | renderer.ts | 620 | Cleanup on window close |

---

## Section 2: UI Components & GridStack

### Files Audited
**Components:**
- `src/ui/components/camera-preview/camera-preview.ts`
- `src/ui/components/spoolman/spoolman.ts`
- `src/ui/components/controls-grid/controls-grid.ts`
- `src/ui/components/temperature-controls/temperature-controls.ts`
- `src/ui/components/filtration-controls/filtration-controls.ts`

**GridStack:**
- `src/ui/gridstack/EditModeController.ts`

### Total `window.api.*` Calls: 42

### API Namespaces Used

#### Core IPC Methods
| Method | Count | Purpose |
|--------|-------|---------|
| `window.api.invoke()` | 15 | Printer control commands (pause, resume, cancel, LED, temps, filtration) |
| `window.api.send()` | 6 | Dialog/window commands (job uploader, file lists, palette) |
| `window.api.receive()` | 1 | Context switch events |

#### Scoped Namespaces
| Namespace | Count | Methods | Files |
|-----------|-------|---------|-------|
| `window.api.camera` | 9 | `getConfig()`, `getProxyUrl()`, `setEnabled()`, `restoreStream()` | camera-preview.ts |
| `window.api.spoolman` | 9 | `onSpoolSelected()`, `onSpoolUpdated()`, `openSpoolSelection()`, `getActiveSpool()`, `getStatus()` | spoolman.ts |
| `window.api.showInputDialog()` | 2 | Show modal input dialogs | temperature-controls.ts |

### Key IPC Channels (Components)

**Printer Control:**
- `pause-print`, `resume-print`, `cancel-print`
- `led-on`, `led-off`
- `set-bed-temp`, `set-extruder-temp`
- `turn-off-bed-temp`, `turn-off-extruder-temp`
- `set-filtration`

**Camera:**
- `camera:get-rtsp-relay-info`
- Context-aware camera proxy URLs

**Dialogs:**
- `open-job-uploader`
- `show-recent-files`
- `show-local-files`
- `open-send-commands`
- `open-component-palette`
- `close-component-palette`

### Browser API Usage (Components)
| Pattern | File | Purpose |
|---------|------|---------|
| `window.setInterval()` | camera-preview.ts | MJPEG heartbeat monitoring (keep-alive) |
| `window.clearInterval()` | camera-preview.ts | Cleanup heartbeat timer |
| `window.confirm()` | EditModeController.ts | Native confirmation dialog (layout reset) |
| `window.location.reload()` | EditModeController.ts | Page reload after reset |

### Additional Renderer Controllers & Utilities
- `src/ui/legacy/LegacyUiController.ts`: Dispatches chrome/menu actions via `window.api.send`, listens for `window.api.receive('loading-state-changed')`, and invokes `window.api.loading.cancel()` from cancel buttons.
- `src/ui/palette/palette.ts`: Registers `window.addEventListener('beforeunload')` and uses `window.api.send('open/close-component-palette')` while the palette dialog is open.
- `src/ui/shared/lucide.ts` & `src/utils/icons.ts`: Populate and reuse `window.lucideHelpers` for lucide hydration in every dialog/component.
- `src/utils/icons.ts`: Guards `window` access (SSR-safe) but still assumes the helper is available before dialog constructors run.

### Safety Patterns Observed
- **Optional chaining:** All `window.api` access uses `?.` or null checks
- **Context-aware:** Camera and Spoolman methods accept `contextId` parameters
- **Error handling:** Try-catch blocks around all async `window.api` calls

---

## Section 3: Dialog Windows & Settings

### Files Audited
**Settings:**
- `src/ui/settings/settings-renderer.ts`
- `src/ui/settings/sections/*.ts` (8 section files)

**Dialogs:**
- `src/ui/component-dialog/component-dialog.ts`
- `src/ui/spoolman-dialog/spoolman-dialog-renderer.ts`
- `src/ui/spoolman-offline-dialog/spoolman-offline-dialog-renderer.ts`
- `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts`

### Total `window.*` Calls: 68

### Custom Preload Bridge APIs

| Namespace | Files | Methods |
|-----------|-------|---------|
| `window.settingsAPI` | settings-renderer.ts | `requestConfig()`, `saveConfig()`, `closeWindow()`, `onConfigUpdated()`, `removeListeners()`, `performThemeProfileOperation()`, `testSpoolmanConnection()`, `testDiscordWebhook()`, `getRoundedUISupportInfo()` |
| `window.printerSettingsAPI` | settings-renderer.ts | `get()`, `update()`, `getPrinterName()` |
| `window.autoUpdateAPI` | settings-renderer.ts | `checkForUpdates()`, `getStatus()`, `setUpdateChannel()` |
| `window.componentDialogAPI` | component-dialog.ts | `receive()` (polling-update, init events) |
| `window.spoolmanDialogAPI` | spoolman-dialog-renderer.ts | `searchSpools()`, `selectSpool()` |
| `window.spoolmanOfflineAPI` | spoolman-offline-dialog-renderer.ts | `retryConnection()`, `onStatusUpdate()` |
| `window.shortcutConfigAPI` | shortcut-config-dialog.ts | `getCurrentConfig()`, `getAvailableComponents()`, `saveConfig()`, `closeDialog()`, `onDialogInit()` |
| `window.lucideHelpers` | All dialogs | `initializeLucideIconsFromGlobal()` |

### Newly Cataloged Dialog Bridges

| Dialog | File | Global API | Notes |
|--------|------|------------|-------|
| Update Available | `src/ui/update-available/update-available-renderer.ts` | `window.updateDialogAPI`, `window.platform` | Drives auto-update workflow, removes listeners on `beforeunload`. |
| Status Dashboard | `src/ui/status-dialog/status-dialog-renderer.ts` | `window.statusAPI` | Streams system/printer stats, uses `window.localStorage` for tab persistence. |
| About Dialog | `src/ui/about-dialog/about-dialog-renderer.ts` | `window.aboutAPI`, `window.lucide` | Fetches app metadata, hydrates lucide icons directly. |
| Connect Choice | `src/ui/connect-choice-dialog/connect-choice-dialog-renderer.ts` | `window.connectChoiceAPI` | Sends selection payloads, removes listeners on unload. |
| Auto-Connect Choice | `src/ui/auto-connect-choice/auto-connect-choice-renderer.ts` | `window.autoConnectChoiceAPI` | Similar to connect-choice but populated via auto-connect fallback data. |
| Printer Selection | `src/ui/printer-selection/printer-selection-renderer.ts` | `window.printerSelectionAPI` | Rich lifecycle: discovery events, saved printer selection, `window.location.reload()` fallback buttons. |
| Printer Warning | `src/ui/printer-connected-warning/printer-connected-warning-renderer.ts` | `window.printerWarningDialogAPI` | Continue/cancel flows plus theme listener. |
| IFS Dialog | `src/ui/ifs-dialog/ifs-dialog-renderer.ts` | `window.ifsDialogAPI` | Requests material station data, closes dialog via API. |
| Send Commands | `src/ui/send-cmds/send-cmds-renderer.ts` | `window.sendCmdsApi` | Manual G-code send dialog with theme events. |
| Job Picker | `src/ui/job-picker/job-picker-renderer.ts` | `window.jobPickerAPI` | Handles job lists, thumbnails, and spawn of downstream dialogs (`materialMatching`, `materialInfo`, `singleColorConfirm`). |
| Job Uploader (renderer + preload) | `src/ui/job-uploader/*.ts` | `window.uploaderAPI` | Upload flow, metadata parsing, AD5X helpers; preload calls `.uploadFileAD5X()` during compatibility prompts. |
| Material Matching | `src/ui/material-matching-dialog/material-matching-dialog-renderer.ts` | `window.materialMatchingAPI` | Mapping UI for AD5X multi-color prints. |
| Material Info | `src/ui/material-info-dialog/material-info-dialog-renderer.ts` | `window.materialInfoDialogAPI` | Presents tool/material metadata. |
| Single-Color Confirmation | `src/ui/single-color-confirmation-dialog/single-color-confirmation-dialog-renderer.ts` | `window.singleColorConfirmAPI` | Validates IFS slots before running AD5X jobs. |
| Log Dialog | `src/ui/log-dialog/log-dialog-renderer.ts` | `window.logDialogAPI`, `window.windowControls` fallback | Streams logs, clears them, watches theme events. |
| Status + Spoolman Offline Dialogs | `src/ui/status-dialog/*`, `src/ui/spoolman-offline-dialog/*` | `window.statusAPI`, `window.spoolmanOfflineAPI` | Provide diagnostics + offline retry flows. |

### Browser API Usage (Dialogs)
| Pattern | Files | Purpose |
|---------|-------|---------|
| `window.addEventListener()` | settings-renderer.ts, DesktopThemeSection.ts | Event handling (resize, beforeunload) |
| `window.removeEventListener()` | DesktopThemeSection.ts | Cleanup resize listeners |
| `window.close()` | Multiple dialogs | Close dialog windows |
| `window.localStorage` | TabSection.ts | Persist tab selection |
| `window.requestAnimationFrame()` | DesktopThemeSection.ts | Animation frame scheduling |
| `window.location.reload()` | printer-selection-renderer.ts | Retry buttons when discovery fails |

### Key Observations (Dialogs)

1. **Settings Architecture:** Uses dependency injection for APIs (`window.settingsAPI`, `window.printerSettingsAPI`, `window.autoUpdateAPI`) passed to modular sections

2. **Dialog Patterns:** Each dialog has its own preload bridge:
   - Component dialog: `window.api` + `window.componentDialogAPI`
   - Spoolman: `window.spoolmanDialogAPI`
   - Shortcut config: `window.shortcutConfigAPI`
   - Offline dialog: `window.spoolmanOfflineAPI`

3. **Type Safety:** All custom APIs declared in `declare global { interface Window { ... } }` blocks

4. **Safe Access:** All custom APIs use optional chaining or null checks (no crashes if preload fails)

---

## Section 4: WebUI Static Client

### Files Audited
- `src/webui/static/core/*.ts` (2 files)
- `src/webui/static/features/*.ts` (7 files)
- `src/webui/static/ui/*.ts` (3 files)
- `src/webui/static/grid/*.ts` (5 files)
- `src/webui/static/shared/*.ts` (4 files)

### Total `window.*` Calls: 30

### CRITICAL FINDING: No `window.api.*` Usage

The WebUI static client **does NOT use** `window.api.*` patterns. Communication happens via:
- **REST API:** `fetch()` calls to Express routes
- **WebSocket:** Real-time updates via `WebSocketManager`

### Browser Standard APIs (WebUI)

#### Navigation & URL Construction
| Pattern | File | Count | Purpose |
|---------|------|-------|---------|
| `window.location.protocol` | Transport.ts | 1 | Detect HTTPS/HTTP for WSS/WS selection |
| `window.location.host` | Transport.ts | 1 | Build WebSocket URL |
| `window.location.hostname` | camera.ts | 1 | Build RTSP stream WebSocket URL |

#### Viewport & Responsive Design
| Pattern | File | Count | Purpose |
|---------|------|-------|---------|
| `window.innerWidth` | layout-theme.ts, header.ts | 2 | Mobile breakpoint detection (≤768px) |
| `window.matchMedia()` | layout-theme.ts | 1 | Media query listener |
| `window.addEventListener('resize')` | layout-theme.ts | 1 | Viewport change detection |

#### Timers & Debouncing
| Pattern | File | Purpose |
|---------|------|---------|
| `window.setTimeout()` | layout-theme.ts, spoolman.ts, WebUILayoutPersistence.ts | Debounced callbacks (250ms viewport, 300ms search, 1000ms layout save) |
| `window.clearTimeout()` | WebUILayoutPersistence.ts | Cancel pending saves |
| `window.setInterval()` | job-control.ts | WebSocket keep-alive ping (30s) |

#### Local Storage (Extensive)
| File | Operations | Purpose |
|------|-----------|---------|
| WebUILayoutPersistence.ts | 13 calls | Layout and settings persistence for per-printer configurations |

**Methods used:**
- `getItem()` - Load persisted data
- `setItem()` - Save data
- `removeItem()` - Clear corrupted/invalid data
- `length` / `key()` - Iterate through stored layouts

#### Custom Globals (Third-Party Libraries)
| Pattern | File | Purpose |
|---------|------|---------|
| `window.lucide` | icons.ts | Lucide icon library instance (loaded via UMD) |
| `window.GridStack` | WebUIGridManager.ts | GridStack constructor (loaded via UMD) |

### WebUI Transport Architecture

**REST Endpoints** (via `fetch()`):
- `/api/camera/*` - Camera config, proxy URLs
- `/api/contexts/*` - Printer contexts
- `/api/job/*` - Job control, file lists
- `/api/printer/control/*` - Printer commands
- `/api/printer/status/*` - Printer state
- `/api/spoolman/*` - Spool management
- `/api/temperature/*` - Temperature control
- `/api/theme/*` - Theme profiles

**WebSocket Events:**
- `polling-update` - Real-time printer data per context
- `context-switched` - Active context changes
- Keep-alive pings (30s interval)

---

## Recommendations for API Reorganization

### 1. Consolidate Core IPC Methods

**Current State:**
```typescript
window.api.send(channel, data)
window.api.receive(channel, callback)
window.api.invoke(channel, data)
window.api.removeListener(channel, callback)
window.api.removeAllListeners()
```

**Recommendation:** Keep as-is - these are the fundamental IPC primitives used everywhere.

---

### 2. Formalize Scoped Namespaces

**Currently Scoped (Good):**
```typescript
window.api.camera.getConfig()
window.api.camera.getProxyUrl()
window.api.camera.setEnabled()
window.api.camera.restoreStream()

window.api.spoolman.onSpoolSelected()
window.api.spoolman.onSpoolUpdated()
window.api.spoolman.openSpoolSelection()
window.api.spoolman.getActiveSpool()
window.api.spoolman.getStatus()

window.api.printerContexts.switch()
window.api.printerContexts.remove()
window.api.printerContexts.getAll()
```

**Recommendation:** Continue this pattern for all domain-specific operations.

---

### 3. Consolidate Configuration API

**Current State (Inconsistent):**
```typescript
window.api.requestConfig() // Main renderer, component dialogs
window.settingsAPI.requestConfig() // Settings dialog
window.printerSettingsAPI.get() // Settings dialog
```

**Recommendation:** Create unified configuration namespace:
```typescript
window.api.config.get()
window.api.config.update()
window.api.config.onUpdate(callback)
window.api.config.getPrinterSettings(contextId)
window.api.config.updatePrinterSettings(contextId, settings)
```

---

### 4. Standardize Dialog APIs

**Current State (Each dialog has unique bridge):**
```typescript
window.componentDialogAPI
window.spoolmanDialogAPI
window.spoolmanOfflineAPI
window.shortcutConfigAPI
```

**Recommendation:** Unify under dialog namespace:
```typescript
window.api.dialog.componentDialog.receive(...)
window.api.dialog.spoolman.searchSpools(...)
window.api.dialog.shortcutConfig.getCurrentConfig(...)
```

---

### 5. Move Utility Methods to Scoped Namespaces

**Current State:**
```typescript
window.api.showInputDialog() // Used by temperature-controls.ts
```

**Recommendation:**
```typescript
window.api.dialog.showInput(title, message, defaultValue)
// Or more specifically:
window.api.temperature.promptTemperature(type: 'bed' | 'extruder')
```

---

### 6. Clean Up Custom Window Properties

**Properties to Preserve:**
- `window.PLATFORM` - Set by preload, read-only, used for platform-specific CSS
- `window.lucideHelpers` - Icon hydration utility, used across all dialogs
- `window.lucide` (WebUI only) - Third-party library global
- `window.GridStack` (WebUI only) - Third-party library global

**Properties to Potentially Consolidate:**
- All dialog-specific bridges (`window.settingsAPI`, etc.) → consider moving under `window.api.dialog.*`

---

### 7. WebUI Transport Independence

**Status:** WebUI correctly uses REST/WebSocket instead of `window.api.*`

**Recommendation:** No changes needed. The separation is architecturally sound:
- Desktop renderer: `window.api.*` (preload bridge)
- WebUI client: `fetch()` + `WebSocket` (no Electron preload)

---

## Section 5: Main Process Window Lifecycle & Broadcasts

The helper script surfaced several `window.*` usages in the main process where `window` represents an Electron `BrowserWindow` instance rather than the renderer global:

- `src/index.ts`: After configuration loads, iterates all BrowserWindows and calls `window.webContents.send('config-loaded')`.
- `src/ipc/handlers/dialog-handlers.ts`: Provides imperative handlers such as `window.close()`, `window.minimize()`, and ensures dialogs clean up when commands finish.
- `src/ipc/handlers/theme-handlers.ts`: Broadcasts `theme-changed` to every window that is not destroyed.
- `src/services/MainProcessPollingCoordinator.ts`: Dispatches `polling-update` payloads to all windows on each poll tick, guarded by `window.isDestroyed()`.
- `src/services/DialogIntegrationService.ts`: Opens/monitors dialog windows (printer selection, warnings) and explicitly closes BrowserWindows after resolving promises.
- `src/windows/WindowManager.ts`: Central registry using `window.isDestroyed()`, `window.close()`, and `window.focus()` to manage all window types.
- `src/windows/shared/WindowConfig.ts`: Calls `window.webContents.openDevTools()`, `window.once('ready-to-show', ...)`, `window.show()`, and `window.on('closed', ...)` whenever windows are created.
- `src/utils/CSSVariables.ts`: Injects CSS into a `BrowserWindow` via `window.webContents.insertCSS`.
- `src/webui/server/WebUIManager.ts`: When routing log messages or status to the renderer, calls `window.webContents.send('log-message', ...)` for every BrowserWindow still alive.

These usages should stay isolated to the main process. When renaming or refactoring, make sure not to conflate `BrowserWindow`-scoped helpers with the renderer's `window`.

---

## Migration Strategy

### Phase 1: Add New Namespaces (Non-Breaking)
1. Implement new `window.api.config.*` methods alongside existing `requestConfig()`
2. Implement new `window.api.dialog.*` methods alongside existing dialog bridges
3. Add deprecation warnings to old methods

### Phase 2: Update Call Sites
1. Migrate renderer/components to use new namespaces
2. Migrate dialogs to use new namespaces
3. Remove deprecation warnings

### Phase 3: Remove Legacy APIs
1. Remove old methods from preload bridges
2. Clean up unused custom window properties
3. Update TypeScript declarations

---

## Appendix: Latest Helper Snapshot

- Command: `npm run find:window -- --context=1`
- Total references: **398** across **55** files
- Use `--pattern` to drill down by namespace (e.g., `window\.api`, `window\.uploaderAPI`)

### Top Identifiers
| Identifier | Count | Notes |
|------------|-------|-------|
| `window.api` | 113 | Core preload bridge shared by renderer/components |
| `window.lucideHelpers` | 26 | Icon hydration helper used by nearly every dialog |
| `window.uploaderAPI` | 24 | Job uploader dialog (renderer + preload) |
| `window.addEventListener` | 17 | Dialog/renderer lifecycle cleanup |
| `window.localStorage` | 17 | Printer selection + WebUI layout persistence |
| `window.printerSelectionAPI` | 15 | Printer selection dialog bridge |
| `window.settingsAPI` | 14 | Settings dialog orchestration |
| `window.ifsDialogAPI` | 10 | AD5X IFS status dialog |
| `window.dialogAPI` | 10 | Generic input dialog |
| `window.updateDialogAPI` | 10 | Auto-update dialog |
| `window.logDialogAPI` | 9 | Log dialog streaming |
| `window.jobPickerAPI` | 8 | Job picker dialog |
| `window.printerWarningDialogAPI` | 8 | Printer-connected warning |
| `window.webContents` | 6 | BrowserWindow broadcast helpers (main process) |
| `window.componentDialogAPI` | 6 | Component palette dialog |
| `window.statusAPI` | 6 | Status dashboard dialog |
| `window.location` | 6 | WebUI + printer selection reload flows |
| `window.PLATFORM` | 5 | Platform-specific CSS toggles |

Re-run the helper before each cleanup sweep to capture drift.

---

## Conclusion

The codebase demonstrates consistent patterns for `window.api.*` usage with good safety practices (optional chaining, null checks). The main opportunities for improvement are:

1. **Namespace consolidation** - Unify configuration and dialog APIs
2. **Reduce custom window properties** - Move dialog bridges under `window.api.*`
3. **Maintain WebUI separation** - Keep REST/WebSocket transport independent from desktop IPC

All refactoring should be done incrementally with backward compatibility to avoid breaking existing functionality.
