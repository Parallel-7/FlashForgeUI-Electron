# CSS Migration Spec: spoolman-offline-dialog.css

**Status:** 🔄 PENDING
**File:** `src/ui/spoolman-offline-dialog/spoolman-offline-dialog.css`
**Total Patterns:** 18 (17 migrated, 1 intentional kept)
**Priority:** HIGH - Spoolman offline warning dialog

## Pattern Breakdown

- **Hex colors:** 13 patterns
- **RGB/RGBA:** 4 patterns
- **Named colors:** 1 pattern (`transparent` to keep)

## IMPORTANT: Intentional Pattern (KEEP AS-IS)

| Line | Current | Action | Context |
|------|---------|--------|---------|
| 120 | `transparent` | **KEEP AS-IS** | Intentional transparent background for secondary button |

## Migration Strategy

### Category 1: Warning Colors (3 patterns)

Orange warning accent colors for icon and states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 4 | `#f97316` | `var(--warning-color)` | Warning color variable definition |
| 5 | `rgba(249, 115, 22, 0.15)` | `color-mix(in srgb, var(--warning-color) 15%, transparent)` | Warning background |
| 6 | `rgba(249, 115, 22, 0.35)` | `color-mix(in srgb, var(--warning-color) 35%, transparent)` | Warning border |

**Note:** Line 4 defines `:root --warning-color` which should be removed entirely since `--warning-color` is defined in `index.css` as `#ff9800`. The dialog should use the global `var(--warning-color)` directly.

### Category 2: Primary Button Colors (2 patterns)

Sky blue primary action button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 7 | `#38bdf8` | `var(--theme-primary)` | Primary button background |
| 8 | `#0ea5e9` | `var(--theme-primary-hover)` | Primary button hover |

### Category 3: White Text (2 patterns)

White text for primary messages:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 64 | `#fff` | `var(--theme-text)` | Primary message text |
| 69 | `#cbd5f5` | `color-mix(in srgb, var(--theme-text) 80%, transparent)` | Detail message text (light blue-ish tint) |

### Category 4: Status Message Colors (3 patterns)

Status indicator text colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 77 | `#cbd5f5` | `color-mix(in srgb, var(--theme-text) 80%, transparent)` | Default status message text |
| 82 | `#fb7185` | `var(--error-color)` | Error status text |
| 86 | `#4ade80` | `var(--success-color)` | Success status text |

### Category 5: Secondary Button Borders (2 patterns)

Semi-transparent white borders for secondary button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 121 | `rgba(255, 255, 255, 0.3)` | `var(--border-color)` | Secondary button border |
| 126 | `rgba(255, 255, 255, 0.55)` | `var(--border-color-focus)` | Secondary button hover border |

### Category 6: Secondary Button Text (1 pattern)

Light gray text for cancel/secondary button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 122 | `#e5e7eb` | `var(--theme-text)` | Secondary button text |

## Special Considerations

### Root Variable Cleanup

The `:root` block (lines 3-9) defines custom variables that should be removed:

```css
/* BEFORE */
:root {
  --warning-color: #f97316;
  --warning-bg: rgba(249, 115, 22, 0.15);
  --warning-border: rgba(249, 115, 22, 0.35);
  --primary-button: #38bdf8;
  --primary-button-hover: #0ea5e9;
}

/* AFTER - Remove entire block */
/* All colors now use global theme variables */
```

**Action:** Remove the entire `:root` block and update usages:
- `var(--warning-color)` → Keep (it's now from global theme)
- `var(--warning-bg)` → `color-mix(in srgb, var(--warning-color) 15%, transparent)`
- `var(--warning-border)` → `color-mix(in srgb, var(--warning-color) 35%, transparent)`
- `var(--primary-button)` → `var(--theme-primary)`
- `var(--primary-button-hover)` → `var(--theme-primary-hover)`

### Warning Icon Styling

The warning icon (lines 40-50) already uses `var(--warning-bg)` and `var(--warning-border)`. After migration, update to:

```css
/* BEFORE */
.warning-icon {
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  color: var(--warning-color);
}

/* AFTER */
.warning-icon {
  background: color-mix(in srgb, var(--warning-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-color) 35%, transparent);
  color: var(--warning-color);
}
```

### Button Styling

Primary button (lines 104-112) uses custom variables:

```css
/* BEFORE */
.dialog-button.primary {
  background-color: var(--primary-button);
  border-color: var(--primary-button);
}
.dialog-button.primary:hover:not(:disabled) {
  background-color: var(--primary-button-hover);
  border-color: var(--primary-button-hover);
}

/* AFTER */
.dialog-button.primary {
  background-color: var(--theme-primary);
  border-color: var(--theme-primary);
}
.dialog-button.primary:hover:not(:disabled) {
  background-color: var(--theme-primary-hover);
  border-color: var(--theme-primary-hover);
}
```

## Implementation Checklist

- [ ] Remove entire `:root` block (lines 3-9)
- [ ] Update `.warning-icon` to use `color-mix()` for background/border (line 44-45)
- [ ] Migrate 2 primary button patterns → `--theme-primary` / `--theme-primary-hover` (lines 105-106, 110-111)
- [ ] Migrate 2 white text patterns → `var(--theme-text)` (line 64) and `color-mix()` (line 69, 77)
- [ ] Migrate 2 status colors → `var(--error-color)` (line 82), `var(--success-color)` (line 86)
- [ ] Migrate 2 secondary button border patterns → `var(--border-color)` and `var(--border-color-focus)` (lines 121, 126)
- [ ] Migrate 1 secondary button text → `var(--theme-text)` (line 122)
- [ ] **KEEP** `transparent` (line 120) - intentional
- [ ] Verify 17 patterns migrated, 1 intentionally skipped
- [ ] User to run: `npm run type-check`
- [ ] User to run: `npm run build:renderer`
- [ ] User to run: `npm run lint`
- [ ] Verify no hardcoded CSS remains with scanner

## Migration Examples

```css
/* Warning icon background */
background: var(--warning-bg); /* BEFORE */
background: color-mix(in srgb, var(--warning-color) 15%, transparent); /* AFTER */

/* Warning icon border */
border: 1px solid var(--warning-border); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--warning-color) 35%, transparent); /* AFTER */

/* Primary button */
background-color: var(--primary-button); /* BEFORE */
background-color: var(--theme-primary); /* AFTER */

/* Primary button hover */
background-color: var(--primary-button-hover); /* BEFORE */
background-color: var(--theme-primary-hover); /* AFTER */

/* White text */
color: #fff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted light text */
color: #cbd5f5; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 80%, transparent); /* AFTER */

/* Error status */
color: #fb7185; /* BEFORE */
color: var(--error-color); /* AFTER */

/* Success status */
color: #4ade80; /* BEFORE */
color: var(--success-color); /* AFTER */

/* Secondary button border */
border-color: rgba(255, 255, 255, 0.3); /* BEFORE */
border-color: var(--border-color); /* AFTER */

/* Secondary button hover border */
border-color: rgba(255, 255, 255, 0.55); /* BEFORE */
border-color: var(--border-color-focus); /* AFTER */

/* Secondary button text */
color: #e5e7eb; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Keep as-is */
background-color: transparent; /* BEFORE & AFTER - intentional */
```

## Notes

- This dialog uses a sky blue (`#38bdf8`) primary button instead of the standard Material Design blue (`#4285f4`). After migration, it will adopt the user's theme primary color.
- Warning color uses orange (`#f97316`) which is close to but not identical to the global `--warning-color` (`#ff9800`). After migration, it will use the global warning color for consistency.
- Status colors (error `#fb7185`, success `#4ade80`) are softer pastel variants. After migration, they'll use the standard Material Design status colors for consistency (`--error-color: #f44336`, `--success-color: #00e676`).
- Secondary button uses semi-transparent white borders that should map to standard border variables for theme consistency.
- Light blue-tinted text (`#cbd5f5`) is treated as muted text with 80% opacity to maintain the subtle appearance.
