# Hamburger Menu Dropdown Implementation Specification

## Design Overview

Replace the 5 default topbar buttons (Connect, Settings, Status, IFS, Pin Config) with a single **hamburger menu button** that opens a professional dropdown menu. The 3 custom shortcut buttons remain unchanged.

---

## Visual Design Specifications

### Hamburger Button
- **Icon**: 3 horizontal lines (SVG)
- **Size**: 24x24px icon, 32px button height (matches topbar)
- **Style**: Same as current topbar buttons (dark bg, border, hover state)
- **Position**: First button in `.left-controls`

### Dropdown Menu
- **Position**: Anchored directly below hamburger button, left-aligned
- **Width**: 200px
- **Background**: `var(--card-bg)` (#252525)
- **Border**: 1px solid `var(--border-color-light)` (#3a3a3a)
- **Shadow**: `var(--shadow-lg)` for depth
- **Border Radius**: 6px
- **Padding**: 8px vertical

### Menu Items (5 total)
1. **Connect** - Network/plug icon
2. **Settings** - Gear icon
3. **Status** - Chart/graph icon
4. **IFS** - Storage/filament icon (hidden until material station detected)
5. **Configure Shortcuts** - Pin icon (moved from separate button)

**Item Styling**:
- Height: 36px per item
- Padding: 8px 12px
- Icon: 20x20px SVG (left aligned, 8px margin-right)
- Label: `var(--text-color)`, 14px font
- Hover: `var(--card-bg-hover)` background + subtle 2px translateX
- Active click: Brief highlight effect
- Border between items: Optional 1px divider before "Configure Shortcuts"

### Animation
**Open Animation** (0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)):
- Slide down: `translateY(-10px)` → `translateY(0)`
- Fade in: `opacity: 0` → `opacity: 1`
- Transform origin: top left

**Close Animation** (0.15s ease):
- Fade out: `opacity: 1` → `opacity: 0`

**Item Hover** (0.15s ease):
- Background color change
- Transform: `translateX(2px)`

---

## User Preferences

Based on clarification questions:
- **IFS Visibility**: Hidden by default, only visible when material station is detected (maintains current behavior)
- **Pin Config Location**: Moved inside dropdown menu as the 5th option
- **Icon Style**: SVG icons (professional, customizable, matches existing pin icon style)
- **Animation Style**: Slide down + fade (smooth, modern)

---

## Implementation Details

### Files to Modify

#### 1. **HTML** (`src/index.html`)
**Changes**:
- Replace 5 individual buttons with single hamburger button
- Add dropdown menu structure (initially hidden)
- Keep shortcut buttons unchanged

**Current Structure** (lines 11-43):
```html
<div class="left-controls">
  <button id="btn-connect">Connect</button>
  <button id="btn-settings">Settings</button>
  <button id="btn-status">Status</button>
  <button id="btn-ifs" class="hidden">IFS</button>
  <button id="btn-pin-config" class="pin-config-button">...</button>
  <button id="btn-shortcut-1" class="shortcut-button hidden"></button>
  <button id="btn-shortcut-2" class="shortcut-button hidden"></button>
  <button id="btn-shortcut-3" class="shortcut-button hidden"></button>
</div>
```

**New Structure**:
```html
<div class="left-controls">
  <!-- NEW: Hamburger Menu Button -->
  <button id="btn-main-menu" class="main-menu-button" aria-label="Main Menu" aria-expanded="false">
    <svg class="hamburger-icon" viewBox="0 0 24 24">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <!-- NEW: Dropdown Menu (hidden by default) -->
  <div id="main-menu-dropdown" class="main-menu-dropdown hidden" role="menu">
    <button class="menu-item" data-action="connect" role="menuitem">
      <svg class="menu-item-icon" viewBox="0 0 24 24">
        <!-- Connect icon: Network/Plug -->
        <path d="M6 9h12M6 15h12M9 3v3M15 3v3M9 18v3M15 18v3M5 8h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
      </svg>
      <span class="menu-item-label">Connect</span>
    </button>

    <button class="menu-item" data-action="settings" role="menuitem">
      <svg class="menu-item-icon" viewBox="0 0 24 24">
        <!-- Settings icon: Gear -->
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6M1 12h6m6 0h6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M19.78 4.22l-4.24 4.24m-5.08 5.08l-4.24 4.24"/>
      </svg>
      <span class="menu-item-label">Settings</span>
    </button>

    <button class="menu-item" data-action="status" role="menuitem">
      <svg class="menu-item-icon" viewBox="0 0 24 24">
        <!-- Status icon: Chart/Graph -->
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      <span class="menu-item-label">Status</span>
    </button>

    <button id="menu-item-ifs" class="menu-item hidden" data-action="ifs" role="menuitem">
      <svg class="menu-item-icon" viewBox="0 0 24 24">
        <!-- IFS icon: Storage/Filament -->
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <span class="menu-item-label">IFS</span>
    </button>

    <div class="menu-divider"></div>

    <button class="menu-item" data-action="pin-config" role="menuitem">
      <svg class="menu-item-icon" viewBox="0 0 24 24">
        <!-- Pin icon: Reuse existing pin icon -->
        <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
      <span class="menu-item-label">Configure Shortcuts</span>
    </button>
  </div>

  <!-- UNCHANGED: Shortcut Buttons -->
  <button id="btn-shortcut-1" class="shortcut-button hidden"></button>
  <button id="btn-shortcut-2" class="shortcut-button hidden"></button>
  <button id="btn-shortcut-3" class="shortcut-button hidden"></button>
</div>
```

#### 2. **CSS** (`src/index.css`)
**Changes**:
- Remove styles for old 5 buttons (btn-connect, btn-settings, btn-status, btn-ifs, btn-pin-config)
- Add hamburger button styles
- Add dropdown menu styles
- Add menu item styles
- Add slide-down + fade animation

**Styles to Remove** (lines 133-172):
```css
/* Remove all button-specific styles for:
   #btn-connect, #btn-settings, #btn-status, #btn-ifs, .pin-config-button
*/
```

**New CSS to Add**:
```css
/* ============================================
   HAMBURGER MENU BUTTON
   ============================================ */

.main-menu-button {
  padding: 4px 8px;
  margin-right: 5px;
  background-color: var(--dark-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-menu-button:hover {
  background-color: var(--card-bg-hover);
}

.hamburger-icon {
  width: 20px;
  height: 20px;
  stroke: var(--text-color);
  stroke-width: 2;
  stroke-linecap: round;
  fill: none;
}

/* ============================================
   DROPDOWN MENU
   ============================================ */

.main-menu-dropdown {
  position: absolute;
  top: 38px; /* Below topbar (32px height + 6px spacing) */
  left: 5px;
  width: 200px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  box-shadow: var(--shadow-lg);
  padding: 8px 0;
  z-index: 10000;
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  -webkit-app-region: no-drag;
}

.main-menu-dropdown.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.main-menu-dropdown.hidden {
  display: none;
}

/* ============================================
   MENU ITEMS
   ============================================ */

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  transition: background-color var(--transition-fast), transform var(--transition-fast);
  text-align: left;
  -webkit-app-region: no-drag;
}

.menu-item:hover {
  background-color: var(--card-bg-hover);
  transform: translateX(2px);
}

.menu-item:active {
  background-color: var(--border-color-light);
}

.menu-item.hidden {
  display: none;
}

.menu-item-icon {
  width: 20px;
  height: 20px;
  min-width: 20px;
  margin-right: 8px;
  stroke: var(--text-color);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu-item-label {
  font-size: 14px;
  font-weight: 400;
  white-space: nowrap;
}

/* ============================================
   MENU DIVIDER
   ============================================ */

.menu-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 8px;
}
```

**CSS Variables Reference** (already defined in `:root`):
```css
--dark-bg: #1e1e1e;
--card-bg: #252525;
--card-bg-hover: #2a2a2a;
--border-color: #2d2d2d;
--border-color-light: #3a3a3a;
--text-color: #e8e8e8;
--shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
--transition-fast: 0.15s ease;
```

#### 3. **TypeScript** (`src/renderer.ts`)
**Changes**:
- Remove event listeners for old 5 buttons (lines 1365-1465)
- Add hamburger menu state management
- Add menu toggle handler
- Add menu item click handlers
- Add click-outside handler
- Add keyboard support (Escape key)
- Update IFS visibility logic to target menu item instead of button

**Code to Remove** (lines 1365-1465):
```typescript
// Remove all button event listeners for:
// btn-connect, btn-settings, btn-status, btn-ifs, btn-pin-config
```

**New Code to Add**:
```typescript
// ============================================
// HAMBURGER MENU FUNCTIONALITY
// ============================================

// Menu state
let isMenuOpen = false;
const menuButton = document.getElementById('btn-main-menu') as HTMLButtonElement;
const menuDropdown = document.getElementById('main-menu-dropdown') as HTMLDivElement;

/**
 * Closes the hamburger menu with animation
 */
function closeMenu(): void {
  if (!isMenuOpen) return;

  isMenuOpen = false;
  menuDropdown?.classList.remove('show');
  menuButton?.setAttribute('aria-expanded', 'false');

  // Remove from DOM after animation completes (150ms fade out)
  setTimeout(() => {
    if (!isMenuOpen && menuDropdown) {
      menuDropdown.classList.add('hidden');
    }
  }, 150);
}

/**
 * Opens the hamburger menu with animation
 */
function openMenu(): void {
  if (isMenuOpen) return;

  isMenuOpen = true;
  menuDropdown?.classList.remove('hidden');

  // Trigger reflow to ensure transition plays
  void menuDropdown?.offsetHeight;

  menuDropdown?.classList.add('show');
  menuButton?.setAttribute('aria-expanded', 'true');
}

/**
 * Toggles the hamburger menu open/closed
 */
function toggleMenu(): void {
  if (isMenuOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

// Toggle menu on hamburger button click
menuButton?.addEventListener('click', (e: MouseEvent) => {
  e.stopPropagation();
  toggleMenu();
});

// Menu item action mapping
const menuActions: Record<string, string> = {
  'connect': 'open-printer-selection',
  'settings': 'open-settings-window',
  'status': 'open-status-dialog',
  'ifs': 'open-ifs-dialog',
  'pin-config': 'shortcut-config:open'
};

// Add click handlers to all menu items
document.querySelectorAll('.menu-item').forEach((item) => {
  item.addEventListener('click', () => {
    const action = item.getAttribute('data-action');

    if (action && menuActions[action]) {
      const channel = menuActions[action];
      window.api.send(channel);
      closeMenu();
    }
  });
});

// Click outside to close menu
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as Node;

  if (isMenuOpen &&
      menuButton && !menuButton.contains(target) &&
      menuDropdown && !menuDropdown.contains(target)) {
    closeMenu();
  }
});

// Escape key to close menu
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isMenuOpen) {
    closeMenu();
    menuButton?.focus(); // Return focus to hamburger button
  }
});

// ============================================
// IFS MENU ITEM VISIBILITY
// ============================================

/**
 * Updates IFS menu item visibility based on material station detection
 * Called from polling update handler
 */
function updateIFSMenuItemVisibility(hasMaterialStation: boolean): void {
  const ifsMenuItem = document.getElementById('menu-item-ifs');

  if (hasMaterialStation) {
    ifsMenuItem?.classList.remove('hidden');
  } else {
    ifsMenuItem?.classList.add('hidden');
  }
}

// Update the existing polling handler (around line 1736-1744) to call:
// updateIFSMenuItemVisibility(materialStationDetected);
```

**Location to Update IFS Visibility** (src/renderer.ts:1736-1744):
```typescript
// In the polling update handler where IFS button visibility is currently updated:
// OLD CODE:
const ifsButton = document.getElementById('btn-ifs');
if (materialStationDetected) {
  ifsButton?.classList.remove('hidden');
} else {
  ifsButton?.classList.add('hidden');
}

// NEW CODE:
updateIFSMenuItemVisibility(materialStationDetected);
```

---

## SVG Icon Specifications

All icons use the same styling:
- **ViewBox**: `0 0 24 24`
- **Stroke Width**: 2
- **Stroke Linecap**: round
- **Stroke Linejoin**: round
- **Fill**: none (stroke only)
- **Size**: 20x20px when rendered

### 1. Hamburger Icon (Menu Button)
```svg
<svg class="hamburger-icon" viewBox="0 0 24 24">
  <line x1="3" y1="6" x2="21" y2="6"/>
  <line x1="3" y1="12" x2="21" y2="12"/>
  <line x1="3" y1="18" x2="21" y2="18"/>
</svg>
```

### 2. Connect Icon (Network/Plug)
```svg
<svg class="menu-item-icon" viewBox="0 0 24 24">
  <path d="M6 9h12M6 15h12M9 3v3M15 3v3M9 18v3M15 18v3M5 8h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
</svg>
```

### 3. Settings Icon (Gear)
```svg
<svg class="menu-item-icon" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="3"/>
  <path d="M12 1v6m0 6v6M1 12h6m6 0h6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M19.78 4.22l-4.24 4.24m-5.08 5.08l-4.24 4.24"/>
</svg>
```

### 4. Status Icon (Chart/Graph)
```svg
<svg class="menu-item-icon" viewBox="0 0 24 24">
  <line x1="18" y1="20" x2="18" y2="10"/>
  <line x1="12" y1="20" x2="12" y2="4"/>
  <line x1="6" y1="20" x2="6" y2="14"/>
</svg>
```

### 5. IFS Icon (Storage/Filament)
```svg
<svg class="menu-item-icon" viewBox="0 0 24 24">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <line x1="3" y1="9" x2="21" y2="9"/>
  <line x1="9" y1="21" x2="9" y2="9"/>
</svg>
```

### 6. Pin Icon (Configure Shortcuts)
Reuse existing pin icon from `btn-pin-config` button (src/index.html:27-31):
```svg
<svg class="menu-item-icon" viewBox="0 0 24 24">
  <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
</svg>
```

---

## Accessibility Features

### ARIA Attributes
- **Hamburger Button**:
  - `aria-label="Main Menu"` - Describes button purpose
  - `aria-expanded="false"` - Indicates menu state (toggles to "true" when open)

- **Dropdown Container**:
  - `role="menu"` - Identifies as a menu widget

- **Menu Items**:
  - `role="menuitem"` - Identifies as selectable menu items

### Keyboard Support
- **Escape Key**: Closes menu and returns focus to hamburger button
- **Tab Key**: Allows tabbing through menu items (default behavior)
- **Enter/Space**: Activates focused menu item (default button behavior)

### Focus Management
- When menu closes via Escape key, focus returns to hamburger button
- Visual focus indicators automatically provided by browser for keyboard navigation
- Focus is trapped within menu when open (click outside or Escape to exit)

### Screen Reader Support
- Menu state announced via `aria-expanded` attribute
- All interactive elements have semantic HTML (`<button>`)
- Menu items have clear labels via `<span class="menu-item-label">`

---

## Current Button Functionality Reference

### IPC Channel Mappings
| Button | IPC Channel | Handler Location |
|--------|-------------|------------------|
| Connect | `open-printer-selection` | `src/ipc/DialogHandlers.ts:43` |
| Settings | `open-settings-window` | `src/ipc/handlers/dialog-handlers.ts:67` |
| Status | `open-status-dialog` | `src/ipc/handlers/dialog-handlers.ts:94` |
| IFS | `open-ifs-dialog` | `src/ipc/handlers/dialog-handlers.ts:415` |
| Pin Config | `shortcut-config:open` | `src/renderer.ts:1005-1011` |

### IFS Button Visibility Logic
**Current Location**: `src/renderer.ts:1736-1744`

**Behavior**:
- Hidden by default
- Shown when `materialStation` data is present in polling updates
- Applies `.hidden` class to toggle visibility

**Implementation Pattern**:
```typescript
// In polling update handler:
const materialStation = data.materialStation; // or similar property
const ifsButton = document.getElementById('btn-ifs');

if (materialStation) {
  ifsButton?.classList.remove('hidden');
} else {
  ifsButton?.classList.add('hidden');
}
```

This same pattern must be adapted to target `#menu-item-ifs` instead of `#btn-ifs`.

---

## Testing Checklist

### Functionality Tests
- [ ] Hamburger button opens menu on click
- [ ] Hamburger button closes menu on second click
- [ ] Connect menu item opens printer selection dialog
- [ ] Settings menu item opens settings window
- [ ] Status menu item opens status dialog
- [ ] IFS menu item opens IFS dialog (when visible)
- [ ] Configure Shortcuts menu item opens shortcut config dialog
- [ ] Menu auto-closes after selecting any item
- [ ] Click outside menu closes it
- [ ] Escape key closes menu
- [ ] Focus returns to hamburger button after Escape key close

### Visibility Tests
- [ ] IFS menu item is hidden on initial load (no printer connected)
- [ ] IFS menu item appears when material station is detected
- [ ] IFS menu item hides when material station is no longer detected
- [ ] Menu divider appears correctly above "Configure Shortcuts"

### Visual Tests
- [ ] Menu positioned correctly below hamburger button (38px from top, 5px from left)
- [ ] Menu width is 200px
- [ ] Menu has correct background color (#252525)
- [ ] Menu has correct border (1px solid #3a3a3a)
- [ ] Menu has shadow for depth
- [ ] Menu has 6px border radius
- [ ] All menu items are 36px tall
- [ ] Icons are 20x20px with 8px margin-right
- [ ] Labels are 14px font size
- [ ] Divider is 1px height with correct color

### Animation Tests
- [ ] Menu slides down from -10px translateY on open
- [ ] Menu fades in (opacity 0 → 1) on open
- [ ] Animation duration is 0.25s for open
- [ ] Menu fades out (opacity 1 → 0) on close
- [ ] Animation duration is 0.15s for close
- [ ] Menu items have subtle 2px translateX on hover
- [ ] Hover animation is smooth (0.15s ease)
- [ ] No visual glitches during animation
- [ ] Transform origin is top-left

### Hover State Tests
- [ ] Hamburger button background changes on hover
- [ ] Menu items background changes on hover (#2a2a2a)
- [ ] Menu items shift right 2px on hover
- [ ] Hover transitions are smooth (0.15s)
- [ ] Active state shows darker background on click

### Integration Tests
- [ ] Shortcut buttons (1-3) still function correctly
- [ ] Shortcut buttons remain in correct position
- [ ] Window controls (minimize, maximize, close) still work
- [ ] Title text remains centered
- [ ] macOS traffic lights still visible (if on macOS)
- [ ] Topbar remains draggable (except on interactive elements)

### Accessibility Tests
- [ ] `aria-expanded="false"` when menu closed
- [ ] `aria-expanded="true"` when menu open
- [ ] Tab key navigates through menu items
- [ ] Enter key activates focused menu item
- [ ] Screen reader announces menu state
- [ ] Keyboard focus visible on menu items

### Edge Cases
- [ ] Rapid clicking hamburger button doesn't break animation
- [ ] Opening menu, then clicking hamburger again closes it properly
- [ ] Menu closes before opening a dialog
- [ ] No z-index conflicts with other UI elements
- [ ] Menu doesn't clip outside viewport
- [ ] Menu handles window resize correctly

---

## Benefits of This Implementation

1. **Cleaner Topbar**: Reduces 5 buttons to 1 button (80% space reduction)
2. **Scalability**: Easy to add more menu items in the future without cluttering topbar
3. **Modern UX**: Hamburger menu is a widely recognized pattern
4. **Professional**: Smooth animations and polished interactions
5. **Consistent**: Uses existing design system (colors, shadows, transitions, spacing)
6. **Accessible**: ARIA labels, keyboard support, focus management
7. **Maintains Functionality**: All existing features remain accessible
8. **Future-Proof**: Easier to reorganize or expand menu structure

---

## Design Rationale

### Why This Approach?
- **User Request**: Consolidate topbar buttons into a single dropdown
- **Existing Patterns**: Follows FlashForgeUI's dark theme and interaction patterns
- **No Framework**: Pure CSS/HTML implementation matches codebase architecture
- **Performance**: Lightweight, no additional dependencies
- **Maintainability**: Simple state management, clear event handlers

### Alternative Approaches Considered
1. **Context Menu (Right-Click)**: Less discoverable than visible hamburger button
2. **Nested Menus**: Adds complexity, not needed for 5 items
3. **Accordion Menu**: Takes more vertical space, less clean
4. **Tab Bar**: Doesn't fit topbar layout, conflicts with printer tabs

### Design Decisions
- **200px width**: Wide enough for labels, narrow enough to feel contained
- **36px item height**: Comfortable click target, matches button height patterns
- **Slide down + fade**: More dynamic than fade-only, less distracting than scale
- **0.25s open, 0.15s close**: Open feels deliberate, close feels responsive
- **2px translateX hover**: Subtle directional affordance without being jarring
- **SVG icons**: Professional, scalable, matches existing pin icon style
- **Divider before shortcuts**: Visually separates configuration from actions

---

## File Summary

### Files to Modify
1. **src/index.html** - Replace 5 buttons with hamburger menu + dropdown structure
2. **src/index.css** - Remove old button styles, add menu styles + animations
3. **src/renderer.ts** - Remove old handlers, add menu state management + event listeners

### Lines of Code Impact
- **HTML**: ~40 lines added, ~15 lines removed
- **CSS**: ~150 lines added, ~40 lines removed
- **TypeScript**: ~80 lines added, ~100 lines removed
- **Net Change**: +70 lines (cleaner, more maintainable structure)

### No Breaking Changes
- IPC channels remain unchanged
- Dialog handlers remain unchanged
- Shortcut button system remains unchanged
- All existing functionality preserved
