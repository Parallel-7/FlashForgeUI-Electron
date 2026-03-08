# GridStack.js Integration Plan for FlashForgeUI-Electron

**Created:** 2025-10-05
**Status:** Design Complete - Ready for Implementation
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Integration Architecture](#integration-architecture)
4. [Implementation Phases](#implementation-phases)
5. [Component Palette Window](#component-palette-window)
6. [Edit Mode System](#edit-mode-system)
7. [Layout Persistence](#layout-persistence)
8. [Critical Success Factors](#critical-success-factors)
9. [Implementation Steps](#implementation-steps)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This document outlines the complete integration plan for GridStack.js into FlashForgeUI-Electron, enabling users to create fully customizable, draggable, and resizable dashboard layouts.

### Goals

✅ **Enable drag-and-drop layout customization** using GridStack.js
✅ **CTRL+E toggle** for edit mode activation/deactivation
✅ **Component Palette Window** for adding/removing components
✅ **Layout persistence** across application restarts
✅ **Seamless integration** with existing component system
✅ **Zero interference** with GridStack's native functionality

### Key Design Principle

**DO NOT HACK THE FRAMEWORK** - Let GridStack handle all grid logic, positioning, and interactions. Our code only provides the wrapper, persistence, and UI controls.

---

## Current Architecture Analysis

### Existing Component System

**Components Located:** `src/ui/components/`

```
BaseComponent (abstract)
├── CameraPreviewComponent
├── ControlsGridComponent
├── ModelPreviewComponent
├── JobStatsComponent
├── PrinterStatusComponent
├── TemperatureControlsComponent
├── FiltrationControlsComponent
├── AdditionalInfoComponent
├── LogPanelComponent
└── PrinterTabsComponent
```

**Component Manager:** `src/ui/components/ComponentManager.ts`
- Central registry for all components
- Handles initialization, updates, and destruction
- Provides `updateAll(data)` for polling updates

**Current Layout:** Fixed CSS Grid layout in `src/index.html`
```html
<div class="main-layout">
  <div class="left-side">
    <div id="camera-preview-container"></div>
  </div>
  <div class="right-side">
    <div id="controls-grid-container"></div>
    <div id="model-preview-container"></div>
    <div id="job-stats-container"></div>
  </div>
</div>
```

### Problems with Current Approach

❌ Fixed layout - users cannot customize
❌ No drag-and-drop functionality
❌ No ability to add/remove components
❌ No layout persistence

---

## Integration Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FlashForgeUI Main Window                │
├─────────────────────────────────────────────────────────────┤
│  Header Bar (unchanged)                                     │
├─────────────────────────────────────────────────────────────┤
│  Printer Tabs (unchanged)                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         GridStack Container (NEW)                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │    │
│  │  │ Camera   │  │ Controls │  │  Model   │         │    │
│  │  │ Preview  │  │  Grid    │  │ Preview  │         │    │
│  │  └──────────┘  └──────────┘  └──────────┘         │    │
│  │  ┌──────────┐  ┌──────────┐                       │    │
│  │  │   Job    │  │  Printer │                       │    │
│  │  │  Stats   │  │  Status  │                       │    │
│  │  └──────────┘  └──────────┘                       │    │
│  │     [All components are GridStack items]          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Log Panel (remains fixed at bottom)                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│  Component Palette Window    │  ← Separate BrowserWindow
│  (Hidden by default)         │
├──────────────────────────────┤
│  Available Components:       │
│  ┌────────────────────┐      │
│  │  📷 Camera Preview │      │  Drag these onto
│  ├────────────────────┤      │  the main grid
│  │  🎮 Controls Grid  │      │
│  ├────────────────────┤      │
│  │  📊 Job Stats      │      │
│  └────────────────────┘      │
│                              │
│  Drop zone to remove from    │
│  main grid (trash area)      │
└──────────────────────────────┘
```

### New Components to Create

1. **GridStackManager** (`src/ui/gridstack/GridStackManager.ts`)
   - Wraps GridStack.js functionality
   - Handles grid initialization and configuration
   - Manages widget lifecycle
   - Provides clean API for our app

2. **LayoutPersistence** (`src/ui/gridstack/LayoutPersistence.ts`)
   - Saves/loads layouts to localStorage or config file
   - Handles per-printer layouts (if needed)
   - Provides default layouts

3. **EditModeController** (`src/ui/gridstack/EditModeController.ts`)
   - Manages edit mode state
   - Handles CTRL+E keyboard shortcut
   - Shows/hides edit UI elements
   - Toggles GridStack enable/disable

4. **ComponentPaletteWindow** (`src/windows/ComponentPaletteWindow.ts`)
   - Electron BrowserWindow for component palette
   - Handles drag-from-palette events
   - Communicates with main window via IPC

---

## Implementation Phases

### Phase 1: GridStack Foundation (Week 1)

**Goal:** Get GridStack working with existing components

1. Install GridStack.js
2. Create GridStackManager wrapper
3. Convert existing layout to GridStack-based
4. Ensure all components still work

**Deliverables:**
- [ ] GridStack installed and imported
- [ ] GridStackManager created
- [ ] All existing components rendering in grid
- [ ] No regression in functionality

### Phase 2: Edit Mode (Week 2)

**Goal:** Enable/disable editing with CTRL+E

1. Create EditModeController
2. Implement keyboard handler
3. Add visual indicators for edit mode
4. Test drag/resize functionality

**Deliverables:**
- [ ] CTRL+E toggles edit mode
- [ ] Visual feedback when in edit mode
- [ ] Grid locked when not in edit mode
- [ ] Smooth transitions

### Phase 3: Layout Persistence (Week 2)

**Goal:** Save and restore layouts

1. Create LayoutPersistence service
2. Implement save on layout change
3. Implement load on startup
4. Add reset to default option

**Deliverables:**
- [ ] Layouts persist across restarts
- [ ] Per-context layouts (optional)
- [ ] Default layout available
- [ ] Reset functionality

### Phase 4: Component Palette (Week 3)

**Goal:** Add/remove components dynamically

1. Create ComponentPaletteWindow
2. Implement drag-from-palette
3. Implement drag-to-remove
4. Add component registry

**Deliverables:**
- [ ] Palette window opens/closes
- [ ] Drag components from palette to grid
- [ ] Remove components by dragging off grid
- [ ] Component limit enforcement (1 per type)

### Phase 5: Polish & Testing (Week 4)

**Goal:** Refinement and edge case handling

1. Responsive behavior testing
2. Edge case handling
3. Performance optimization
4. Documentation

**Deliverables:**
- [ ] Works on all window sizes
- [ ] No memory leaks
- [ ] Smooth performance
- [ ] User documentation

---

## Component Palette Window

### Window Configuration

```typescript
// src/windows/ComponentPaletteWindow.ts
const paletteWindowConfig = {
  width: 280,
  height: 600,
  resizable: false,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  }
};
```

### Palette UI Design

```html
<!-- Component Palette Window HTML -->
<div class="palette-window">
  <div class="palette-header">
    <h3>Components</h3>
    <button class="close-btn">×</button>
  </div>

  <div class="palette-body">
    <div class="available-components">
      <h4>Available</h4>
      <div class="component-list">
        <!-- Each component that's NOT already on the grid -->
        <div class="palette-item" data-component-id="camera-preview">
          <div class="palette-item-icon">📷</div>
          <div class="palette-item-label">Camera Preview</div>
        </div>
        <!-- ... more components ... -->
      </div>
    </div>

    <div class="trash-zone">
      <div class="trash-icon">🗑️</div>
      <div class="trash-label">Drop here to remove</div>
    </div>
  </div>
</div>
```

### Drag & Drop Flow

```
1. User enters edit mode (CTRL+E)
   ↓
2. User opens palette (button or auto-open)
   ↓
3. User drags component from palette
   ↓
4. GridStack.setupDragIn() handles the drag
   ↓
5. Component is added to grid
   ↓
6. Palette item is hidden (already on grid)
   ↓
7. Layout is auto-saved

To Remove:
1. User drags component from grid
   ↓
2. Drag it over palette window trash zone
   ↓
3. Component is removed from grid
   ↓
4. Palette item reappears in available list
   ↓
5. Layout is auto-saved
```

---

## Edit Mode System

### State Management

```typescript
// src/ui/gridstack/EditModeController.ts

interface EditModeState {
  isEditMode: boolean;
  isPaletteOpen: boolean;
  hasUnsavedChanges: boolean;
}

class EditModeController {
  private state: EditModeState = {
    isEditMode: false,
    isPaletteOpen: false,
    hasUnsavedChanges: false
  };

  // Toggle edit mode
  toggleEditMode(): void {
    this.state.isEditMode = !this.state.isEditMode;

    if (this.state.isEditMode) {
      this.enterEditMode();
    } else {
      this.exitEditMode();
    }
  }

  private enterEditMode(): void {
    // Enable GridStack editing
    gridStackManager.enable();

    // Show edit mode UI
    document.body.classList.add('edit-mode');

    // Show palette window
    window.api.send('open-palette-window');

    // Show visual indicators
    this.showEditIndicators();
  }

  private exitEditMode(): void {
    // Disable GridStack editing
    gridStackManager.disable();

    // Hide edit mode UI
    document.body.classList.remove('edit-mode');

    // Close palette window
    window.api.send('close-palette-window');

    // Save layout if changes
    if (this.state.hasUnsavedChanges) {
      layoutPersistence.save();
      this.state.hasUnsavedChanges = false;
    }
  }
}
```

### Keyboard Handler

```typescript
// Register CTRL+E globally
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    editModeController.toggleEditMode();
  }
});
```

### Visual Indicators

```css
/* Edit mode styling */
.edit-mode .grid-stack-item {
  outline: 2px dashed rgba(66, 133, 244, 0.5);
  cursor: move;
}

.edit-mode .grid-stack-item:hover {
  outline-color: rgba(66, 133, 244, 1);
  z-index: 1000;
}

.edit-mode .grid-stack-item .ui-resizable-handle {
  display: block !important;
}

/* Edit mode indicator */
.edit-mode-indicator {
  position: fixed;
  top: 40px;
  right: 10px;
  background: var(--accent-color);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  z-index: 10000;
}
```

---

## Layout Persistence

### Storage Strategy

**Option 1: localStorage (Recommended for MVP)**
- Fast and simple
- No file I/O needed
- Per-window storage

**Option 2: Config File**
- Shared across instances
- Can be version controlled
- Requires main process handling

### Data Structure

```typescript
interface LayoutConfig {
  version: string;
  contextId?: string; // Optional: per-printer layouts
  gridOptions: {
    column: number;
    cellHeight: number;
    margin: number;
  };
  widgets: Array<{
    componentId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  }>;
  timestamp: string;
}
```

### LayoutPersistence Service

```typescript
// src/ui/gridstack/LayoutPersistence.ts

class LayoutPersistence {
  private readonly STORAGE_KEY = 'gridstack-layout';
  private readonly DEFAULT_LAYOUT_KEY = 'gridstack-default-layout';

  // Save current layout
  save(contextId?: string): void {
    const layout = gridStackManager.serialize();
    const config: LayoutConfig = {
      version: '1.0',
      contextId,
      gridOptions: {
        column: 12,
        cellHeight: 80,
        margin: 8
      },
      widgets: layout,
      timestamp: new Date().toISOString()
    };

    const key = contextId
      ? `${this.STORAGE_KEY}-${contextId}`
      : this.STORAGE_KEY;

    localStorage.setItem(key, JSON.stringify(config));
  }

  // Load layout
  load(contextId?: string): LayoutConfig | null {
    const key = contextId
      ? `${this.STORAGE_KEY}-${contextId}`
      : this.STORAGE_KEY;

    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        return JSON.parse(stored) as LayoutConfig;
      } catch (e) {
        console.error('Failed to parse layout config:', e);
        return this.getDefaultLayout();
      }
    }

    return this.getDefaultLayout();
  }

  // Get default layout
  getDefaultLayout(): LayoutConfig {
    return {
      version: '1.0',
      gridOptions: {
        column: 12,
        cellHeight: 80,
        margin: 8
      },
      widgets: [
        // Camera preview - left side, full height
        { componentId: 'camera-preview', x: 0, y: 0, w: 6, h: 6 },

        // Controls - top right
        { componentId: 'controls-grid', x: 6, y: 0, w: 6, h: 3 },

        // Model preview - mid right
        { componentId: 'model-preview', x: 6, y: 3, w: 6, h: 3 },

        // Job stats - lower right
        { componentId: 'job-stats', x: 6, y: 6, w: 6, h: 2 },

        // Status bar components - bottom row
        { componentId: 'printer-status', x: 0, y: 8, w: 3, h: 1 },
        { componentId: 'temperature-controls', x: 3, y: 8, w: 3, h: 1 },
        { componentId: 'filtration-controls', x: 6, y: 8, w: 3, h: 1 },
        { componentId: 'additional-info', x: 9, y: 8, w: 3, h: 1 }
      ],
      timestamp: new Date().toISOString()
    };
  }

  // Reset to default
  reset(contextId?: string): void {
    const key = contextId
      ? `${this.STORAGE_KEY}-${contextId}`
      : this.STORAGE_KEY;

    localStorage.removeItem(key);

    // Reload with default
    const defaultLayout = this.getDefaultLayout();
    gridStackManager.load(defaultLayout.widgets);
  }
}
```

---

## Critical Success Factors

### ⚠️ AVOID THESE MISTAKES (Learned from Previous Failures)

1. **DO NOT override GridStack's internal methods**
   - Let GridStack handle all positioning
   - Let GridStack handle all collision detection
   - Let GridStack handle all drag/drop events

2. **DO NOT manipulate grid item positions manually**
   - Use GridStack API only: `addWidget()`, `removeWidget()`, `update()`
   - Never set `style.left`, `style.top`, `style.width`, `style.height` manually
   - Never modify `gs-x`, `gs-y`, `gs-w`, `gs-h` attributes directly

3. **DO NOT interfere with GridStack's CSS**
   - Import GridStack CSS first, before custom CSS
   - Only add custom CSS for styling, not positioning
   - Use CSS classes for visual effects only

4. **DO NOT create conflicting event handlers**
   - Let GridStack handle all mouse/touch events on grid items
   - Only add event listeners to child elements, not grid items
   - Use GridStack's event system (`on('change')`, etc.)

### ✅ SUCCESS PATTERNS

1. **Clean Separation of Concerns**
   ```
   GridStack.js → Handles all grid logic
   GridStackManager → Thin wrapper for our app
   Components → Render content only
   ```

2. **Single Source of Truth**
   - GridStack owns the layout state
   - We serialize from GridStack to save
   - We deserialize into GridStack to load

3. **Proper Initialization Order**
   ```
   1. Load layout config
   2. Initialize GridStack with config
   3. Create component instances
   4. Add components to grid using GridStack API
   5. Let GridStack handle everything else
   ```

---

## Implementation Steps

### Step 1: Install GridStack

```bash
npm install gridstack
```

### Step 2: Create GridStackManager

**File:** `src/ui/gridstack/GridStackManager.ts`

```typescript
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

export interface GridStackWidgetConfig {
  componentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export class GridStackManager {
  private grid: GridStack | null = null;
  private container: HTMLElement;

  constructor(containerSelector: string = '.grid-stack') {
    const el = document.querySelector(containerSelector);
    if (!el) {
      throw new Error(`GridStack container not found: ${containerSelector}`);
    }
    this.container = el as HTMLElement;
  }

  /**
   * Initialize GridStack with configuration
   */
  initialize(options?: {
    column?: number;
    cellHeight?: number | string;
    margin?: number;
    float?: boolean;
    animate?: boolean;
  }): void {
    if (this.grid) {
      console.warn('GridStack already initialized');
      return;
    }

    // Initialize with sane defaults
    this.grid = GridStack.init({
      column: options?.column ?? 12,
      cellHeight: options?.cellHeight ?? 80,
      margin: options?.margin ?? 8,
      float: options?.float ?? false,
      animate: options?.animate ?? true,
      disableOneColumnMode: true, // Keep grid responsive
      acceptWidgets: true, // Allow drag from external sources
      removable: '.trash-zone', // Can drag to trash

      // IMPORTANT: These are GridStack's responsibility
      // We don't override these!
      draggable: {
        handle: '.grid-stack-item-content',
      },
      resizable: {
        handles: 'se, sw, ne, nw'
      }
    }, this.container);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Add a widget (component) to the grid
   */
  addWidget(config: GridStackWidgetConfig, element: HTMLElement): void {
    if (!this.grid) {
      throw new Error('GridStack not initialized');
    }

    // Let GridStack handle the positioning
    this.grid.addWidget(element, {
      x: config.x,
      y: config.y,
      w: config.w,
      h: config.h,
      minW: config.minW,
      minH: config.minH,
      maxW: config.maxW,
      maxH: config.maxH,
      id: config.componentId // Store component ID
    });
  }

  /**
   * Remove a widget from the grid
   */
  removeWidget(element: HTMLElement): void {
    if (!this.grid) return;
    this.grid.removeWidget(element, false); // false = don't detach, we'll handle cleanup
  }

  /**
   * Enable editing (drag/resize)
   */
  enable(): void {
    if (!this.grid) return;
    this.grid.enable();
  }

  /**
   * Disable editing (lock layout)
   */
  disable(): void {
    if (!this.grid) return;
    this.grid.disable();
  }

  /**
   * Serialize current layout
   */
  serialize(): GridStackWidgetConfig[] {
    if (!this.grid) return [];

    return this.grid.save() as GridStackWidgetConfig[];
  }

  /**
   * Load a layout
   */
  load(widgets: GridStackWidgetConfig[]): void {
    if (!this.grid) return;

    // Clear existing widgets
    this.grid.removeAll();

    // Load new layout
    // Note: Actual component creation happens separately
    // This just sets up the grid structure
    this.grid.load(widgets);
  }

  /**
   * Set up GridStack event listeners
   */
  private setupEventListeners(): void {
    if (!this.grid) return;

    // Listen for layout changes
    this.grid.on('change', (event, items) => {
      console.log('Layout changed:', items);
      // Trigger layout save
      window.dispatchEvent(new CustomEvent('gridstack:change', { detail: items }));
    });

    // Listen for widget additions
    this.grid.on('added', (event, items) => {
      console.log('Widget added:', items);
      window.dispatchEvent(new CustomEvent('gridstack:added', { detail: items }));
    });

    // Listen for widget removals
    this.grid.on('removed', (event, items) => {
      console.log('Widget removed:', items);
      window.dispatchEvent(new CustomEvent('gridstack:removed', { detail: items }));
    });
  }

  /**
   * Destroy GridStack instance
   */
  destroy(): void {
    if (!this.grid) return;
    this.grid.destroy();
    this.grid = null;
  }
}

// Export singleton instance
export const gridStackManager = new GridStackManager();
```

### Step 3: Update HTML Structure

**File:** `src/index.html`

Replace the current fixed layout with:

```html
<!-- Main GridStack Container -->
<div class="grid-stack">
  <!-- GridStack will populate this -->
  <!-- We'll add widgets programmatically -->
</div>

<!-- Edit mode indicator (hidden by default) -->
<div class="edit-mode-indicator" style="display: none;">
  ✏️ Edit Mode - CTRL+E to exit
</div>

<!-- Log Panel (remains fixed) -->
<div id="log-panel-container"></div>
```

### Step 4: Update Renderer Process

**File:** `src/renderer.ts` - Add GridStack initialization

```typescript
import { gridStackManager } from './ui/gridstack/GridStackManager';
import { layoutPersistence } from './ui/gridstack/LayoutPersistence';
import { editModeController } from './ui/gridstack/EditModeController';

// ... existing code ...

async function initializeGridStack(): Promise<void> {
  console.log('Initializing GridStack...');

  // 1. Initialize GridStack
  gridStackManager.initialize({
    column: 12,
    cellHeight: 80,
    margin: 8,
    animate: true
  });

  // 2. Load saved layout or use default
  const layout = layoutPersistence.load();

  // 3. Create component elements and add to grid
  for (const widgetConfig of layout.widgets) {
    // Get or create the component container
    const container = createWidgetContainer(widgetConfig.componentId);

    // Add to GridStack
    gridStackManager.addWidget(widgetConfig, container);

    // Initialize the component inside the container
    await initializeComponent(widgetConfig.componentId, container);
  }

  // 4. Disable editing by default
  gridStackManager.disable();

  console.log('GridStack initialized successfully');
}

function createWidgetContainer(componentId: string): HTMLElement {
  // Create grid-stack-item wrapper
  const item = document.createElement('div');
  item.className = 'grid-stack-item';
  item.setAttribute('data-component-id', componentId);

  // Create content container
  const content = document.createElement('div');
  content.className = 'grid-stack-item-content';
  content.id = `${componentId}-container`;

  item.appendChild(content);
  return item;
}

async function initializeComponent(
  componentId: string,
  container: HTMLElement
): Promise<void> {
  // Find the content container
  const contentContainer = container.querySelector('.grid-stack-item-content') as HTMLElement;
  if (!contentContainer) return;

  // Create the appropriate component
  let component;
  switch (componentId) {
    case 'camera-preview':
      component = new CameraPreviewComponent(contentContainer);
      break;
    case 'controls-grid':
      component = new ControlsGridComponent(contentContainer);
      break;
    // ... other components ...
    default:
      console.warn(`Unknown component: ${componentId}`);
      return;
  }

  // Register and initialize
  componentManager.registerComponent(component);
  await component.initialize();
}

// Update the DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing initialization ...

  // Initialize GridStack AFTER component system
  try {
    await initializeGridStack();
    console.log('GridStack ready');
  } catch (error) {
    console.error('GridStack initialization failed:', error);
  }

  // Initialize edit mode controller
  editModeController.initialize();

  // ... rest of initialization ...
});
```

### Step 5: Create EditModeController

**File:** `src/ui/gridstack/EditModeController.ts`

```typescript
import { gridStackManager } from './GridStackManager';
import { layoutPersistence } from './LayoutPersistence';

class EditModeController {
  private isEditMode = false;
  private indicator: HTMLElement | null = null;

  initialize(): void {
    // Get or create edit mode indicator
    this.indicator = document.querySelector('.edit-mode-indicator');
    if (!this.indicator) {
      this.indicator = document.createElement('div');
      this.indicator.className = 'edit-mode-indicator';
      this.indicator.style.display = 'none';
      document.body.appendChild(this.indicator);
    }

    // Set up keyboard handler
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Listen for layout changes
    window.addEventListener('gridstack:change', this.onLayoutChange.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      this.toggle();
    }
  }

  toggle(): void {
    this.isEditMode = !this.isEditMode;

    if (this.isEditMode) {
      this.enterEditMode();
    } else {
      this.exitEditMode();
    }
  }

  private enterEditMode(): void {
    console.log('Entering edit mode');

    // Enable GridStack editing
    gridStackManager.enable();

    // Add visual class to body
    document.body.classList.add('edit-mode');

    // Show indicator
    if (this.indicator) {
      this.indicator.style.display = 'block';
      this.indicator.textContent = '✏️ Edit Mode - CTRL+E to exit';
    }

    // Open palette window
    window.api?.send('open-component-palette');
  }

  private exitEditMode(): void {
    console.log('Exiting edit mode');

    // Disable GridStack editing
    gridStackManager.disable();

    // Remove visual class
    document.body.classList.remove('edit-mode');

    // Hide indicator
    if (this.indicator) {
      this.indicator.style.display = 'none';
    }

    // Close palette window
    window.api?.send('close-component-palette');

    // Save layout
    layoutPersistence.save();
  }

  private onLayoutChange(): void {
    if (this.isEditMode) {
      // Auto-save on changes (debounced)
      // We'll implement debouncing in LayoutPersistence
    }
  }
}

export const editModeController = new EditModeController();
```

### Step 6: Add GridStack CSS

**File:** `src/index.css` - Add GridStack overrides

```css
/* Import GridStack CSS first */
@import 'gridstack/dist/gridstack.min.css';

/* GridStack container */
.grid-stack {
  flex: 1;
  overflow: auto;
  background-color: var(--dark-bg);
}

/* Grid items styling */
.grid-stack-item {
  background: transparent;
}

.grid-stack-item-content {
  background-color: var(--darker-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  inset: 4px !important; /* Margin between items */
}

/* Edit mode styling */
.edit-mode .grid-stack-item {
  cursor: move;
}

.edit-mode .grid-stack-item-content {
  outline: 2px dashed rgba(66, 133, 244, 0.3);
}

.edit-mode .grid-stack-item:hover .grid-stack-item-content {
  outline-color: rgba(66, 133, 244, 0.8);
  box-shadow: 0 0 10px rgba(66, 133, 244, 0.5);
}

/* Resize handles - only show in edit mode */
.grid-stack-item .ui-resizable-handle {
  display: none;
}

.edit-mode .grid-stack-item .ui-resizable-handle {
  display: block;
}

/* Edit mode indicator */
.edit-mode-indicator {
  position: fixed;
  top: 45px;
  right: 20px;
  background: var(--accent-color);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: bold;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## Testing Strategy

### Unit Tests

1. **GridStackManager**
   - [ ] Initialize correctly
   - [ ] Add/remove widgets
   - [ ] Serialize/deserialize
   - [ ] Enable/disable

2. **LayoutPersistence**
   - [ ] Save to localStorage
   - [ ] Load from localStorage
   - [ ] Reset to default
   - [ ] Handle corrupted data

3. **EditModeController**
   - [ ] Toggle on CTRL+E
   - [ ] Enter/exit properly
   - [ ] Save on exit

### Integration Tests

1. **Component Integration**
   - [ ] All components render in grid
   - [ ] Polling updates still work
   - [ ] Multi-printer contexts work
   - [ ] No memory leaks

2. **Layout Persistence**
   - [ ] Layout survives restart
   - [ ] Per-printer layouts work
   - [ ] Default layout loads correctly

3. **Edit Mode**
   - [ ] Drag works smoothly
   - [ ] Resize works correctly
   - [ ] Palette drag-in works
   - [ ] Remove works

### Manual Testing Checklist

- [ ] Install on Windows
- [ ] Install on macOS
- [ ] Install on Linux
- [ ] Test with single printer
- [ ] Test with multiple printers
- [ ] Test window resize
- [ ] Test layout persistence
- [ ] Test edit mode toggle
- [ ] Test drag from palette
- [ ] Test remove to trash
- [ ] Test reset to default
- [ ] Check performance (no lag)
- [ ] Check memory usage

---

## Next Steps

1. ✅ **Review this plan** - Confirm approach is sound
2. 🔄 **Implement Phase 1** - Get GridStack working
3. 🔄 **Implement Phase 2** - Add edit mode
4. 🔄 **Implement Phase 3** - Add persistence
5. 🔄 **Implement Phase 4** - Add palette window
6. 🔄 **Implement Phase 5** - Polish and test

---

## Questions to Resolve

1. **Per-printer layouts?** - Should each printer have its own layout?
   - Recommendation: Start with global layout, add per-printer later

2. **Component limits?** - Can users add multiple of same component?
   - Recommendation: One instance per component type

3. **Minimum grid size?** - What's the minimum window size to support?
   - Recommendation: 1024x768

4. **Mobile support?** - Is this needed?
   - Recommendation: Desktop only for now

---

## Success Criteria

✅ **User can customize layout freely**
✅ **CTRL+E toggles edit mode smoothly**
✅ **Layouts persist across restarts**
✅ **Component palette works intuitively**
✅ **No regression in existing functionality**
✅ **Performance is smooth (60 FPS)**
✅ **Works on all platforms (Win/Mac/Linux)**

---

## References

- [GridStack.js Documentation](https://github.com/gridstack/gridstack.js/tree/master/doc)
- [GridStack.js API](https://gridstack.github.io/gridstack.js/doc/html/)
- [GridStack.js Examples](http://gridstackjs.com/demo/)

---

**END OF DOCUMENT**
