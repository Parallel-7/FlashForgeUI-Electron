# Custom Shortcut Buttons - Implementation Status

**Feature:** Custom Topbar Shortcut Buttons
**Status:** In Progress - Core Infrastructure Complete
**Full Spec:** See `CUSTOM_SHORTCUT_BUTTONS_SPEC.md`

---

## Design Decisions Confirmed

1. **Global Configuration** - Same shortcuts across all printer contexts (not per-context)
2. **SVG Icons** - Using SVG instead of emoji for cross-platform consistency
3. **Dynamic Context** - Component dialogs follow active context switches
4. **Palette Status Display** - Pinned status shown in palette only, not in grid

---

## ✅ Completed

### Phase 1: Storage & Configuration Model (DONE)

**Created:**
- `src/ui/shortcuts/types.ts` - Type definitions (SlotNumber, ShortcutButtonConfig, SlotAssignment)
- `src/ui/shortcuts/ShortcutConfigManager.ts` - Configuration manager with localStorage persistence

**Features:**
- Load/save configuration from localStorage
- Validation and schema migration support
- Utility methods: `isComponentPinned()`, `getPinnedComponentIds()`, `setSlot()`, etc.
- Default configuration with 3 empty slots

### Phase 2: Shortcut Configuration Dialog (DONE)

**Created:**
- `src/windows/factories/ShortcutConfigWindowFactory.ts` - Dialog window factory
- `src/ipc/handlers/shortcut-config-handlers.ts` - IPC handlers
- `src/ui/shortcut-config-dialog/shortcut-config-dialog.html` - Dialog UI
- `src/ui/shortcut-config-dialog/shortcut-config-dialog.css` - Dialog styling
- `src/ui/shortcut-config-dialog/shortcut-config-dialog-preload.ts` - Preload script
- `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts` - Dialog renderer logic

**Features:**
- Modal dialog (540x680) with 3 slot configuration dropdowns
- Displays available components with pinned status
- Validates no duplicate assignments
- Clear slot buttons
- Apply/Cancel actions
- Status messages for user feedback

**IPC Handlers:**
- `shortcut-config:open` - Opens configuration dialog
- `shortcut-config:get-current` - Gets current config (forwards to main window renderer)
- `shortcut-config:save` - Saves config and notifies main window
- `shortcut-config:get-available-components` - Gets component list with pinned status

### Phase 4: Component Dialog (PARTIAL - Factories Only)

**Created:**
- `src/windows/factories/ComponentDialogWindowFactory.ts` - Dialog window factory
- `src/ipc/handlers/component-dialog-handlers.ts` - IPC handlers

**Features:**
- Component-specific dialog sizes (e.g., 500x400 for temperature controls)
- Modal, resizable dialogs with frameless/transparent styling
- `createComponentDialog(componentId)` function

**IPC Handlers:**
- `component-dialog:open` - Opens dialog for specified component

### Window Manager Updates (DONE)

**Modified:**
- `src/windows/WindowManager.ts`
  - Added `SHORTCUT_CONFIG_DIALOG` to WindowType enum
  - Added `COMPONENT_DIALOG` to WindowType enum
  - Added `get/set/hasShortcutConfigDialogWindow()` methods
  - Added `get/set/hasComponentDialogWindow()` methods

---

## 🚧 Remaining Work

### Phase 3: Topbar Integration (NOT STARTED)

**Files to Modify:**
- `src/index.html`
  - Add pin configuration button (📌 icon as SVG)
  - Add 3 shortcut button slots (hidden by default)
  - Buttons should be in `.left-controls` section

- `src/index.css`
  - Style pin config button
  - Style shortcut buttons with hover/active states
  - SVG icon styling

- `src/renderer.ts`
  - `initializeShortcutButtons()` - Setup on DOMContentLoaded
  - `updateShortcutButtons(config)` - Update button visibility/labels
  - `reloadGridLayout()` - Reload grid excluding pinned components
  - Listen to `shortcut-config:updated` IPC event
  - Listen to `shortcut-config:get-current-request` and respond with config from localStorage
  - Listen to `shortcut-config:save-request` and save to localStorage
  - Listen to `shortcut-config:get-components-request` and respond with component list
  - Handle shortcut button clicks → send `component-dialog:open` IPC

### Phase 4: Component Dialog UI (NOT STARTED)

**Files to Create:**
- `src/ui/component-dialog/component-dialog.html`
  - Dialog header with component name/icon
  - Close button
  - Component container div

- `src/ui/component-dialog/component-dialog.css`
  - Dialog container styling
  - Header/close button styling
  - Component wrapper styling

- `src/ui/component-dialog/component-dialog-preload.ts`
  - Expose IPC API: `onDialogInit(callback)`
  - Listen to `polling-update` IPC events
  - Get window close capability

- `src/ui/component-dialog/component-dialog.ts`
  - `initializeDialog(componentId)` - Create component instance
  - `createComponentInstance(componentId, container)` - Component factory switch statement
  - `setupEventListeners()` - Close button, polling updates
  - Create local `ComponentManager` instance
  - Register component and call `initialize()`
  - Listen to `polling-update` and call `componentManager.updateAll()`
  - **Important:** Follow active context - listen for context switches

**Component Imports Needed:**
```typescript
import { CameraPreviewComponent } from '../components/camera-preview/CameraPreviewComponent';
import { TemperatureControlsComponent } from '../components/temperature-controls/TemperatureControlsComponent';
// ... all other components
```

### Phase 5: Grid Synchronization (NOT STARTED)

**Files to Modify:**
- `src/ui/gridstack/ComponentRegistry.ts`
  - Add `isComponentAvailableForGrid(componentId): boolean`
  - Add `getAvailableComponents(): ComponentDefinition[]`

- `src/renderer.ts` (Grid initialization section)
  - Modify grid initialization to filter out pinned components
  - `getFilteredGridLayout()` - Filter layout widgets by pinned status
  - `onComponentPinned(componentId)` - Remove from grid if present
  - `onComponentUnpinned(componentId)` - Add back to grid with auto-position

**Key Logic:**
```typescript
// On grid init
const pinnedIds = shortcutConfigManager.getPinnedComponentIds();
const gridWidgets = layout.widgets.filter(w => !pinnedIds.includes(w.componentId));

// On config change
mainWindow.webContents.on('shortcut-config:updated', (config) => {
  updateShortcutButtons(config);
  reloadGridLayout(); // This filters out pinned components
});
```

### Phase 6: Palette Updates (NOT STARTED)

**Files to Modify:**
- `src/ui/palette/palette.ts`
  - Modify `updateComponentList()` to show pinned status
  - Add CSS classes: `.component-item.pinned`, `.component-item.available`
  - Show status badge: "📌 Pinned" or "Available"
  - Disable drag for pinned components
  - Listen to shortcut config changes and refresh palette

### Integration Tasks (NOT STARTED)

**1. Register IPC Handlers**
- Modify `src/ipc/handlers/index.ts`
  - Import and call `registerShortcutConfigHandlers()`
  - Import and call `registerComponentDialogHandlers()`

**2. Webpack Configuration**
- Add preload script entries to webpack config:
  - `shortcut-config-dialog-preload.ts` → `shortcut-config-dialog-preload.js`
  - `component-dialog-preload.ts` → `component-dialog-preload.js`

**3. HTML Files in Build**
- Ensure these HTML files are copied to build output:
  - `shortcut-config-dialog.html`
  - `component-dialog.html`

**4. Type Checking**
- Run `npm run type-check` or `npx tsc --noEmit`
- Fix any TypeScript errors
- Verify all imports are correct

---

## Files Created (11)

1. `src/ui/shortcuts/types.ts`
2. `src/ui/shortcuts/ShortcutConfigManager.ts`
3. `src/windows/factories/ShortcutConfigWindowFactory.ts`
4. `src/ipc/handlers/shortcut-config-handlers.ts`
5. `src/ui/shortcut-config-dialog/shortcut-config-dialog.html`
6. `src/ui/shortcut-config-dialog/shortcut-config-dialog.css`
7. `src/ui/shortcut-config-dialog/shortcut-config-dialog-preload.ts`
8. `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts`
9. `src/windows/factories/ComponentDialogWindowFactory.ts`
10. `src/ipc/handlers/component-dialog-handlers.ts`
11. `ai_specs/CUSTOM_SHORTCUT_BUTTONS_STATUS.md` (this file)

## Files Modified (1)

1. `src/windows/WindowManager.ts`

---

## Testing Checklist (After Implementation)

**Configuration:**
- [ ] Pin config button opens dialog
- [ ] Can assign components to slots
- [ ] Can clear slot assignments
- [ ] Configuration persists across restarts
- [ ] Duplicate assignments prevented

**Topbar:**
- [ ] Shortcut buttons appear when configured
- [ ] Shortcut buttons show correct component names/icons
- [ ] Maximum 3 buttons visible
- [ ] Clicking shortcut opens component dialog

**Component Dialogs:**
- [ ] Dialog opens with correct component
- [ ] Component receives real-time polling updates
- [ ] Component functionality identical to grid
- [ ] Dialog properly cleans up on close
- [ ] Follows active context switches

**Grid Sync:**
- [ ] Pinned components excluded from grid on load
- [ ] Pinning removes component from grid
- [ ] Unpinning adds component back to grid
- [ ] Layout saves correctly

**Palette:**
- [ ] Shows pinned status for components
- [ ] Updates when configuration changes

---

## Architecture Notes

### IPC Communication Pattern

The shortcut config handlers use a **forwarding pattern** because the main process doesn't have access to:
- `localStorage` (renderer-only)
- `ComponentRegistry` (renderer-only)
- `ShortcutConfigManager` (renderer-only, uses localStorage)

**Flow:**
```
Shortcut Config Dialog → Main Process → Main Window Renderer
        (IPC invoke)         (forwards)    (has localStorage access)
                                ↓
                        Response returned
```

**Main window renderer must handle:**
- `shortcut-config:get-current-request` → respond with `shortcutConfigManager.load()`
- `shortcut-config:save-request` → call `shortcutConfigManager.save(config)`
- `shortcut-config:get-components-request` → respond with component list + pinned status

### Component Dialog Polling

Component dialogs listen to the same `polling-update` IPC channel as main window. Since dialogs follow active context (per user decision), they'll receive updates for the active context automatically.

```typescript
// In component-dialog.ts
window.api.receive('polling-update', (data: PollingData) => {
  const updateData: ComponentUpdateData = {
    pollingData: data,
    timestamp: new Date().toISOString(),
    // ...
  };
  dialogComponentManager.updateAll(updateData);
});
```

---

## Next Session Instructions

**Start with Phase 3 (Topbar Integration):**
1. Update `src/index.html` with pin button + shortcut button slots
2. Style in `src/index.css` with SVG icons
3. Add renderer.ts handlers for IPC forwarding and shortcut button logic

**Then Phase 4 (Component Dialog UI):**
1. Create HTML/CSS/preload/renderer files
2. Implement component factory and polling handlers

**Then Phase 5 & 6:**
1. Grid synchronization logic
2. Palette updates

**Finally Integration:**
1. Register IPC handlers in index
2. Add webpack entries
3. Type check and fix errors

---

**Reference:** Full implementation details in `CUSTOM_SHORTCUT_BUTTONS_SPEC.md`
