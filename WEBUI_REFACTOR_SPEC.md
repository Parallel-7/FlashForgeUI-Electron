# WebUI app.ts Refactoring Specification

**Status:** In Progress
**Last Updated:** 2025-02-15
**Goal:** Refactor the monolithic 3,522-line `app.ts` into 15 cohesive modules (~200-300 lines each) with zero breaking changes to headless mode, desktop mode, or existing functionality.

---

## Current State

**File:** `src/webui/static/app.ts` (3,522 lines)
- All authentication, WebSocket, UI updates, modals, printer control in single file
- Natural boundaries exist via comment blocks (GLOBAL STATE, DOM HELPERS, AUTH, WEBSOCKET, etc.)
- Grid system already modular (`grid/*.ts` - good pattern to follow)

**Build Process:**
- TypeScript compilation: `npm run build:webui` → `tsc` + `copy-webui-assets.js`
- Output: ES2020 modules in `dist/webui/static/`
- No bundler (webpack/rollup) - browser loads raw ES modules
- Entry: `index.html` → `<script type="module" src="app.js"></script>`

---

## Target Module Structure (15 files)

```
src/webui/static/
├── app.ts                           (~200-250 lines - orchestration only)
├── shared/
│   ├── dom.ts                       (DOM helpers, visibility, toast)
│   ├── formatting.ts                (time, temperature, material formatters)
│   └── icons.ts                     (Lucide icon hydration)
├── core/
│   ├── AppState.ts                  (state class + singleton + context vars)
│   └── Transport.ts                 (REST + WebSocket unified)
├── features/
│   ├── authentication.ts            (login/logout/token persistence)
│   ├── context-switching.ts         (multi-printer context management)
│   ├── layout-theme.ts              (grid/mobile layout + theme)
│   ├── job-control.ts               (printer commands + job flow)
│   ├── material-matching.ts         (AD5X material station workflow)
│   ├── spoolman.ts                  (filament tracking integration)
│   └── camera.ts                    (MJPEG/RTSP stream handling)
├── ui/
│   ├── panels.ts                    (status/temp/spool/job panel updates)
│   ├── dialogs.ts                   (file/settings/spool modals)
│   └── header.ts                    (printer selector + auth bar)
└── grid/                            (existing, unchanged)
```

---

## Completed Work

1. **Shared utilities extracted:** Created `shared/dom.ts`, `shared/formatting.ts`, and `shared/icons.ts` with `@fileoverview` headers, moved all DOM/formatting/icon helpers out of `app.ts`, and wired the entry file to import them. Validation: `npm run type-check`.
2. **Core state & transport modules:** Added `core/AppState.ts` (state container, layout managers, accessor helpers) and `core/Transport.ts` (auth headers, `apiRequest` wrappers, WebSocket lifecycle and callbacks). Updated `app.ts` to consume the new modules, cover all former globals, and rely on callback-based WebSocket updates. Validation: `npm run type-check` and `tsc --project src/webui/static/tsconfig.json`.
3. **Phase 1 feature modules:** Extracted authentication, context-switching, and layout/theme logic into `features/authentication.ts`, `features/context-switching.ts`, and `features/layout-theme.ts`. Updated `app.ts` to import these modules, removed the monolithic sections, and rewired initialization to use hook-based orchestration. Validation: `npm run type-check` and `npm run lint -- src/webui/static/**/*.ts`.

---

## Remaining Phases

### Phase 2: Extract UI Components (Panels, Dialogs, Header)

**Create 3 files:**

#### `ui/panels.ts` (~250 lines)
Extract from `app.ts:1207-1446, 2011-2090`:
```typescript
// Pure rendering functions - accept data, minimal global access
export function updateConnectionStatus(connected: boolean): void
export function updatePrinterStatus(status: PrinterStatus | null): void
export function updateButtonStates(printerState: string): void
export function updatePrinterStateCard(status: PrinterStatus | null): void
export function updateFiltrationStatus(mode?: 'external' | 'internal' | 'none'): void
export function updateModelPreview(thumbnailData: string | null | undefined): void
export function updateSpoolmanPanelState(): void  // Reads from state
```

#### `ui/dialogs.ts` (~280 lines)
Extract from `app.ts:884-908, 2244-2414, 2787-2878, 2884-2931`:
```typescript
// Settings modal
export function openSettingsModal(): void
export function closeSettingsModal(): void
export function resetLayoutForCurrentPrinter(): void

// File selection modal
export function showFileModal(source: 'recent' | 'local'): Promise<void>
export async function loadFileList(source: 'recent' | 'local'): Promise<void>

// Temperature dialog
export function showTemperatureDialog(type: 'bed' | 'extruder'): void
export async function setTemperature(): Promise<void>

// Material matching modal (managed by features/material-matching.ts)
// Spoolman modal (managed by features/spoolman.ts)

// Event handler setup
export function setupDialogEventHandlers(): void
```

#### `ui/header.ts` (~80 lines)
Extract header-specific UI:
```typescript
export function updateEditModeToggle(editMode: boolean): void
export function setupHeaderEventHandlers(): void
```

**Update app.ts:**
- Import: `import { updatePrinterStatus, updateConnectionStatus } from './ui/panels.js'`
- Import: `import { setupDialogEventHandlers } from './ui/dialogs.js'`
- Import: `import { setupHeaderEventHandlers } from './ui/header.js'`
- Wire WebSocket callback: `onStatusUpdate((status) => updatePrinterStatus(status))`

**Validation:** `npm run type-check`

---

### Phase 3: Extract Domain Features (Job Control, Material Matching, Spoolman, Camera)

**Create 4 files:**

#### `features/job-control.ts` (~220 lines)
Extract from `app.ts:1597-1666, 2215-2341`:
```typescript
export async function sendPrinterCommand(endpoint: string, data?: unknown): Promise<void>
export async function loadPrinterFeatures(): Promise<void>
export function updateFeatureVisibility(): void
export async function startPrintJob(filename: string, leveling: boolean, startNow: boolean, job: WebUIJobFile | undefined): Promise<void>
export async function sendJobStartRequest(filename: string, leveling: boolean, startNow: boolean, mappings?: MaterialMapping[]): Promise<void>
export function setupJobControlEventHandlers(): void
```

**Key logic:**
- Generic printer command sender with toast feedback
- Feature loading: GET /api/printer/features, update visibility
- Job start: delegates to material-matching if AD5X multi-color, else direct start
- Event handlers: pause/resume/cancel/home/temp/LED buttons

#### `features/material-matching.ts` (~280 lines)
Extract from `app.ts:2416-2878`:
```typescript
// State helpers
export function clearMaterialMessages(): void
export function showMaterialError(message: string): void
export function showMaterialWarning(message: string): void
export function updateMaterialMatchingConfirmState(): void

// Rendering
export function renderMaterialRequirements(): void
export function renderMaterialSlots(): void
export function renderMaterialMappings(): void

// Interaction
export function handleToolSelection(toolId: number): void
export function handleSlotSelection(slotId: number): void

// Modal flow
export async function openMaterialMatchingModal(pending: PendingJobStart): Promise<void>
export function closeMaterialMatchingModal(): void
export function resetMaterialMatchingState(): void
export async function confirmMaterialMatching(): Promise<void>

// Setup
export function setupMaterialMatchingHandlers(): void
```

**Key logic:**
- Manages `materialMatchingState` from AppState
- Tool → slot mapping with validation (material type match, color mismatch warnings)
- Renders requirements, slots, mappings
- Confirms and sends job start with mappings

#### `features/spoolman.ts` (~260 lines)
Extract from `app.ts:1668-2009`:
```typescript
// Config & data
export async function loadSpoolmanConfig(): Promise<void>
export async function fetchActiveSpoolForContext(contextId?: string): Promise<void>
export function isSpoolmanAvailableForCurrentContext(): boolean

// Search & selection
export async function fetchSpools(searchQuery?: string): Promise<void>
export async function selectSpool(spoolId: number): Promise<void>
export async function clearActiveSpool(): Promise<void>

// UI
export function openSpoolSelectionModal(): void
export function closeSpoolSelectionModal(): void
export function renderSpoolList(spools: SpoolSummary[]): void
export function handleSpoolSearch(event: Event): void

// Setup
export function setupSpoolmanHandlers(): void
```

**Key logic:**
- Config: GET /api/spoolman/config
- Active spool: GET /api/spoolman/active/{contextId}
- Search: server-side + client-side fallback (vendor/material)
- Selection: POST /api/spoolman/select, DELETE for clear
- Modal with debounced search

#### `features/camera.ts` (~180 lines)
Extract from `app.ts:534-575, 2092-2213`:
```typescript
export async function loadCameraStream(): Promise<void>
export function teardownCameraStreamElements(): void
export function initializeCamera(): void
```

**Key logic:**
- Fetch proxy config: GET /api/camera/proxy-config
- MJPEG: img element with proxy URL
- RTSP: JSMpeg WebSocket canvas rendering
- Error handling with 5s retry
- Teardown: clear img src, canvas context

**Update app.ts:**
- Import: `import { setupJobControlEventHandlers, loadPrinterFeatures } from './features/job-control.js'`
- Import: `import { setupMaterialMatchingHandlers } from './features/material-matching.js'`
- Import: `import { setupSpoolmanHandlers, loadSpoolmanConfig } from './features/spoolman.js'`
- Import: `import { initializeCamera } from './features/camera.js'`

**Validation:** `npm run type-check` after each feature

---

### Phase 4: Rewrite app.ts & Final Validation

#### New app.ts Structure (~200-250 lines)

```typescript
/**
 * @fileoverview WebUI application orchestration and initialization.
 *
 * Coordinates module initialization, wires event handlers, and bootstraps
 * the browser-based client for remote printer control and monitoring.
 */

// Shared utilities
import { initializeLucideIcons } from './shared/icons.js';

// Core
import { state } from './core/AppState.js';
import { connectWebSocket, onStatusUpdate, onSpoolmanUpdate } from './core/Transport.js';

// Features
import { initializeLayout, setupLayoutEventHandlers, setupViewportListener } from './features/layout-theme.js';
import { checkAuthStatus, setupAuthEventHandlers } from './features/authentication.js';
import { initializeContextSwitching, fetchPrinterContexts, setupContextEventHandlers } from './features/context-switching.js';
import { setupJobControlEventHandlers, loadPrinterFeatures } from './features/job-control.js';
import { setupMaterialMatchingHandlers } from './features/material-matching.js';
import { setupSpoolmanHandlers, loadSpoolmanConfig, ensureSpoolmanVisibilityIfEnabled } from './features/spoolman.js';
import { initializeCamera } from './features/camera.js';

// UI
import { updatePrinterStatus, updateConnectionStatus, updateSpoolmanPanelState } from './ui/panels.js';
import { setupDialogEventHandlers } from './ui/dialogs.js';
import { setupHeaderEventHandlers } from './ui/header.js';

// Wire WebSocket callbacks to UI updates
onStatusUpdate((status) => {
  updatePrinterStatus(status);
});

onSpoolmanUpdate((contextId, spool) => {
  const currentContextId = getCurrentContextId();
  if (contextId === currentContextId) {
    state.activeSpool = spool;
    updateSpoolmanPanelState();
  }
});

/**
 * Main application initialization sequence
 */
async function initialize(): Promise<void> {
  // 1. Initialize icons
  initializeLucideIcons();

  // 2. Setup all event handlers
  setupAuthEventHandlers();
  setupDialogEventHandlers();
  setupHeaderEventHandlers();
  setupLayoutEventHandlers();
  setupContextEventHandlers();
  setupJobControlEventHandlers();
  setupMaterialMatchingHandlers();
  setupSpoolmanHandlers();

  // 3. Initialize layout system
  initializeLayout();

  // 4. Setup viewport listener for responsive layout
  setupViewportListener();

  // 5. Check authentication status
  await checkAuthStatus();

  // 6. If authenticated, connect and load data
  if (state.isAuthenticated) {
    connectWebSocket();
    await loadPrinterFeatures();
    await fetchPrinterContexts();
    await loadSpoolmanConfig();
    ensureSpoolmanVisibilityIfEnabled();

    // Initialize camera if printer has camera feature
    if (state.printerFeatures?.hasCamera) {
      initializeCamera();
    }
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initialize());
} else {
  void initialize();
}
```

#### Final Validation Checklist

**Code Quality:**
- [ ] `npm run docs:check` - all files have `@fileoverview`
- [ ] `npm run type-check` - zero TypeScript errors
- [ ] `npm run lint` - zero ESLint warnings
- [ ] `npm run build:webui` - compilation succeeds

**Manual Testing (Headless Mode):**
- [ ] Start with `--headless` flag
- [ ] WebUI server starts on configured port
- [ ] Login page loads and accepts password
- [ ] WebSocket connects and receives status updates
- [ ] All panels update with printer data
- [ ] Multi-printer context switching works (if >1 printer)
- [ ] Camera stream loads (MJPEG/RTSP)
- [ ] Spoolman integration works
- [ ] All modals open/close/save correctly
- [ ] Job start flow works (including material matching for AD5X)

**Manual Testing (Desktop Mode - if accessible):**
- [ ] App launches normally (not headless)
- [ ] WebUI accessible at localhost:3000
- [ ] GridStack layout drag/drop functional
- [ ] Layout persists per printer
- [ ] Edit mode toggle works
- [ ] Theme settings apply and persist

**Feature-Specific Tests:**
- [ ] Authentication: login/logout/remember-me/token persistence
- [ ] Multi-printer: context switching, layout per printer
- [ ] Modals: settings, file selection, temperature, spoolman, material matching
- [ ] Camera: MJPEG/RTSP streams, error handling, context switching
- [ ] Spoolman: config, search, selection, panel updates, WebSocket updates
- [ ] Material matching: AD5X workflow, tool/slot mapping, validation
- [ ] Layout: desktop/mobile switch, persistence, reset
- [ ] Theme: loading, application, persistence
- [ ] Job control: pause/resume/cancel/home/temp/LED/filtration

---

## Success Criteria

### Zero Breaking Changes:
- ✅ Headless mode works identically
- ✅ Desktop mode works identically
- ✅ Same build process (no bundler changes)
- ✅ Same API/WebSocket contracts
- ✅ Same HTML entry point
- ✅ All existing features preserved
- ✅ No migration required

### Code Quality Improvements:
- ✅ 15 focused modules vs. 1 monolithic file
- ✅ Each module ~200-300 lines (readable in one screen)
- ✅ Clear separation of concerns (shared/core/features/ui)
- ✅ Testable modules with minimal coupling
- ✅ Follows existing grid/ module pattern
- ✅ Type-safe with strict TypeScript

---

## Progress Tracking

### Phase 1: Shared Utilities
- [x] `shared/dom.ts`
- [x] `shared/formatting.ts`
- [x] `shared/icons.ts`
- [x] Update app.ts imports
- [x] Validation: `npm run type-check`

### Phase 2: Core State & Transport
- [x] `core/AppState.ts`
- [x] `core/Transport.ts`
- [x] Update app.ts imports
- [x] Validation: `npm run type-check`

### Phase 1: Features (Auth, Context, Layout)
- [x] `features/authentication.ts`
- [x] `features/context-switching.ts`
- [x] `features/layout-theme.ts`
- [x] Update app.ts imports
- [x] Validation: `npm run type-check && npm run lint`

### Phase 2: UI Components
- [x] `ui/panels.ts`
- [x] `ui/dialogs.ts`
- [x] `ui/header.ts`
- [x] Update app.ts imports
- [x] Validation: `npm run type-check`

### Phase 3: Domain Features
- [ ] `features/job-control.ts`
- [ ] `features/material-matching.ts`
- [ ] `features/spoolman.ts`
- [ ] `features/camera.ts`
- [ ] Update app.ts imports
- [ ] Validation: `npm run type-check`

### Phase 4: Orchestration & Validation
- [ ] Rewrite app.ts (~200-250 lines)
- [ ] Run full validation suite
- [ ] Manual testing (headless mode)
- [ ] Manual testing (desktop mode)
- [ ] Update this spec with completion status

---

## Notes & Learnings

- `setupDialogEventHandlers` now accepts dependency callbacks so modal wiring can stay in the UI layer without importing feature modules that have yet to be extracted. When job control/material matching modules land (Phase 3) they can register their handlers there.
- Header-specific DOM logic (edit-mode toggle) now lives in `ui/header.ts` with dependency injection for layout persistence to avoid a circular reference between `features/layout-theme.ts` and the new UI module.

---

## Completion

**Status:** ⏳ In Progress
**Completed:** [Date]
**Final Line Count:**
- Before: 3,522 lines (1 file)
- After: ~2,960 lines (15 files)
- app.ts: ~200-250 lines (orchestration only)
