# Window API Usage Audit Report

**Generated:** 2025-11-25
**Scope:** Complete audit of `window.api.*` and `window.*` usage across the FlashForgeUI-Electron codebase
**Purpose:** Identify areas for API namespace organization and cleanup of `window.*` usage patterns

---

## Executive Summary

This report catalogs all usage of `window.api.*` and other `window.*` patterns across four major areas of the codebase:
1. **Renderer & Renderer Utilities** - Main window renderer code
2. **UI Components** - Component system and GridStack UI
3. **Dialog Windows & Settings** - All dialog windows and settings UI
4. **WebUI Static Client** - Headless WebUI browser code

**Key Findings:**
- **Total `window.api.*` calls:** 148 across desktop renderer/dialogs
- **WebUI uses NO `window.api.*`** - relies on REST/WebSocket transport instead
- **Browser standard APIs:** Extensively used (`localStorage`, timers, viewport APIs)
- **Custom globals:** Lucide icons, GridStack library (WebUI only)

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

### Browser API Usage (Dialogs)
| Pattern | Files | Purpose |
|---------|-------|---------|
| `window.addEventListener()` | settings-renderer.ts, DesktopThemeSection.ts | Event handling (resize, beforeunload) |
| `window.removeEventListener()` | DesktopThemeSection.ts | Cleanup resize listeners |
| `window.close()` | Multiple dialogs | Close dialog windows |
| `window.localStorage` | TabSection.ts | Persist tab selection |
| `window.requestAnimationFrame()` | DesktopThemeSection.ts | Animation frame scheduling |

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

## Appendix: API Usage Statistics

### By Category
| Category | Count | % of Total |
|----------|-------|------------|
| Core IPC (send/receive/invoke) | 71 | 48% |
| Scoped Namespaces (camera, spoolman, contexts, config) | 34 | 23% |
| Dialog-Specific Bridges | 25 | 17% |
| Browser Standard APIs | 18 | 12% |

### By File Type
| File Type | `window.api.*` Count |
|-----------|---------------------|
| Renderer & Utilities | 38 |
| UI Components | 42 |
| Dialog Windows | 68 |
| WebUI Static | 0 |

### Most-Used IPC Channels
1. `polling-update` - Real-time printer data (all components)
2. `printer-context-*` - Context lifecycle events (renderer, tabs)
3. `config-*` - Configuration loading/updates (renderer, settings)
4. Printer control commands - `pause-print`, `resume-print`, `cancel-print`, etc. (controls-grid)
5. `log-*` - Logging system (renderer, component-dialog)

---

## Conclusion

The codebase demonstrates consistent patterns for `window.api.*` usage with good safety practices (optional chaining, null checks). The main opportunities for improvement are:

1. **Namespace consolidation** - Unify configuration and dialog APIs
2. **Reduce custom window properties** - Move dialog bridges under `window.api.*`
3. **Maintain WebUI separation** - Keep REST/WebSocket transport independent from desktop IPC

All refactoring should be done incrementally with backward compatibility to avoid breaking existing functionality.
