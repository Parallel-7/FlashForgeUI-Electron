# Custom Shortcut Buttons Feature - Implementation Specification

**Feature Name:** Custom Topbar Shortcut Buttons
**Status:** Planning Complete - Ready for Implementation
**Date Created:** 2025-10-18
**Estimated Complexity:** Medium (leverages existing architecture)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Feature Overview](#feature-overview)
3. [Architecture Analysis](#architecture-analysis)
4. [Design Decisions](#design-decisions)
5. [Technical Specification](#technical-specification)
6. [Implementation Plan](#implementation-plan)
7. [File Changes](#file-changes)
8. [Testing Criteria](#testing-criteria)
9. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### What is this feature?
Add up to 3 customizable shortcut buttons to the application topbar that allow users to "pin" grid components as quick-access buttons. Clicking a shortcut button opens the component in a modal dialog with full real-time functionality.

### Why is this feasible?
The existing architecture is **perfectly designed** for this feature:
- ✅ **Zero code duplication needed** - Components are self-contained and work in any container
- ✅ **Real-time updates work automatically** - ComponentManager distributes polling updates to all instances
- ✅ **Dialog system is ready** - Existing pattern for modal windows with IPC communication
- ✅ **Storage system exists** - localStorage with debouncing already implemented
- ✅ **BaseComponent design enables this** - Components don't care about their parent container

### Key Insight
**The same component class instance works identically in both grid and dialog contexts** because components:
- Are self-contained with their own templates
- Receive updates via ComponentManager
- Don't depend on their parent container
- Handle their own event listeners and cleanup

---

## Feature Overview

### User Experience

**Before:**
```
Topbar: [Connect] [Settings] [Status] [IFS] [Logs]

Grid: Contains all 10+ components in customizable layout
```

**After:**
```
Topbar: [Connect] [Settings] [Status] [IFS] [Logs] [📌] [🌡️Temp] [📷Cam] [📊Stats]
                                                      ↑      ↑        ↑       ↑
                                              Pin Config  Slot 1   Slot 2  Slot 3

Grid: Contains remaining components (pinned ones excluded)
```

### User Workflow

1. **Configure Shortcuts:**
   - User clicks 📌 (Pin Config) button in topbar
   - Dialog opens showing 3 slot dropdowns
   - User selects components to assign to each slot (max 3)
   - User clicks "Apply Changes"
   - Topbar updates with new shortcut buttons
   - Selected components are removed from grid

2. **Use Shortcuts:**
   - User clicks a shortcut button (e.g., 🌡️Temp)
   - Modal dialog opens with Temperature Controls component
   - Component receives real-time polling updates
   - Component works identically to grid version
   - User closes dialog when done

3. **Modify Shortcuts:**
   - User opens pin config again
   - Removes component from slot or changes assignment
   - Removed components return to grid automatically
   - Configuration persists across app restarts

---

## Architecture Analysis

### Existing Systems Leveraged

#### 1. Component System (`src/ui/components/base/component.ts`)
```typescript
export abstract class BaseComponent implements IComponent {
  protected container: HTMLElement | null = null;
  abstract readonly componentId: string;
  abstract readonly templateHTML: string;

  async initialize(): Promise<void> { /* ... */ }
  abstract update(data: ComponentUpdateData): void;
  destroy(): void { /* ... */ }
}
```

**Why this works:**
- Components accept any `HTMLElement` as parent container
- Components are initialized with `await component.initialize()`
- Components receive updates via `component.update(data)`
- Components clean up with `component.destroy()`
- **No dependency on grid or specific parent structure**

#### 2. ComponentManager (`src/ui/components/ComponentManager.ts`)
```typescript
class ComponentManager {
  registerComponent(component: BaseComponent): void { /* ... */ }
  async initializeAll(): Promise<void> { /* ... */ }
  updateAll(data: ComponentUpdateData): void { /* ... */ }
}
```

**Why this works:**
- Centralized update distribution to all registered components
- Works with any component instance regardless of location
- Already handles polling data distribution
- **Dialog can create its own ComponentManager instance**

#### 3. Polling System (`src/renderer.ts:1388`)
```typescript
window.api.receive('polling-update', (data: unknown) => {
  const pollingData = data as PollingData;
  lastPollingData = pollingData;

  const updateData: ComponentUpdateData = {
    pollingData: pollingData,
    timestamp: new Date().toISOString(),
    // ...
  };

  componentManager.updateAll(updateData);
});
```

**Why this works:**
- Main process broadcasts polling updates via IPC
- ANY renderer can listen to 'polling-update' events
- Dialog windows can set up the same listener
- **Components automatically receive real-time updates**

#### 4. Dialog Factory Pattern (`src/windows/factories/DialogWindowFactory.ts`)
```typescript
export const createInputDialog = (options: InputDialogOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    const dialogWindow = createModalWindow(mainWindow, WINDOW_SIZES.INPUT_DIALOG, /* ... */);
    // IPC setup, event handling, promise resolution
  });
};
```

**Why this works:**
- Existing pattern for modal dialog windows
- Promise-based result handling
- Proper IPC communication and cleanup
- **Just need to adapt pattern for component dialogs**

#### 5. Storage System (`src/ui/gridstack/LayoutPersistence.ts`)
```typescript
class LayoutPersistence {
  save(layout: LayoutConfig, contextId?: string, immediate = false): void { /* ... */ }
  load(contextId?: string): LayoutConfig { /* ... */ }
}
```

**Why this works:**
- localStorage with debouncing already implemented
- Validation and migration support
- **Can add shortcut config to same pattern**

---

## Design Decisions

### User-Confirmed Decisions

1. **Modal Dialogs** (vs Non-modal)
   - Shortcut buttons open modal (blocking) dialogs
   - Prevents confusion with multiple simultaneous instances
   - Simpler state management
   - User focuses on one component at a time

2. **Settings UI** (vs Grid Pin Icons)
   - Dedicated pin configuration dialog
   - Accessed via 📌 button in topbar
   - Clear, centralized management
   - All configuration in one place

3. **Mutual Exclusivity** (Component Placement)
   - Components exist EITHER in grid OR as pinned button (never both)
   - When pinned → removed from grid
   - When unpinned → returns to grid
   - Clear user mental model

4. **Global Storage** (vs Per-Context)
   - Same shortcut configuration for all printer contexts
   - Simpler, consistent experience
   - Less configuration overhead

5. **Pin Button in Topbar** (vs Settings Screen)
   - New 📌 button in topbar
   - Sits right next to shortcut buttons it manages
   - Contextual and discoverable
   - Keeps main settings focused on printer settings

---

## Technical Specification

### Storage Schema

```typescript
/**
 * Shortcut button configuration stored in localStorage
 * Key: 'shortcut-buttons-config'
 */
interface ShortcutButtonConfig {
  /** Schema version for migration support */
  version: number;

  /** Component assignments for each slot */
  slots: {
    slot1: string | null; // componentId (e.g., 'temperature-controls') or null
    slot2: string | null;
    slot3: string | null;
  };

  /** ISO timestamp of last modification */
  lastModified: string;
}

/**
 * Example stored data:
 * {
 *   "version": 1,
 *   "slots": {
 *     "slot1": "temperature-controls",
 *     "slot2": "camera-preview",
 *     "slot3": null
 *   },
 *   "lastModified": "2025-10-18T14:32:00.000Z"
 * }
 */
```

### IPC Communication Channels

```typescript
// Shortcut Configuration Dialog
'shortcut-config:open'                    // Open pin configuration dialog
'shortcut-config:get-current'             // Get current shortcut configuration
'shortcut-config:save'                    // Save new configuration
'shortcut-config:get-available-components' // Get list of components available for pinning

// Component Dialogs
'component-dialog:open'      // Open component dialog (args: componentId, componentName)
'component-dialog:close'     // Close component dialog
'component-dialog:get-info'  // Get component info for rendering (args: componentId)
'polling-update'             // Existing channel - dialog listens for updates
```

### Component Dialog Flow

```
User Clicks Shortcut Button
         ↓
Main Process: IPC handler 'component-dialog:open' receives componentId
         ↓
Main Process: Create modal BrowserWindow
         ↓
Dialog Window: Loads component-dialog.html
         ↓
Dialog Renderer: component-dialog.ts executes
         ↓
Dialog: Send 'component-dialog:get-info' with componentId
         ↓
Main Process: Return component metadata (name, icon, etc.)
         ↓
Dialog: Create container element
         ↓
Dialog: Instantiate component class
  Example: new TemperatureControlsComponent(container)
         ↓
Dialog: Create local ComponentManager instance
         ↓
Dialog: Register component with local manager
         ↓
Dialog: Call await component.initialize()
         ↓
Component: Renders template, sets up event listeners
         ↓
Dialog: Listen to 'polling-update' IPC channel
         ↓
Main Process: Broadcasts polling-update events (existing)
         ↓
Dialog: Receive polling data
         ↓
Dialog: Call componentManager.updateAll(data)
         ↓
Component: update() method called with polling data
         ↓
Component: Updates UI in real-time (same as in grid)
         ↓
User: Closes dialog window
         ↓
Dialog: component.destroy() called
         ↓
Dialog: Window closed, resources cleaned up
```

### Grid Synchronization Logic

```typescript
// When loading grid layout
function initializeGridStack() {
  const layout = layoutPersistence.load();
  const shortcutConfig = shortcutConfigManager.load();
  const pinnedComponentIds = Object.values(shortcutConfig.slots).filter(id => id !== null);

  // Filter out pinned components from grid widgets
  const gridWidgets = layout.widgets.filter(widget =>
    !pinnedComponentIds.includes(widget.componentId)
  );

  // Render only non-pinned components
  for (const widget of gridWidgets) {
    createGridWidget(widget.componentId);
  }
}

// When pinning a component
function pinComponentToSlot(componentId: string, slot: number) {
  // 1. Remove from grid if present
  const gridWidget = findGridWidgetByComponentId(componentId);
  if (gridWidget) {
    gridStackManager.removeWidget(gridWidget);
  }

  // 2. Update shortcut config
  shortcutConfigManager.setSlot(slot, componentId);

  // 3. Save layout without this component
  const updatedLayout = gridStackManager.serialize();
  layoutPersistence.save({ widgets: updatedLayout });

  // 4. Update topbar
  updateShortcutButtons();
}

// When unpinning a component
function unpinComponentFromSlot(slot: number) {
  const componentId = shortcutConfigManager.getSlot(slot);
  if (!componentId) return;

  // 1. Clear slot
  shortcutConfigManager.clearSlot(slot);

  // 2. Add back to grid with auto-position
  const componentDef = getComponentDefinition(componentId);
  const widget = createGridWidget(componentId);
  gridStackManager.addWidget({
    componentId,
    w: componentDef.defaultWidth,
    h: componentDef.defaultHeight,
    autoPosition: true
  }, widget);

  // 3. Save updated layout
  const updatedLayout = gridStackManager.serialize();
  layoutPersistence.save({ widgets: updatedLayout });

  // 4. Update topbar
  updateShortcutButtons();
}
```

---

## Implementation Plan

### Phase 1: Storage & Configuration Model

**Files to Create:**
1. `src/ui/shortcuts/types.ts`
2. `src/ui/shortcuts/ShortcutConfigManager.ts`

**Key Components:**

#### `src/ui/shortcuts/types.ts`
```typescript
/**
 * Component slot identifier
 */
export type SlotNumber = 1 | 2 | 3;

/**
 * Shortcut button configuration
 */
export interface ShortcutButtonConfig {
  version: number;
  slots: {
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
  };
  lastModified: string;
}

/**
 * Slot assignment for rendering
 */
export interface SlotAssignment {
  slotNumber: SlotNumber;
  componentId: string | null;
  componentName: string | null;
  componentIcon: string | null;
}
```

#### `src/ui/shortcuts/ShortcutConfigManager.ts`
```typescript
/**
 * Manager for shortcut button configuration
 * Handles loading, saving, and validation of shortcut assignments
 */
export class ShortcutConfigManager {
  private readonly STORAGE_KEY = 'shortcut-buttons-config';
  private readonly DEFAULT_CONFIG: ShortcutButtonConfig = {
    version: 1,
    slots: { slot1: null, slot2: null, slot3: null },
    lastModified: new Date().toISOString()
  };

  load(): ShortcutButtonConfig { /* ... */ }
  save(config: ShortcutButtonConfig): void { /* ... */ }
  setSlot(slot: SlotNumber, componentId: string | null): void { /* ... */ }
  getSlot(slot: SlotNumber): string | null { /* ... */ }
  clearSlot(slot: SlotNumber): void { /* ... */ }
  getAllAssignments(): SlotAssignment[] { /* ... */ }
  isComponentPinned(componentId: string): boolean { /* ... */ }
  getPinnedComponentIds(): string[] { /* ... */ }
}

export const shortcutConfigManager = new ShortcutConfigManager();
```

---

### Phase 2: Shortcut Configuration Dialog

**Files to Create:**
1. `src/windows/factories/ShortcutConfigWindowFactory.ts`
2. `src/ui/shortcut-config-dialog/shortcut-config-dialog.html`
3. `src/ui/shortcut-config-dialog/shortcut-config-dialog.css`
4. `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts`
5. `src/ui/shortcut-config-dialog/shortcut-config-dialog-preload.ts`
6. `src/ipc/handlers/shortcut-config-handlers.ts`

#### UI Design

```
┌────────────────────────────────────────────────────┐
│ Shortcut Button Configuration              [Close] │
├────────────────────────────────────────────────────┤
│                                                     │
│  Configure up to 3 quick-access buttons for the    │
│  topbar. Components can be in the grid OR pinned,  │
│  but not both.                                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Slot 1                                         │ │
│  │ ┌───────────────────────────────────────────┐ │ │
│  │ │ Temperature Controls                    ▼ │ │ │
│  │ └───────────────────────────────────────────┘ │ │
│  │ [Clear Slot 1]                                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Slot 2                                         │ │
│  │ ┌───────────────────────────────────────────┐ │ │
│  │ │ Camera Preview                          ▼ │ │ │
│  │ └───────────────────────────────────────────┘ │ │
│  │ [Clear Slot 2]                                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Slot 3                                         │ │
│  │ ┌───────────────────────────────────────────┐ │ │
│  │ │ None                                    ▼ │ │ │
│  │ └───────────────────────────────────────────┘ │ │
│  │ [Clear Slot 3]                                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Available Components:                             │
│  • Job Statistics                                  │
│  • Printer Status                                  │
│  • Model Preview                                   │
│  • Filtration Controls                             │
│  • Additional Information                          │
│  • Log Panel                                       │
│  • Job Information                                 │
│  • Controls Grid                                   │
│                                                     │
│  (Temperature Controls and Camera Preview are      │
│   currently pinned and unavailable for grid)       │
│                                                     │
│                        [Cancel] [Apply Changes]    │
└────────────────────────────────────────────────────┘
```

#### IPC Handler Implementation

```typescript
// src/ipc/handlers/shortcut-config-handlers.ts
import { ipcMain } from 'electron';
import { shortcutConfigManager } from '../../ui/shortcuts/ShortcutConfigManager';
import { getAllComponents } from '../../ui/gridstack/ComponentRegistry';

export function registerShortcutConfigHandlers(): void {
  // Get current configuration
  ipcMain.handle('shortcut-config:get-current', () => {
    return shortcutConfigManager.load();
  });

  // Save configuration
  ipcMain.handle('shortcut-config:save', (_event, config: ShortcutButtonConfig) => {
    shortcutConfigManager.save(config);

    // Notify main window to update topbar
    const mainWindow = getWindowManager().getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('shortcut-config:updated', config);
    }

    return { success: true };
  });

  // Get available components
  ipcMain.handle('shortcut-config:get-available-components', () => {
    const allComponents = getAllComponents();
    const pinnedIds = shortcutConfigManager.getPinnedComponentIds();

    return allComponents.map(comp => ({
      ...comp,
      isPinned: pinnedIds.includes(comp.id)
    }));
  });
}
```

---

### Phase 3: Topbar Integration

**Files to Modify:**
1. `src/index.html`
2. `src/index.css`
3. `src/renderer.ts`

#### HTML Changes (`src/index.html`)

```html
<div class="left-controls">
  <button id="btn-connect">Connect</button>
  <button id="btn-settings">Settings</button>
  <button id="btn-status">Status</button>
  <button id="btn-ifs" class="hidden">IFS</button>
  <button id="btn-logs">Logs</button>

  <!-- NEW: Pin Configuration Button -->
  <button id="btn-pin-config" title="Configure Shortcuts" aria-label="Configure shortcut buttons">📌</button>

  <!-- NEW: Shortcut Button Slots (hidden by default) -->
  <button id="btn-shortcut-1" class="shortcut-button hidden" data-slot="1" data-component-id=""></button>
  <button id="btn-shortcut-2" class="shortcut-button hidden" data-slot="2" data-component-id=""></button>
  <button id="btn-shortcut-3" class="shortcut-button hidden" data-slot="3" data-component-id=""></button>
</div>
```

#### CSS Styling (`src/index.css`)

```css
/* Pin configuration button */
#btn-pin-config {
  font-size: 16px;
  padding: 4px 8px;
  margin-left: 8px;
  border-left: 1px solid var(--border-color);
}

#btn-pin-config:hover {
  background-color: var(--button-hover-bg);
}

/* Shortcut buttons */
.shortcut-button {
  display: none;
  padding: 4px 12px;
  font-size: 14px;
  border: none;
  background-color: var(--shortcut-button-bg, #2a2a2a);
  color: var(--text-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.shortcut-button:not(.hidden) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shortcut-button:hover {
  background-color: var(--shortcut-button-hover-bg, #3a3a3a);
}

.shortcut-button:active {
  background-color: var(--shortcut-button-active-bg, #4a4a4a);
}

/* Shortcut button icon */
.shortcut-button::before {
  content: attr(data-icon);
  font-size: 16px;
}
```

#### Renderer Integration (`src/renderer.ts`)

```typescript
// Add after existing initialization code

/**
 * Initialize shortcut buttons in topbar
 */
function initializeShortcutButtons(): void {
  console.log('[ShortcutButtons] Initializing topbar shortcuts');

  // Load configuration
  const config = shortcutConfigManager.load();
  updateShortcutButtons(config);

  // Setup pin config button
  const pinConfigBtn = document.getElementById('btn-pin-config');
  if (pinConfigBtn) {
    pinConfigBtn.addEventListener('click', () => {
      if (window.api?.send) {
        window.api.send('shortcut-config:open');
      }
    });
  }

  // Setup shortcut button click handlers
  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`btn-shortcut-${i}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const componentId = btn.getAttribute('data-component-id');
        if (componentId && window.api?.send) {
          window.api.send('component-dialog:open', componentId);
        }
      });
    }
  }

  // Listen for config updates
  if (window.api) {
    window.api.receive('shortcut-config:updated', (config: unknown) => {
      updateShortcutButtons(config as ShortcutButtonConfig);

      // Reload grid to reflect changes
      reloadGridLayout();
    });
  }

  console.log('[ShortcutButtons] Initialization complete');
}

/**
 * Update topbar shortcut buttons based on configuration
 */
function updateShortcutButtons(config: ShortcutButtonConfig): void {
  for (let i = 1; i <= 3; i++) {
    const slotKey = `slot${i}` as keyof typeof config.slots;
    const componentId = config.slots[slotKey];
    const btn = document.getElementById(`btn-shortcut-${i}`);

    if (!btn) continue;

    if (componentId) {
      const componentDef = getComponentDefinition(componentId);
      if (componentDef) {
        btn.setAttribute('data-component-id', componentId);
        btn.setAttribute('data-icon', componentDef.icon || '📦');
        btn.textContent = componentDef.displayName;
        btn.classList.remove('hidden');
      }
    } else {
      btn.setAttribute('data-component-id', '');
      btn.classList.add('hidden');
    }
  }
}

/**
 * Reload grid layout excluding pinned components
 */
function reloadGridLayout(): void {
  const config = shortcutConfigManager.load();
  const pinnedIds = Object.values(config.slots).filter(id => id !== null);

  // Clear grid
  gridStackManager.clear(true);

  // Reload layout
  const layout = layoutPersistence.load();
  const gridWidgets = layout.widgets.filter(widget =>
    !pinnedIds.includes(widget.componentId)
  );

  // Re-add non-pinned widgets
  for (const widget of gridWidgets) {
    // ... (existing widget creation logic)
  }
}

// Call during initialization
document.addEventListener('DOMContentLoaded', () => {
  // ... existing initialization
  initializeShortcutButtons();
});
```

---

### Phase 4: Component Dialog Windows

**Files to Create:**
1. `src/windows/factories/ComponentDialogWindowFactory.ts`
2. `src/ui/component-dialog/component-dialog.html`
3. `src/ui/component-dialog/component-dialog.css`
4. `src/ui/component-dialog/component-dialog.ts`
5. `src/ui/component-dialog/component-dialog-preload.ts`
6. `src/ipc/handlers/component-dialog-handlers.ts`

#### Window Factory (`ComponentDialogWindowFactory.ts`)

```typescript
import { BrowserWindow } from 'electron';
import * as path from 'path';
import { getWindowManager } from '../WindowManager';
import { createModalWindow, createPreloadPath } from '../shared/WindowConfig';

/**
 * Component dialog size configuration
 */
const COMPONENT_DIALOG_SIZES: Record<string, { width: number; height: number }> = {
  'temperature-controls': { width: 500, height: 400 },
  'camera-preview': { width: 800, height: 600 },
  'job-stats': { width: 600, height: 500 },
  'printer-status': { width: 550, height: 450 },
  'model-preview': { width: 700, height: 600 },
  'additional-info': { width: 500, height: 400 },
  'log-panel': { width: 700, height: 500 },
  'job-info': { width: 550, height: 450 },
  'controls-grid': { width: 600, height: 500 },
  'filtration-controls': { width: 500, height: 400 },
  // Default size for unknown components
  'default': { width: 600, height: 500 }
};

export function createComponentDialog(componentId: string): BrowserWindow {
  const windowManager = getWindowManager();
  const mainWindow = windowManager.getMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window not available for component dialog');
  }

  // Get size for this component
  const size = COMPONENT_DIALOG_SIZES[componentId] || COMPONENT_DIALOG_SIZES.default;

  // Create modal dialog
  const dialogWindow = createModalWindow(
    mainWindow,
    {
      width: size.width,
      height: size.height,
      minWidth: size.width - 100,
      minHeight: size.height - 100
    },
    createPreloadPath(path.join(__dirname, '../../ui/component-dialog/component-dialog-preload.js')),
    {
      resizable: true,
      frame: false,
      transparent: true,
      title: `Component: ${componentId}`
    }
  );

  // Load dialog HTML
  void dialogWindow.loadFile(path.join(__dirname, '../../ui/component-dialog/component-dialog.html'));

  // Send component ID once loaded
  dialogWindow.webContents.once('did-finish-load', () => {
    dialogWindow.webContents.send('component-dialog:init', componentId);
  });

  // Track in window manager
  windowManager.setComponentDialogWindow(dialogWindow);

  // Cleanup on close
  dialogWindow.on('closed', () => {
    windowManager.setComponentDialogWindow(null);
  });

  return dialogWindow;
}
```

#### Dialog HTML (`component-dialog.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Component Dialog</title>
  <link rel="stylesheet" href="component-dialog.css">
</head>
<body>
  <div class="dialog-container">
    <!-- Dialog Header -->
    <div class="dialog-header">
      <div class="dialog-title">
        <span class="dialog-icon" id="dialog-icon">📦</span>
        <span class="dialog-title-text" id="dialog-title">Component</span>
      </div>
      <button class="dialog-close" id="btn-close" aria-label="Close">×</button>
    </div>

    <!-- Component Container -->
    <div class="dialog-content">
      <div id="component-container" class="component-wrapper"></div>
    </div>
  </div>
</body>
</html>
```

#### Dialog CSS (`component-dialog.css`)

```css
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: transparent;
  overflow: hidden;
}

.dialog-container {
  width: 100vw;
  height: 100vh;
  background: var(--window-bg, #1e1e1e);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--header-bg, #2a2a2a);
  border-bottom: 1px solid var(--border-color, #3a3a3a);
  -webkit-app-region: drag;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #ffffff);
}

.dialog-icon {
  font-size: 18px;
}

.dialog-close {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  color: var(--text-color, #ffffff);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.dialog-close:hover {
  background-color: var(--button-hover-bg, #3a3a3a);
}

.dialog-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.component-wrapper {
  width: 100%;
  height: 100%;
}
```

#### Dialog Renderer (`component-dialog.ts`)

```typescript
import { ComponentManager } from '../components/ComponentManager';
import { getComponentDefinition } from '../gridstack/ComponentRegistry';
import {
  CameraPreviewComponent,
  TemperatureControlsComponent,
  JobStatsComponent,
  PrinterStatusComponent,
  ModelPreviewComponent,
  AdditionalInfoComponent,
  LogPanelComponent,
  JobInfoComponent,
  ControlsGridComponent,
  FiltrationControlsComponent
} from '../components';
import type { ComponentUpdateData } from '../components/base/types';
import type { PollingData } from '../../types/polling';

// Local component manager for this dialog
const dialogComponentManager = new ComponentManager();

// Current component info
let currentComponentId: string | null = null;

/**
 * Initialize component dialog
 */
async function initializeDialog(componentId: string): Promise<void> {
  console.log(`[ComponentDialog] Initializing with component: ${componentId}`);

  currentComponentId = componentId;

  // Get component definition
  const componentDef = getComponentDefinition(componentId);
  if (!componentDef) {
    console.error(`[ComponentDialog] Component definition not found: ${componentId}`);
    return;
  }

  // Update dialog title and icon
  const titleElement = document.getElementById('dialog-title');
  const iconElement = document.getElementById('dialog-icon');

  if (titleElement) titleElement.textContent = componentDef.displayName;
  if (iconElement) iconElement.textContent = componentDef.icon || '📦';

  // Get component container
  const container = document.getElementById('component-container');
  if (!container) {
    console.error('[ComponentDialog] Component container not found');
    return;
  }

  // Create component instance
  const component = createComponentInstance(componentId, container as HTMLElement);
  if (!component) {
    console.error(`[ComponentDialog] Failed to create component instance: ${componentId}`);
    return;
  }

  // Register and initialize
  dialogComponentManager.registerComponent(component);
  await dialogComponentManager.initializeAll();

  console.log(`[ComponentDialog] Component initialized: ${componentId}`);
}

/**
 * Create component instance based on component ID
 */
function createComponentInstance(componentId: string, container: HTMLElement) {
  switch (componentId) {
    case 'camera-preview':
      return new CameraPreviewComponent(container);
    case 'temperature-controls':
      return new TemperatureControlsComponent(container);
    case 'job-stats':
      return new JobStatsComponent(container);
    case 'printer-status':
      return new PrinterStatusComponent(container);
    case 'model-preview':
      return new ModelPreviewComponent(container);
    case 'additional-info':
      return new AdditionalInfoComponent(container);
    case 'log-panel':
      return new LogPanelComponent(container);
    case 'job-info':
      return new JobInfoComponent(container);
    case 'controls-grid':
      return new ControlsGridComponent(container);
    case 'filtration-controls':
      return new FiltrationControlsComponent(container);
    default:
      console.error(`Unknown component ID: ${componentId}`);
      return null;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Close button
  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }

  // Listen for polling updates from main process
  if (window.api) {
    window.api.receive('polling-update', (data: unknown) => {
      const pollingData = data as PollingData;

      if (dialogComponentManager.isInitialized()) {
        const updateData: ComponentUpdateData = {
          pollingData: pollingData,
          timestamp: new Date().toISOString(),
          printerState: pollingData.printerStatus?.state,
          connectionState: pollingData.isConnected
        };

        dialogComponentManager.updateAll(updateData);
      }
    });
  }

  // Listen for initialization from main process
  if (window.api) {
    window.api.receive('component-dialog:init', async (componentId: unknown) => {
      if (typeof componentId === 'string') {
        await initializeDialog(componentId);
      }
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ComponentDialog] DOM ready, setting up event listeners');
  setupEventListeners();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  console.log('[ComponentDialog] Cleaning up component manager');
  dialogComponentManager.destroyAll();
});
```

#### IPC Handlers (`component-dialog-handlers.ts`)

```typescript
import { ipcMain } from 'electron';
import { createComponentDialog } from '../../windows/factories/ComponentDialogWindowFactory';
import { getComponentDefinition } from '../../ui/gridstack/ComponentRegistry';

export function registerComponentDialogHandlers(): void {
  // Open component dialog
  ipcMain.on('component-dialog:open', (_event, componentId: string) => {
    console.log(`[IPC] Opening component dialog for: ${componentId}`);

    try {
      createComponentDialog(componentId);
    } catch (error) {
      console.error('[IPC] Failed to create component dialog:', error);
    }
  });

  // Get component info
  ipcMain.handle('component-dialog:get-info', (_event, componentId: string) => {
    const definition = getComponentDefinition(componentId);

    if (!definition) {
      return { success: false, error: 'Component not found' };
    }

    return {
      success: true,
      data: {
        id: definition.id,
        displayName: definition.displayName,
        icon: definition.icon,
        category: definition.category
      }
    };
  });
}
```

---

### Phase 5: Grid Integration & Synchronization

**Files to Modify:**
1. `src/renderer.ts` - Grid initialization and synchronization
2. `src/ui/gridstack/ComponentRegistry.ts` - Add availability checking
3. `src/ui/palette/palette.ts` - Update component availability
4. `src/windows/WindowManager.ts` - Track component dialog window

#### Grid Synchronization (`src/renderer.ts`)

Add these functions to handle grid/shortcut synchronization:

```typescript
/**
 * Filter grid layout to exclude pinned components
 */
function getFilteredGridLayout(): GridStackWidgetConfig[] {
  const layout = layoutPersistence.load();
  const shortcutConfig = shortcutConfigManager.load();
  const pinnedIds = Object.values(shortcutConfig.slots).filter(id => id !== null);

  return layout.widgets.filter(widget =>
    !pinnedIds.includes(widget.componentId)
  );
}

/**
 * Initialize grid with shortcut-aware filtering
 */
async function initializeGridStack(): Promise<void> {
  // ... existing grid initialization code ...

  // Load filtered widgets (excluding pinned components)
  const filteredWidgets = getFilteredGridLayout();

  for (const widgetConfig of filteredWidgets) {
    // ... existing widget creation code ...
  }
}

/**
 * Handle component pinned to shortcut
 */
function onComponentPinned(componentId: string): void {
  console.log(`[Grid] Component pinned: ${componentId}`);

  // Find and remove from grid if present
  const gridItems = gridStackManager.getGrid()?.getGridItems() || [];
  const widgetToRemove = Array.from(gridItems).find(item =>
    item.getAttribute('data-component-id') === componentId
  );

  if (widgetToRemove) {
    // Get component instance before removing widget
    const contentContainer = widgetToRemove.querySelector('.grid-stack-item-content') as HTMLElement;
    if (contentContainer) {
      const component = componentManager.getComponent(componentId);
      if (component) {
        // Destroy component instance
        componentManager.removeComponent(componentId);
      }
    }

    // Remove widget from grid
    gridStackManager.removeWidget(widgetToRemove as HTMLElement);

    // Save updated layout
    const updatedLayout = gridStackManager.serialize();
    layoutPersistence.save({ widgets: updatedLayout });
  }
}

/**
 * Handle component unpinned from shortcut
 */
async function onComponentUnpinned(componentId: string): Promise<void> {
  console.log(`[Grid] Component unpinned: ${componentId}`);

  // Get component definition
  const componentDef = getComponentDefinition(componentId);
  if (!componentDef) {
    console.error(`Component definition not found: ${componentId}`);
    return;
  }

  // Create grid widget
  const widgetElement = createGridWidget(componentId);

  // Add to grid with auto-position
  const config: GridStackWidgetConfig = {
    componentId,
    w: componentDef.defaultWidth,
    h: componentDef.defaultHeight,
    minW: componentDef.minWidth,
    minH: componentDef.minHeight,
    id: `widget-${componentId}`,
    autoPosition: true
  };

  const addedWidget = gridStackManager.addWidget(config, widgetElement);

  if (addedWidget) {
    const contentContainer = addedWidget.querySelector('.grid-stack-item-content') as HTMLElement;

    if (contentContainer) {
      // Create and register component
      const component = createComponentForGrid(componentId, contentContainer);

      if (component) {
        componentManager.registerComponent(component);
        await component.initialize();

        // Update with last polling data if available
        if (lastPollingData) {
          const updateData: ComponentUpdateData = {
            pollingData: lastPollingData,
            timestamp: new Date().toISOString(),
            printerState: lastPollingData.printerStatus?.state,
            connectionState: lastPollingData.isConnected
          };
          component.update(updateData);
        }
      }
    }
  }

  // Save updated layout
  const updatedLayout = gridStackManager.serialize();
  layoutPersistence.save({ widgets: updatedLayout });
}
```

#### Component Registry Updates (`ComponentRegistry.ts`)

```typescript
/**
 * Check if component is available for grid placement
 * (not pinned as shortcut)
 */
export function isComponentAvailableForGrid(componentId: string): boolean {
  const pinnedIds = shortcutConfigManager.getPinnedComponentIds();
  return !pinnedIds.includes(componentId);
}

/**
 * Get all components available for grid
 */
export function getAvailableComponents(): ComponentDefinition[] {
  const allComponents = getAllComponents();
  const pinnedIds = shortcutConfigManager.getPinnedComponentIds();

  return allComponents.filter(comp => !pinnedIds.includes(comp.id));
}
```

#### Palette Updates (`palette.ts`)

```typescript
/**
 * Update component list considering shortcut status
 */
function updateComponentList(): void {
  const componentList = document.getElementById('component-list');
  if (!componentList) return;

  const components = getAllComponents();
  const pinnedIds = shortcutConfigManager.getPinnedComponentIds();
  const gridComponentIds = getCurrentGridComponentIds(); // Get from grid state

  componentList.innerHTML = components.map(comp => {
    const isPinned = pinnedIds.includes(comp.id);
    const inGrid = gridComponentIds.includes(comp.id);
    const isAvailable = !isPinned && !inGrid;

    const statusClass = isPinned ? 'pinned' : (inGrid ? 'in-grid' : 'available');
    const statusText = isPinned ? '📌 Pinned' : (inGrid ? '✓ In Grid' : 'Available');

    return `
      <div class="component-item ${statusClass}"
           data-component-id="${comp.id}"
           draggable="${isAvailable}">
        <span class="component-icon">${comp.icon}</span>
        <span class="component-name">${comp.displayName}</span>
        <span class="component-status">${statusText}</span>
      </div>
    `;
  }).join('');
}
```

#### Window Manager Updates (`WindowManager.ts`)

```typescript
export class WindowManager {
  private componentDialogWindow: BrowserWindow | null = null;

  // Add getter/setter
  getComponentDialogWindow(): BrowserWindow | null {
    return this.componentDialogWindow;
  }

  setComponentDialogWindow(window: BrowserWindow | null): void {
    this.componentDialogWindow = window;
  }
}
```

---

## File Changes Summary

### Files to Create (14 files)

#### Storage & Configuration
1. `src/ui/shortcuts/types.ts` - Type definitions
2. `src/ui/shortcuts/ShortcutConfigManager.ts` - Configuration manager

#### Shortcut Config Dialog (6 files)
3. `src/windows/factories/ShortcutConfigWindowFactory.ts`
4. `src/ui/shortcut-config-dialog/shortcut-config-dialog.html`
5. `src/ui/shortcut-config-dialog/shortcut-config-dialog.css`
6. `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts`
7. `src/ui/shortcut-config-dialog/shortcut-config-dialog-preload.ts`
8. `src/ipc/handlers/shortcut-config-handlers.ts`

#### Component Dialog (6 files)
9. `src/windows/factories/ComponentDialogWindowFactory.ts`
10. `src/ui/component-dialog/component-dialog.html`
11. `src/ui/component-dialog/component-dialog.css`
12. `src/ui/component-dialog/component-dialog.ts`
13. `src/ui/component-dialog/component-dialog-preload.ts`
14. `src/ipc/handlers/component-dialog-handlers.ts`

### Files to Modify (7 files)

1. `src/index.html` - Add topbar buttons (pin config + 3 shortcut slots)
2. `src/index.css` - Style shortcut buttons
3. `src/renderer.ts` - Initialize shortcuts, handle clicks, grid synchronization
4. `src/ui/gridstack/ComponentRegistry.ts` - Add availability checking
5. `src/ui/palette/palette.ts` - Update component availability logic
6. `src/windows/WindowManager.ts` - Track component dialog window
7. `src/ipc/handlers/index.ts` - Register shortcut and component dialog handlers

---

## Testing Criteria

### Functional Testing

✅ **Configuration Management**
- [ ] Pin config button opens configuration dialog
- [ ] Dialog displays current shortcut assignments
- [ ] Can assign components to slots 1, 2, 3
- [ ] Can clear slot assignments
- [ ] Dropdown shows only available components (not already pinned)
- [ ] Changes save to localStorage
- [ ] Configuration persists across app restarts

✅ **Topbar Shortcuts**
- [ ] Shortcut buttons appear/hide based on configuration
- [ ] Shortcut buttons display correct component name/icon
- [ ] Maximum 3 shortcut buttons visible at once
- [ ] Shortcut buttons positioned correctly in topbar

✅ **Component Dialogs**
- [ ] Clicking shortcut button opens modal dialog
- [ ] Dialog displays correct component
- [ ] Component receives real-time polling updates
- [ ] Component functionality identical to grid version
- [ ] Dialog is modal (blocks main window interaction)
- [ ] Closing dialog properly cleans up component instance
- [ ] Multiple shortcut buttons work independently

✅ **Grid Synchronization**
- [ ] Pinned components excluded from grid on startup
- [ ] Pinning component removes it from grid immediately
- [ ] Unpinning component adds it back to grid with auto-position
- [ ] Grid layout saves correctly with pinned components excluded
- [ ] Component palette shows correct availability status

✅ **Edge Cases**
- [ ] Cannot pin more than 3 components
- [ ] Cannot assign same component to multiple slots
- [ ] Handles component destruction gracefully
- [ ] Handles grid layout changes while shortcuts configured
- [ ] Handles app restart with shortcuts configured

### Performance Testing

- [ ] Shortcut buttons render without lag
- [ ] Component dialogs open within 500ms
- [ ] Polling updates have no noticeable delay
- [ ] No memory leaks when opening/closing dialogs repeatedly
- [ ] Configuration saves don't block UI

### Integration Testing

- [ ] Works with existing edit mode (CTRL+E)
- [ ] Works with component palette
- [ ] Works with multi-printer tabs
- [ ] Works with existing dialogs (settings, etc.)
- [ ] localStorage quota handling works

---

## Future Enhancements

### Potential Improvements (Not in Initial Scope)

1. **Custom Button Labels**
   - Allow users to rename shortcut buttons
   - Store custom labels in configuration

2. **Keyboard Shortcuts**
   - Add hotkeys for shortcut buttons (e.g., CTRL+1, CTRL+2, CTRL+3)
   - Configurable key bindings

3. **Drag-and-Drop Configuration**
   - Drag components from palette directly to shortcut slots
   - Reorder shortcut slots by dragging

4. **Per-Context Shortcuts**
   - Different shortcut configurations for different printers
   - Context-aware button visibility

5. **More Slots**
   - Allow configuration of 4-6 shortcut buttons
   - User-configurable slot count

6. **Shortcut Presets**
   - Save/load shortcut configurations as presets
   - Share presets with other users

7. **Button Themes**
   - Custom colors/icons for shortcut buttons
   - Visual customization options

8. **Dialog Positioning**
   - Remember last dialog position/size
   - Multi-monitor support

---

## Implementation Notes

### Design Principles Followed

1. **Zero Code Duplication**
   - Components work identically in grid and dialog
   - Single component class used in both contexts
   - ComponentManager handles updates universally

2. **Existing Pattern Reuse**
   - Dialog factory pattern from DialogWindowFactory
   - Storage pattern from LayoutPersistence
   - IPC pattern from existing dialogs
   - Component instantiation from grid system

3. **Clean Separation of Concerns**
   - ShortcutConfigManager: Configuration storage
   - ComponentDialogWindowFactory: Window creation
   - Dialog renderer: Component instantiation
   - Main renderer: Topbar integration

4. **Type Safety**
   - Full TypeScript coverage
   - No `any` types
   - Proper validation and error handling

5. **User Experience**
   - Modal dialogs for focused interaction
   - Clear visual feedback
   - Discoverable configuration
   - Persistent preferences

### Critical Implementation Details

1. **Component Lifecycle**
   - Dialog creates its own ComponentManager instance
   - Component registered, initialized, updated, destroyed
   - Proper cleanup on dialog close

2. **Polling Updates**
   - Dialog listens to same 'polling-update' IPC channel
   - ComponentManager distributes to dialog components
   - No special handling needed - just works!

3. **Grid Synchronization**
   - Shortcut config is source of truth
   - Grid filters out pinned components on load
   - Layout saves exclude pinned components

4. **Storage**
   - localStorage key: 'shortcut-buttons-config'
   - Same patterns as layout persistence
   - Version field for future migrations

---

## Conclusion

This feature seamlessly integrates with the existing architecture by leveraging:
- Self-contained component design
- ComponentManager update distribution
- Existing dialog patterns
- localStorage persistence

The implementation requires no changes to component classes themselves - they work identically in dialogs as they do in the grid. This demonstrates the power of the existing BaseComponent architecture and validates the "components don't care about their container" design principle.

**Implementation Status:** Ready to begin
**Estimated Development Time:** 8-12 hours (including testing)
**Risk Level:** Low (builds on proven patterns)
**Code Duplication:** None (reuses existing components)

---

*Generated: 2025-10-18*
*FlashForgeUI-Electron - Custom Shortcut Buttons Feature*
