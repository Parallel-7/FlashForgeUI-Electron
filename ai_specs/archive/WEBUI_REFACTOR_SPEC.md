# WebUI Refactor Specification: GridStack Integration + Modern Theming

**Status:** Planning Phase
**Created:** 2025-10-26
**Last Updated:** 2025-10-26

## Overview
Modernize the WebUI to match the Electron app's theming and add GridStack-based customizable layouts with localStorage persistence.

## User Requirements
- ✅ Use GridStack for customizable dashboard layout
- ✅ Store layouts in localStorage (browser-side, NOT Electron file storage)
- ✅ **Per-printer layouts using Serial Number as unique identifier**
- ✅ Match Electron app theming exactly (modern dark theme)
- ✅ WebUI-specific simplified classes (no Electron coupling)
- ✅ All current panels preserved PLUS separate Filtration/TVOC component
- ✅ Settings-based panel visibility toggles (not drag-in palette)
- ✅ **NO functional code changes** - preserve all existing printer control logic

## Architecture Decision: localStorage vs Electron Storage

### Why localStorage is Superior for WebUI:

| Aspect | localStorage | Electron File Storage |
|--------|--------------|----------------------|
| **Complexity** | Simple browser API | Requires IPC, file I/O, path handling |
| **Multi-device** | Per-browser customization | Would need context-per-user mapping |
| **Network access** | Works perfectly | Complicated over network |
| **Offline** | Works offline | Requires connected Electron instance |
| **User privacy** | Stays in user's browser | Stored on server machine |
| **Performance** | Instant synchronous reads | Async IPC roundtrip |

### Real-World Scenario:
- User A accesses WebUI from tablet → Gets their custom layout
- User B accesses from phone → Gets their custom layout
- User C accesses from laptop → Gets their custom layout

With localStorage, **each device remembers its own layout**. With Electron storage, you'd need user authentication and per-user layout files (massive complexity).

---

## Phase 1: WebUI-Specific GridStack Implementation

**Create new simplified classes tailored to WebUI:**

### 1.1 `src/webui/static/grid/WebUIGridManager.ts`
- Lightweight GridStack wrapper for browser-only use
- No Electron/IPC dependencies
- Simplified API focusing on WebUI needs
- Based on existing GridStackManager patterns but standalone
- Methods:
  - `initialize(options)` - Setup grid
  - `addComponent(componentId, config)` - Add panel to grid
  - `removeComponent(componentId)` - Remove panel
  - `enableEdit()` / `disableEdit()` - Toggle drag-and-drop
  - `serialize()` - Get current layout
  - `load(layout)` - Restore saved layout

### 1.2 `src/webui/static/grid/WebUILayoutPersistence.ts`
- localStorage-based persistence
- **Storage key pattern:** `flashforge-webui-layout-{serialNumber}`
  - Example: `flashforge-webui-layout-ABC123456`
- **Per-printer layouts** - Each printer's serial number gets its own layout
- Methods:
  - `save(layout, serialNumber)` - Save to localStorage (debounced)
  - `load(serialNumber)` - Load from localStorage with validation
  - `reset(serialNumber)` - Clear saved layout for specific printer, restore defaults
  - `exists(serialNumber)` - Check if saved layout exists for printer
  - `delete(serialNumber)` - Delete layout for specific printer
  - `getAllSerialNumbers()` - List all printers with saved layouts (for cleanup)

### 1.3 `src/webui/static/grid/WebUIComponentRegistry.ts`
- Registry for WebUI-specific components
- Component definitions for all 8 panels:
  1. **Camera View** - Video stream display
  2. **Controls** - Printer control buttons
  3. **Model Preview** - Job thumbnail display
  4. **Printer State** - Status and lifetime stats
  5. **Temperature Control** - Bed/extruder temp ONLY (filtration moved out)
  6. **Filtration & TVOC** - NEW separate component (matches Electron app)
  7. **Job Progress** - Progress bar, current job
  8. **Job Details** - Layer info, time remaining, weight/length

- Component metadata:
  ```typescript
  {
    id: string;
    displayName: string;
    defaultSize: { w: number, h: number };
    minSize: { w: number, h: number };
    maxSize?: { w: number, h: number };
    defaultPosition?: { x: number, y: number };
  }
  ```

### 1.4 `src/webui/static/grid/types.ts`
- TypeScript interfaces for WebUI grid system
- Component configs, layout definitions, persistence options
- No coupling to Electron types

---

## Phase 2: Theming Modernization

**Match Electron app's modern dark theme exactly:**

### 2.1 CSS Custom Properties
Update `src/webui/static/webui.css` to use CSS variables:

```css
:root {
  /* Core Backgrounds - Professional Dark Theme */
  --dark-bg: #1e1e1e;           /* was #303030 */
  --darker-bg: #151515;
  --header-bg: #1a1a1a;

  /* Border and Dividers - Subtle and refined */
  --border-color: #2d2d2d;      /* was #555 */
  --border-color-light: #3a3a3a;
  --border-color-focus: #4a4a4a;

  /* Primary Actions - Vibrant blue with accessibility */
  --button-bg: #4285f4;         /* was #5c6bc0 */
  --button-hover: #5a95f5;
  --button-active: #357abd;

  /* Text Colors - High contrast for readability */
  --text-color: #e8e8e8;        /* was #e0e0e0 */
  --text-color-secondary: #b0b0b0;
  --text-color-muted: #808080;

  /* Accent and Status Colors */
  --accent-color: #4285f4;
  --error-color: #f44336;
  --warning-color: #ff9800;
  --success-color: #00e676;

  /* Card and Panel Styling */
  --card-bg: #252525;           /* was #404040 */
  --card-bg-hover: #2a2a2a;

  /* Shadows for depth */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.4s ease;
}
```

### 2.2 Component Style Updates
- Replace all hardcoded color values with CSS variables
- Update panel backgrounds: `#404040` → `var(--card-bg)`
- Update borders: `#555` → `var(--border-color)`
- Update buttons: `#5c6bc0` → `var(--button-bg)`
- Refine shadows using `var(--shadow-*)` variables
- Consistent spacing and border-radius

---

## Phase 3: HTML Restructuring

**Transform fixed layout to GridStack-based:**

### 3.1 Update `src/webui/static/index.html`

Replace current fixed grid:
```html
<!-- OLD: Fixed CSS Grid -->
<div class="right-side-grid">
  <div class="panel" id="control-grid">...</div>
  <div class="panel" id="model-preview-panel">...</div>
  <!-- ... -->
</div>
```

With GridStack container:
```html
<!-- NEW: GridStack Grid -->
<div class="grid-stack webui-grid">
  <!-- Components will be added dynamically via JavaScript -->
</div>
```

### 3.2 Component Templates
Create HTML templates for each component (stored in JS/TS):
```typescript
const componentTemplates = {
  camera: `
    <div class="grid-stack-item" data-component-id="camera">
      <div class="grid-stack-item-content panel">
        <div class="panel-header">Camera</div>
        <div class="panel-content">
          <!-- Camera content -->
        </div>
      </div>
    </div>
  `,
  // ... other components
};
```

### 3.3 GridStack Assets
Add to `<head>`:
```html
<link rel="stylesheet" href="gridstack.min.css">
<link rel="stylesheet" href="gridstack-extra.min.css">
```

Add before closing `</body>`:
```html
<script src="gridstack-all.js"></script>
```

---

## Phase 4: TypeScript Application Updates

**Integrate GridStack into WebUI app:**

### 4.1 Update `src/webui/static/app.ts`

#### Initialization Flow:
```typescript
import { WebUIGridManager } from './grid/WebUIGridManager';
import { WebUILayoutPersistence } from './grid/WebUILayoutPersistence';
import { componentRegistry } from './grid/WebUIComponentRegistry';

// Global state
let currentPrinterSerial: string | null = null;
const gridManager = new WebUIGridManager('.webui-grid');
const layoutPersistence = new WebUILayoutPersistence();

// On page load (after authentication and printer features loaded)
async function initializeGrid(printerDetails: PrinterDetails, printerFeatures: PrinterFeatures) {
  currentPrinterSerial = printerDetails.SerialNumber;

  // Load saved layout for THIS specific printer or use defaults
  const savedLayout = layoutPersistence.load(currentPrinterSerial);

  // Initialize GridStack
  gridManager.initialize({
    column: 12,
    cellHeight: 80,
    margin: 16,
    staticGrid: true  // Start locked
  });

  // Add all components, filtering out feature-dependent ones if not supported
  const visibleComponents = getVisibleComponents(printerFeatures, savedLayout);
  for (const componentId of visibleComponents) {
    const config = savedLayout?.components[componentId] || componentRegistry.getDefault(componentId);
    gridManager.addComponent(componentId, config);
  }

  // Auto-save on changes (debounced) - saves to THIS printer's layout
  gridManager.onChange((layout) => {
    if (currentPrinterSerial) {
      layoutPersistence.save(layout, currentPrinterSerial);
    }
  });
}

// Helper to filter components based on printer features
function getVisibleComponents(features: PrinterFeatures, savedLayout?: Layout): string[] {
  const allComponents = Object.keys(componentRegistry);

  return allComponents.filter(componentId => {
    const component = componentRegistry[componentId];

    // Check if component is hidden in user settings
    if (savedLayout?.hiddenComponents?.includes(componentId)) {
      return false;
    }

    // Filter out feature-dependent components if printer doesn't support them
    if (componentId === 'filtration-tvoc' && !features.hasFiltration) {
      return false;
    }

    return true;
  });
}
```

#### Multi-Printer Context Switching:
```typescript
// When user switches printer context (multi-printer support)
async function onPrinterContextSwitch(newPrinterDetails: PrinterDetails, newFeatures: PrinterFeatures) {
  // Save current printer's layout before switching
  if (currentPrinterSerial) {
    const currentLayout = gridManager.serialize();
    layoutPersistence.save(currentLayout, currentPrinterSerial);
  }

  // Update current printer
  currentPrinterSerial = newPrinterDetails.SerialNumber;

  // Clear grid
  gridManager.clear();

  // Load layout for new printer
  const newLayout = layoutPersistence.load(currentPrinterSerial);

  // Re-add components for new printer (filtering by features)
  const visibleComponents = getVisibleComponents(newFeatures, newLayout);
  for (const componentId of visibleComponents) {
    const config = newLayout?.components[componentId] || componentRegistry.getDefault(componentId);
    gridManager.addComponent(componentId, config);
  }

  console.log(`[WebUI] Switched to printer ${newPrinterDetails.Name} (SN: ${currentPrinterSerial})`);
}
```

#### Component State Management:
```typescript
// Preserve existing WebSocket update logic - NO CHANGES to functional code
function updateComponentData(componentId: string, data: any) {
  const component = document.querySelector(`[data-component-id="${componentId}"]`);
  // Update component content as before (existing logic preserved)
}
```

### 4.2 Settings Menu Implementation

#### Header Button:
```html
<!-- Add to header -->
<button id="settings-button" class="settings-button">
  <svg><!-- Gear icon --></svg>
</button>
```

#### Settings Modal:
```html
<div id="settings-modal" class="modal hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2>WebUI Settings</h2>
      <button id="close-settings" class="close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Panel Visibility -->
      <section>
        <h3>Panel Visibility</h3>
        <label><input type="checkbox" id="toggle-camera" checked> Camera View</label>
        <label><input type="checkbox" id="toggle-controls" checked> Controls</label>
        <label><input type="checkbox" id="toggle-model-preview" checked> Model Preview</label>
        <label><input type="checkbox" id="toggle-printer-state" checked> Printer State</label>
        <label><input type="checkbox" id="toggle-temp-control" checked> Temperature Control</label>
        <label><input type="checkbox" id="toggle-filtration-tvoc" checked> Filtration & TVOC</label>
        <label><input type="checkbox" id="toggle-job-progress" checked> Job Progress</label>
        <label><input type="checkbox" id="toggle-job-details" checked> Job Details</label>
      </section>

      <!-- Edit Mode -->
      <section>
        <h3>Layout Customization</h3>
        <label>
          <input type="checkbox" id="toggle-edit-mode"> Enable Edit Mode
          <span class="help-text">Allows dragging and resizing panels</span>
        </label>
      </section>

      <!-- Reset -->
      <section>
        <h3>Reset</h3>
        <button id="reset-layout-btn" class="secondary-btn">Reset Layout to Default</button>
      </section>
    </div>
    <div class="modal-footer">
      <button id="save-settings-btn" class="primary-btn">Save</button>
    </div>
  </div>
</div>
```

#### Settings Logic:
```typescript
interface WebUISettings {
  visibleComponents: string[];
  editMode: boolean;
}

function loadSettings(): WebUISettings {
  const stored = localStorage.getItem('flashforge-webui-settings');
  return stored ? JSON.parse(stored) : {
    visibleComponents: ['camera', 'controls', 'model-preview', 'printer-state', 'temp-control', 'job-progress', 'job-details'],
    editMode: false
  };
}

function saveSettings(settings: WebUISettings) {
  localStorage.setItem('flashforge-webui-settings', JSON.stringify(settings));
  applySettings(settings);
}

function applySettings(settings: WebUISettings) {
  // Show/hide components
  for (const componentId of componentRegistry.getAllIds()) {
    if (settings.visibleComponents.includes(componentId)) {
      gridManager.showComponent(componentId);
    } else {
      gridManager.hideComponent(componentId);
    }
  }

  // Toggle edit mode
  if (settings.editMode) {
    gridManager.enableEdit();
  } else {
    gridManager.disableEdit();
  }
}
```

### 4.3 Edit Mode Features

#### Toggle Button in Header:
```html
<button id="edit-mode-toggle" class="edit-mode-toggle">
  <span class="lock-icon">🔒</span>
  <span class="edit-text">Locked</span>
</button>
```

#### Visual Feedback:
```css
.grid-stack.edit-mode .grid-stack-item {
  border: 2px dashed var(--accent-color);
  cursor: move;
}

.grid-stack.edit-mode .panel-header::before {
  content: "⋮⋮";
  margin-right: 8px;
  opacity: 0.5;
}
```

---

## Phase 5: Build Integration

**Ensure GridStack assets are bundled for WebUI:**

### 5.1 GridStack Asset Vendoring

Copy GridStack files to WebUI static directory:
```
src/webui/static/
  ├── gridstack.min.css
  ├── gridstack-extra.min.css
  └── gridstack-all.js
```

These can be copied from `node_modules/gridstack/dist/` during build or vendored directly.

### 5.2 TypeScript Compilation

Update `src/webui/static/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": ".",
    "rootDir": "."
  },
  "include": [
    "app.ts",
    "grid/**/*.ts"
  ]
}
```

### 5.3 Build Script Updates

Ensure webpack/build process:
1. Compiles TypeScript in `src/webui/static/`
2. Copies GridStack assets to static folder
3. Bundles everything for serving

---

## Phase 6: Testing & Polish

**Ensure functionality preservation:**

### 6.1 Functional Testing (Manual)
- [ ] All 6 panels maintain existing functionality
- [ ] Drag-and-drop customization works
- [ ] localStorage persistence across sessions
- [ ] Settings toggles show/hide panels correctly
- [ ] Edit mode toggle works (lock/unlock)
- [ ] Layout reset restores defaults
- [ ] Multi-printer context switching still works
- [ ] Camera streaming (MJPEG and RTSP) works
- [ ] WebSocket updates continue to work
- [ ] All control buttons function correctly

### 6.2 Responsive Design
- [ ] Mobile layout (< 768px) stacks vertically
- [ ] Tablet layout (768px - 1024px) adjusts gracefully
- [ ] Desktop layout (> 1024px) uses full grid
- [ ] GridStack mobile handling configured

### 6.3 Cross-Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] localStorage works in all browsers
- [ ] GridStack drag behavior consistent

### 6.4 Performance
- [ ] Initial load time acceptable
- [ ] Layout save/load is fast
- [ ] No jank during drag operations
- [ ] Bundle size reasonable for remote access

---

## Component Default Layout

```typescript
const DEFAULT_LAYOUT = {
  components: {
    camera: { x: 0, y: 0, w: 6, h: 4 },              // Left side, tall
    controls: { x: 6, y: 0, w: 3, h: 2 },            // Top right
    'model-preview': { x: 9, y: 0, w: 3, h: 2 },
    'printer-state': { x: 6, y: 2, w: 3, h: 2 },
    'job-progress': { x: 9, y: 2, w: 3, h: 2 },
    'temp-control': { x: 6, y: 4, w: 3, h: 1.5 },    // Shorter (no filtration)
    'filtration-tvoc': { x: 6, y: 5.5, w: 3, h: 1 }, // NEW - below temp control
    'job-details': { x: 9, y: 4, w: 3, h: 2.5 }       // Taller to match
  }
};
```

Grid: 12 columns × variable rows (auto-height based on content)

---

## localStorage Strategy

### Storage Keys:
- **Layout:** `flashforge-webui-layout-{serialNumber}` (per-printer)
  - Example: `flashforge-webui-layout-ABC123456`
- **Settings:** `flashforge-webui-settings-{serialNumber}` (per-printer)
  - Example: `flashforge-webui-settings-ABC123456`

### Scope:
- **Per-printer** using serial number as unique identifier
- Per browser/device (no cross-device sync)
- User can have different layouts for each physical printer
- When switching between printers, layout auto-switches

### Persistence:
- Automatic on every layout change (debounced 1 second)
- Settings saved immediately on "Save" button click

### Fallback:
- Default layout if none saved or corrupted
- Validation on load to ensure data integrity

### Multi-Printer Behavior:
1. **First Connection**: User connects to Printer A (SN:ABC123)
   - Loads `flashforge-webui-layout-ABC123` or creates default
   - User customizes layout → saves to `flashforge-webui-layout-ABC123`

2. **Second Printer**: User connects to Printer B (SN:DEF456) via context switcher
   - Saves current layout to `flashforge-webui-layout-ABC123`
   - Loads `flashforge-webui-layout-DEF456` or creates default
   - Layout switches to Printer B's saved configuration

3. **Switch Back**: User switches back to Printer A
   - Saves Printer B's layout to `flashforge-webui-layout-DEF456`
   - Loads `flashforge-webui-layout-ABC123`
   - Returns to Printer A's customized layout

4. **Feature Differences**: If Printer B doesn't support filtration:
   - Filtration component is automatically hidden (not available)
   - Layout adapts to feature set
   - When switching back to Printer A (with filtration), component reappears

---

## Success Criteria

- ✅ WebUI matches Electron app theming (colors, spacing, shadows)
- ✅ All 6 current panels work identically to current WebUI
- ✅ Users can drag-and-drop to customize layout
- ✅ Layout persists in localStorage across sessions
- ✅ Settings menu allows showing/hiding panels
- ✅ Edit mode toggle for locking/unlocking layout
- ✅ Mobile responsive design maintained
- ✅ No functionality regressions (camera, controls, multi-printer)
- ✅ Build process includes GridStack assets
- ✅ Type-safe TypeScript throughout

---

## Open Questions / To Discuss

1. **Camera as Grid Component:**
   - Should camera view be a draggable grid component or stay fixed?
   - Current plan: Keep camera separate (left side) initially, can migrate later

2. **Mobile Grid Behavior:**
   - Should mobile force vertical stack or allow limited grid customization?
   - Current plan: Force vertical stack on mobile (< 768px)

3. **Default Panel Visibility:**
   - Should all panels be visible by default or minimal set?
   - Current plan: All visible by default, users can hide via settings

4. **Edit Mode Default:**
   - Should edit mode be enabled or locked by default?
   - Current plan: Locked by default for safety

5. **Layout History:**
   - Should we implement undo/redo for layout changes?
   - Current plan: Just reset to default for MVP, history is optional enhancement

---

## Implementation Notes

- **No Electron/IPC coupling** - WebUI classes are browser-only
- **localStorage is superior** to server-side storage for WebUI use case
- **Gradual migration** - Existing functionality preserved, just enhanced
- **Type safety** - Full TypeScript throughout
- **Performance** - localStorage reads are synchronous and fast
- **Accessibility** - Maintain keyboard navigation and screen reader support

---

## Future Enhancements (Post-MVP)

- Layout import/export (share layouts between devices)
- Preset layouts (compact, detailed, monitoring-focused, etc.)
- Component-specific settings (e.g., camera resolution, refresh rate)
- Multi-user layout profiles (if auth is added)
- Layout history with undo/redo
- Drag-in component palette (like Electron app)
- Custom component creation
- Theme variants (light mode, high contrast)
