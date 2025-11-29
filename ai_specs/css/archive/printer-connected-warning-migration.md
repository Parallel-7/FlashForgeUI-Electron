# CSS Migration Spec: printer-connected-warning.css

**Status:** ✅ COMPLETED
**File:** `src/ui/printer-connected-warning/printer-connected-warning.css`
**Total Patterns:** 20 (20 migrated, 0 intentional kept)
**Priority:** HIGH - Printer connection warning dialog

## Pattern Breakdown

- **Hex colors:** 16 patterns
- **RGB/RGBA:** 4 patterns
- **Named colors:** 0 patterns (all to migrate)

## Migration Strategy

### Category 1: Warning Colors (3 patterns)

Orange warning accent colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 20 | `#f39c12` | `var(--warning-color)` | Warning color variable definition |
| 21 | `rgba(243, 156, 18, 0.1)` | `color-mix(in srgb, var(--warning-color) 10%, transparent)` | Warning background |
| 22 | `rgba(243, 156, 18, 0.3)` | `color-mix(in srgb, var(--warning-color) 30%, transparent)` | Warning border |

**Note:** Line 20 defines `:root --warning-color` which should be removed since `--warning-color` is global.

### Category 2: Primary Button Colors (2 patterns)

Blue primary action button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 23 | `#4285f4` | `var(--theme-primary)` | Primary button background |
| 24 | `#5a95f5` | `var(--theme-primary-hover)` | Primary button hover |

### Category 3: Cancel Button Colors (2 patterns)

Gray cancel button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 25 | `#666` | `var(--surface-elevated)` | Cancel button background |
| 26 | `#777` | `var(--surface-muted)` | Cancel button hover |

### Category 4: Drop Shadow (1 pattern)

Icon drop shadow:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 62 | `rgba(0, 0, 0, 0.1)` | `color-mix(in srgb, var(--theme-background) 10%, black)` | Warning icon shadow |

### Category 5: Border Colors (3 patterns)

Cancel button border colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 117 | `#777` | `var(--border-color)` | Cancel button border |
| 121 | `#888` | `var(--border-color-light)` | Cancel button hover border |
| 147 | `var(--warning-color)` | Keep as var, but remove `:root` definition | High contrast icon border |

### Category 6: Focus Box Shadows (2 patterns)

Focus state glows:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 111 | `rgba(66, 133, 244, 0.5)` | `color-mix(in srgb, var(--theme-primary) 50%, transparent)` | Primary button focus |
| 126 | `rgba(102, 102, 102, 0.5)` | `color-mix(in srgb, var(--surface-elevated) 50%, transparent)` | Cancel button focus |

### Category 7: Text Colors (4 patterns)

Text color variants:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 81 | `var(--text-color-secondary, #b0b0b0)` | `color-mix(in srgb, var(--theme-text) 65%, transparent)` | Detail message text |
| 146 | `#000000` | `#111111` | High contrast icon background (accessibility) |
| 151 | `#ffffff` | `var(--theme-text)` | High contrast primary message |
| 156 | `#e0e0e0` | `var(--theme-text)` | High contrast detail message |

**Note:** Line 81 uses a fallback pattern that should be removed. Line 146 uses pure black for high contrast mode, which should be softened to `#111111` for consistency with theme system's `getContrastingTextColor()` output.

### Category 8: Root Variable Definitions (3 patterns)

Custom variables in `:root` block to remove:

| Line | Current | Action | Context |
|------|---------|--------|---------|
| 20 | `--warning-color: #f39c12;` | **REMOVE** | Use global `var(--warning-color)` |
| 23 | `--button-bg: #4285f4;` | **REMOVE** | Replace with `var(--theme-primary)` |
| 24 | `--button-hover: #5a95f5;` | **REMOVE** | Replace with `var(--theme-primary-hover)` |
| 25 | `--cancel-bg: #666;` | **REMOVE** | Replace with `var(--surface-elevated)` |
| 26 | `--cancel-hover: #777;` | **REMOVE** | Replace with `var(--surface-muted)` |

## Special Considerations

### Root Variable Cleanup

The `:root` block (lines 19-27) defines custom variables that should be removed:

```css
/* BEFORE */
:root {
    --warning-color: #f39c12;
    --warning-bg: rgba(243, 156, 18, 0.1);
    --warning-border: rgba(243, 156, 18, 0.3);
    --button-bg: #4285f4;
    --button-hover: #5a95f5;
    --cancel-bg: #666;
    --cancel-hover: #777;
}

/* AFTER - Remove entire block */
/* All colors now use global theme variables */
```

**Action:** Remove the entire `:root` block and update all usages throughout the file.

### High Contrast Mode (@media prefers-contrast: high)

Lines 143-158 contain high contrast overrides. Update these:

```css
/* BEFORE */
@media (prefers-contrast: high) {
    .warning-icon {
        background: var(--warning-color);
        color: #000000;
        border-color: var(--warning-color);
    }

    .primary-message {
        color: #ffffff;
        font-weight: 700;
    }

    .detail-message {
        color: #e0e0e0;
    }
}

/* AFTER */
@media (prefers-contrast: high) {
    .warning-icon {
        background: var(--warning-color);
        color: #111111;
        border-color: var(--warning-color);
    }

    .primary-message {
        color: var(--theme-text);
        font-weight: 700;
    }

    .detail-message {
        color: var(--theme-text);
    }
}
```

### Primary Button Styling

Lines 100-108 use custom variables:

```css
/* BEFORE */
.dialog-button.primary {
    background-color: var(--button-bg);
    border-color: var(--button-bg);
}

.dialog-button.primary:hover {
    background-color: var(--button-hover);
    border-color: var(--button-hover);
}

/* AFTER */
.dialog-button.primary {
    background-color: var(--theme-primary);
    border-color: var(--theme-primary);
}

.dialog-button.primary:hover {
    background-color: var(--theme-primary-hover);
    border-color: var(--theme-primary-hover);
}
```

### Cancel Button Styling

Lines 115-123 use custom variables:

```css
/* BEFORE */
.dialog-button.cancel {
    background-color: var(--cancel-bg);
    border-color: #777;
}

.dialog-button.cancel:hover {
    background-color: var(--cancel-hover);
    border-color: #888;
}

/* AFTER */
.dialog-button.cancel {
    background-color: var(--surface-elevated);
    border-color: var(--border-color);
}

.dialog-button.cancel:hover {
    background-color: var(--surface-muted);
    border-color: var(--border-color-light);
}
```

### Detail Message Text

Line 81 uses a fallback pattern that should be simplified:

```css
/* BEFORE */
.detail-message {
    font-size: 14px;
    color: var(--text-color-secondary, #b0b0b0);
    margin: 0;
    line-height: 1.5;
}

/* AFTER */
.detail-message {
    font-size: 14px;
    color: color-mix(in srgb, var(--theme-text) 65%, transparent);
    margin: 0;
    line-height: 1.5;
}
```

## Implementation Checklist

- [x] Remove entire `:root` block (lines 19-27)
- [x] Migrate 3 warning color patterns → `var(--warning-color)` and `color-mix()` (lines 20-22)
- [x] Migrate 2 primary button patterns → `var(--theme-primary)` / `var(--theme-primary-hover)` (lines 101-102, 105-106)
- [x] Migrate 2 cancel button background patterns → `var(--surface-elevated)` / `var(--surface-muted)` (lines 116, 120)
- [x] Migrate 3 cancel button border patterns → `var(--border-color)` / `var(--border-color-light)` (lines 117, 121)
- [x] Migrate 1 drop shadow → `color-mix()` (line 62)
- [x] Migrate 2 focus box shadows → `color-mix()` with theme colors (lines 111, 126)
- [x] Migrate 4 text color patterns → `var(--theme-text)` or `color-mix()` (lines 81, 146, 151, 156)
- [x] Update high contrast mode block (lines 143-158)
- [x] Verify 20 patterns migrated, 0 intentionally skipped (only #111111 remains as intentional soft black)
- [x] User to run: `npm run type-check` - PASSED
- [x] User to run: `npm run build:renderer` - PASSED
- [x] User to run: `npm run lint` - PASSED (9 pre-existing warnings unrelated to this migration)
- [x] Verify no hardcoded CSS remains with scanner - PASSED (only intentional #111111 for high contrast accessibility)

## Migration Examples

```css
/* Warning color */
--warning-color: #f39c12; /* BEFORE - Remove from :root */
color: var(--warning-color); /* AFTER - Use global variable */

/* Warning background */
--warning-bg: rgba(243, 156, 18, 0.1); /* BEFORE - Remove from :root */
background: color-mix(in srgb, var(--warning-color) 10%, transparent); /* AFTER */

/* Warning border */
--warning-border: rgba(243, 156, 18, 0.3); /* BEFORE - Remove from :root */
border: 1px solid color-mix(in srgb, var(--warning-color) 30%, transparent); /* AFTER */

/* Primary button */
background-color: var(--button-bg); /* BEFORE */
background-color: var(--theme-primary); /* AFTER */

/* Primary button hover */
background-color: var(--button-hover); /* BEFORE */
background-color: var(--theme-primary-hover); /* AFTER */

/* Cancel button */
background-color: var(--cancel-bg); /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

/* Cancel button hover */
background-color: var(--cancel-hover); /* BEFORE */
background-color: var(--surface-muted); /* AFTER */

/* Cancel button border */
border-color: #777; /* BEFORE */
border-color: var(--border-color); /* AFTER */

/* Cancel button hover border */
border-color: #888; /* BEFORE */
border-color: var(--border-color-light); /* AFTER */

/* Drop shadow */
filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1)); /* BEFORE */
filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--theme-background) 10%, black)); /* AFTER */

/* Primary button focus */
box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.5); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 50%, transparent); /* AFTER */

/* Cancel button focus */
box-shadow: 0 0 0 2px rgba(102, 102, 102, 0.5); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--surface-elevated) 50%, transparent); /* AFTER */

/* Detail text with fallback */
color: var(--text-color-secondary, #b0b0b0); /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 65%, transparent); /* AFTER */

/* High contrast text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* High contrast icon background */
color: #000000; /* BEFORE */
color: #111111; /* AFTER - softer black for consistency */
```

## Notes

- This dialog uses standard Material Design colors that align well with the theme system.
- Warning color (`#f39c12`) is close to the global `--warning-color` (`#ff9800`). After migration, it will use the global warning color for consistency.
- High contrast mode uses pure black (`#000000`) which should be softened to `#111111` to match the theme system's contrast calculations.
- Cancel button uses gray shades (`#666`, `#777`) that map well to surface elevation variants.
- All custom `:root` variables should be removed to eliminate fragmentation and use centralized theme variables.
- The dialog inherits styles from `rounded-dialog-template.css` - ensure changes don't conflict with template patterns.
