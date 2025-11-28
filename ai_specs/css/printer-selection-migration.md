# CSS Migration Spec: printer-selection.css

**Status:** ⏳ PENDING
**File:** `src/ui/printer-selection/printer-selection.css`
**Total Patterns:** 20 hardcoded colors
**Priority:** HIGH - Printer discovery and saved printer selection dialog

## Pattern Breakdown

- **Hex colors:** 17 patterns
- **RGB/RGBA:** 1 pattern
- **Named colors:** 2 patterns

## Migration Strategy

### Category 1: Custom CSS Variables (10 patterns in :root block)

Lines 14-25 define legacy custom variables that should be removed after migrating their usages:

| Line | Variable | Current Value | Replacement Strategy |
|------|----------|---------------|---------------------|
| 15 | `--button-bg` | `#4285f4` | Replace all usages with `var(--theme-primary)` |
| 16 | `--button-hover` | `#5a95f5` | Replace all usages with `var(--theme-primary-hover)` |
| 17 | `--row-hover-bg` | `#404040` | Replace with `var(--surface-elevated)` |
| 18 | `--selected-bg` | `#4285f4` | Replace with `var(--theme-primary)` |
| 19 | `--selected-text` | `white` | Replace with `var(--accent-text-color)` |
| 20 | `--status-online` | `#4caf50` | Replace with `var(--success-color)` |
| 21 | `--status-offline` | `#f44336` | Replace with `var(--error-color)` |
| 22 | `--status-changed` | `#ff9800` | Replace with `var(--warning-color)` |
| 23 | `--table-border` | `#555` | Replace with `var(--border-color)` |
| 24 | `--table-header-bg` | `#2a2a2a` | Replace with `var(--surface-muted)` |

**Action:** After migrating all usages, DELETE the entire `:root` block (lines 14-25).

### Category 2: Direct Hex Color Usage (7 patterns)

Hardcoded colors used directly in styles:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 45 | `#353535` | `var(--surface-elevated)` | Table container background |
| 124 | `#ffffff` | `var(--theme-text)` | Table header text color |
| 132 | `#353535` | `var(--surface-elevated)` | Table row background |
| 151 | `#aaaaaa` | `color-mix(in srgb, var(--theme-text) 60%, transparent)` | Loading/message text |
| 217 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 75%, transparent)` | Instructions text |
| 234 | `#666` | `var(--surface-elevated)` | Cancel button background |
| 235 | `#777` | `var(--border-color)` | Cancel button border |

### Category 3: Disabled Button Colors (2 patterns)

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 244 | `#555` | `var(--surface-muted)` | Disabled button background |
| 245 | `#666` | `var(--border-color)` | Disabled button border |

### Category 4: RGBA Pattern (1 pattern)

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 162 | `rgba(53, 53, 53, 0.95)` | `color-mix(in srgb, var(--surface-elevated) 95%, transparent)` | Message overlay background |

## Legacy Variable Usage Map

Track where legacy variables are used and what they should become:

### `--button-bg` usages:
- Line 145: `.last-used` border → `var(--theme-primary)`
- Line 224: `.dialog-button` background → `var(--theme-primary)`
- Line 225: `.dialog-button` border → `var(--theme-primary)`
- Line 253: `.scanning-animation` color → `var(--theme-primary)`
- Line 271: `#no-printers-message button` background → `var(--theme-primary)`
- Line 273: `#no-printers-message button` border → `var(--theme-primary)`

### `--button-hover` usages:
- Line 229: `.dialog-button:hover` background → `var(--theme-primary-hover)`
- Line 230: `.dialog-button:hover` border → `var(--theme-primary-hover)`
- Line 282: `#no-printers-message button:hover` background → `var(--theme-primary-hover)`
- Line 283: `#no-printers-message button:hover` border → `var(--theme-primary-hover)`

### `--row-hover-bg` usages:
- Line 136: `tbody tr:hover` background → `var(--surface-elevated)`

### `--selected-bg` usages:
- Line 140: `tbody tr.selected` background → `var(--theme-primary)`

### `--selected-text` usages:
- Line 141: `tbody tr.selected` color → `var(--accent-text-color)`

### `--status-online` usages:
- Line 181: `.status-online` background → `var(--success-color)`

### `--status-offline` usages:
- Line 186: `.status-offline` background → `var(--error-color)`

### `--status-changed` usages:
- Line 191: `.status-changed` background → `var(--warning-color)`
- Line 197: `.ip-changed` color → `var(--warning-color)`

### `--table-border` usages:
- Line 42: `.table-container` border → `var(--border-color)`
- Line 113: `th, td` border-bottom → `var(--border-color)`

### `--table-header-bg` usages:
- Line 120: `th` background → `var(--surface-muted)`

## Implementation Checklist

- [ ] Replace 6 `--button-bg` usages → `var(--theme-primary)`
- [ ] Replace 4 `--button-hover` usages → `var(--theme-primary-hover)`
- [ ] Replace 1 `--row-hover-bg` usage → `var(--surface-elevated)`
- [ ] Replace 1 `--selected-bg` usage → `var(--theme-primary)`
- [ ] Replace 1 `--selected-text` usage → `var(--accent-text-color)`
- [ ] Replace 1 `--status-online` usage → `var(--success-color)`
- [ ] Replace 1 `--status-offline` usage → `var(--error-color)`
- [ ] Replace 2 `--status-changed` usages → `var(--warning-color)`
- [ ] Replace 2 `--table-border` usages → `var(--border-color)`
- [ ] Replace 1 `--table-header-bg` usage → `var(--surface-muted)`
- [ ] Migrate 7 direct hex color patterns
- [ ] Migrate 2 disabled button patterns
- [ ] Migrate 1 RGBA overlay pattern
- [ ] **DELETE entire :root block** (lines 14-25) after all migrations
- [ ] User to run: `npm run type-check`
- [ ] User to run: `npm run build:renderer`
- [ ] User to run: `npm run lint`
- [ ] Verify with `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/printer-selection`

## Migration Details

### Step 1: Replace Legacy Variable Usages

**Before:**
```css
/* Line 42 - Table container border */
border: 1px solid var(--table-border);

/* Line 113 - Table cell borders */
border-bottom: 1px solid var(--table-border);

/* Line 120 - Table header background */
background-color: var(--table-header-bg);

/* Line 136 - Row hover */
background-color: var(--row-hover-bg);

/* Line 140-141 - Selected row */
background-color: var(--selected-bg);
color: var(--selected-text);

/* Line 145 - Last-used indicator */
border-left: 3px solid var(--button-bg);

/* Line 181 - Status online */
background-color: var(--status-online);

/* Line 186 - Status offline */
background-color: var(--status-offline);

/* Line 191 - Status changed */
background-color: var(--status-changed);

/* Line 197 - IP changed text */
color: var(--status-changed);

/* Line 224-225 - Primary button */
background-color: var(--button-bg);
border-color: var(--button-bg);

/* Line 229-230 - Primary button hover */
background-color: var(--button-hover);
border-color: var(--button-hover);

/* Line 253 - Scanning animation */
color: var(--button-bg);

/* Line 271-273 - No printers button */
background-color: var(--button-bg);
border: 1px solid var(--button-bg);

/* Line 282-283 - No printers button hover */
background-color: var(--button-hover);
border-color: var(--button-hover);
```

**After:**
```css
/* Line 42 - Table container border */
border: 1px solid var(--border-color);

/* Line 113 - Table cell borders */
border-bottom: 1px solid var(--border-color);

/* Line 120 - Table header background */
background-color: var(--surface-muted);

/* Line 136 - Row hover */
background-color: var(--surface-elevated);

/* Line 140-141 - Selected row */
background-color: var(--theme-primary);
color: var(--accent-text-color);

/* Line 145 - Last-used indicator */
border-left: 3px solid var(--theme-primary);

/* Line 181 - Status online */
background-color: var(--success-color);

/* Line 186 - Status offline */
background-color: var(--error-color);

/* Line 191 - Status changed */
background-color: var(--warning-color);

/* Line 197 - IP changed text */
color: var(--warning-color);

/* Line 224-225 - Primary button */
background-color: var(--theme-primary);
border-color: var(--theme-primary);

/* Line 229-230 - Primary button hover */
background-color: var(--theme-primary-hover);
border-color: var(--theme-primary-hover);

/* Line 253 - Scanning animation */
color: var(--theme-primary);

/* Line 271-273 - No printers button */
background-color: var(--theme-primary);
border: 1px solid var(--theme-primary);

/* Line 282-283 - No printers button hover */
background-color: var(--theme-primary-hover);
border-color: var(--theme-primary-hover);
```

### Step 2: Migrate Direct Hex Colors

**Before:**
```css
/* Line 45 - Table container background */
background-color: #353535;

/* Line 124 - Table header text */
color: #ffffff;

/* Line 132 - Table row background */
background-color: #353535;

/* Line 151 - Loading/message text */
color: #aaaaaa;

/* Line 162 - Message overlay background */
background-color: rgba(53, 53, 53, 0.95);

/* Line 217 - Instructions text */
color: #cccccc;

/* Line 234-235 - Cancel button */
background-color: #666;
border-color: #777;

/* Line 244-245 - Disabled button */
background-color: #555;
border-color: #666;
```

**After:**
```css
/* Line 45 - Table container background */
background-color: var(--surface-elevated);

/* Line 124 - Table header text */
color: var(--theme-text);

/* Line 132 - Table row background */
background-color: var(--surface-elevated);

/* Line 151 - Loading/message text */
color: color-mix(in srgb, var(--theme-text) 60%, transparent);

/* Line 162 - Message overlay background */
background-color: color-mix(in srgb, var(--surface-elevated) 95%, transparent);

/* Line 217 - Instructions text */
color: color-mix(in srgb, var(--theme-text) 75%, transparent);

/* Line 234-235 - Cancel button */
background-color: var(--surface-elevated);
border-color: var(--border-color);

/* Line 244-245 - Disabled button */
background-color: var(--surface-muted);
border-color: var(--border-color);
```

### Step 3: Delete Legacy :root Block

**Delete lines 14-25:**
```css
/* DELETE THIS ENTIRE BLOCK */
:root {
    --button-bg: #4285f4;
    --button-hover: #5a95f5;
    --row-hover-bg: #404040;
    --selected-bg: #4285f4;
    --selected-text: white;
    --status-online: #4caf50;
    --status-offline: #f44336;
    --status-changed: #ff9800;
    --table-border: #555;
    --table-header-bg: #2a2a2a;
}
```

## Expected Result

After migration:
- ✅ **20 hardcoded color patterns migrated** to theme system
- ✅ **Legacy :root block removed** (10 custom variables deleted)
- ✅ All colors adapt to user-selected theme
- ✅ Status indicators use proper semantic colors
- ✅ Primary actions use `--theme-primary`
- ✅ Proper contrast for selected rows

## Notes

- **Dialog Purpose:** Printer discovery (network scan) and saved printer selection
- **Dual Mode:** Shows discovered printers (3 columns) or saved printers (5 columns with status)
- **Status Indicators:** Online (green), Offline (red), IP Changed (orange)
- **Selection:** Selected row uses primary color background with contrasting text
- **Last-Used:** Blue left border indicator for last connected printer
- **Legacy Variables:** This file uses an outdated pattern of defining custom variables in `:root` - these should be removed completely
- **Visual Fidelity:** Primary button color should match the selected row color (both use primary)

## Common Patterns Reference

```css
/* Legacy variable replacement */
var(--button-bg) /* BEFORE */
var(--theme-primary) /* AFTER */

var(--button-hover) /* BEFORE */
var(--theme-primary-hover) /* AFTER */

var(--status-online) /* BEFORE */
var(--success-color) /* AFTER */

var(--status-offline) /* BEFORE */
var(--error-color) /* AFTER */

var(--table-border) /* BEFORE */
var(--border-color) /* AFTER */

/* Direct hex replacement */
background-color: #353535; /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

color: #aaaaaa; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 60%, transparent); /* AFTER */
```

## Testing Notes

When verifying this migration:
1. Test printer discovery mode (3-column table)
2. Test saved printers mode (5-column table with status)
3. Verify row selection highlighting (primary color background)
4. Check last-used indicator (blue left border)
5. Verify status badges (online=green, offline=red, changed=orange)
6. Test hover effects on table rows
7. Check primary button styling
8. Verify cancel button styling (secondary style)
9. Test disabled button state
10. Verify message overlay transparency
11. Test with both light and dark themes
12. Ensure table header text is readable across themes
