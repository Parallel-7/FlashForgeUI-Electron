# CSS Migration Spec: material-matching-dialog.css

**File:** `src/ui/material-matching-dialog/material-matching-dialog.css`
**Total Patterns:** 25
**Priority:** HIGH - Material palette matching dialog
**Estimated Time:** 20-25 minutes

## Pattern Breakdown

- **Hex colors:** 13 patterns
- **RGB/RGBA:** 12 patterns
- **Named colors:** 0 patterns

## Migration Strategy

### Category 1: White Text (3 patterns)

White text for labels and headers:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 45 | `#ffffff` | `var(--theme-text)` | Material slot label |
| 81 | `#ffffff` | `var(--theme-text)` | Match header text |
| 152 | `#ffffff` | `var(--theme-text)` | Palette slot label |

### Category 2: Light Gray Text (5 patterns)

Muted text for secondary info:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 96 | `#b0b0b0` | `color-mix(in srgb, var(--theme-text) 65%, transparent)` | Material info |
| 158 | `#b0b0b0` | `color-mix(in srgb, var(--theme-text) 65%, transparent)` | Palette info |
| 163 | `#808080` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Weight text |
| 186 | `#c0c0c0` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Match type label |
| 282 | `#888888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Empty state text |

### Category 3: Success/Green Accents (4 patterns)

Green success color for matched states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 69 | `rgba(0, 255, 110, 0.3)` | `color-mix(in srgb, var(--success-color) 30%, transparent)` | Matched slot glow |
| 125 | `rgba(0, 255, 110, 0.1)` | `color-mix(in srgb, var(--success-color) 10%, transparent)` | Match badge background |
| 175 | `rgba(0, 255, 110, 0.05)` | `color-mix(in srgb, var(--success-color) 5%, transparent)` | Exact match background |
| 176 | `rgba(0, 255, 110, 0.3)` | `color-mix(in srgb, var(--success-color) 30%, transparent)` | Exact match border |

### Category 4: Warning/Yellow Accents (4 patterns)

Yellow warning color for close matches:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 195 | `rgba(255, 200, 0, 0.05)` | `color-mix(in srgb, var(--warning-color) 5%, transparent)` | Close match background |
| 196 | `rgba(255, 200, 0, 0.3)` | `color-mix(in srgb, var(--warning-color) 30%, transparent)` | Close match border |
| 245 | `rgba(255, 200, 0, 0.1)` | `color-mix(in srgb, var(--warning-color) 10%, transparent)` | Warning badge background |
| 246 | `rgba(255, 200, 0, 0.3)` | `color-mix(in srgb, var(--warning-color) 30%, transparent)` | Warning badge border |

### Category 5: Error/Red Accents (2 patterns)

Red error color for no match:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 239 | `rgba(255, 68, 68, 0.1)` | `color-mix(in srgb, var(--error-color) 10%, transparent)` | No match badge background |
| 240 | `rgba(255, 68, 68, 0.3)` | `color-mix(in srgb, var(--error-color) 30%, transparent)` | No match badge border |

### Category 6: Light/White Overlays (2 patterns)

Semi-transparent white borders:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 88 | `rgba(255, 255, 255, 0.3)` | `color-mix(in srgb, var(--theme-text) 30%, transparent)` | Material slot border |
| 142 | `rgba(255, 255, 255, 0.3)` | `color-mix(in srgb, var(--theme-text) 30%, transparent)` | Palette slot border |

### Category 7: Disabled Button States (5 patterns)

Gray colors for disabled buttons:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 262 | `#555` | `var(--surface-elevated)` | Disabled background |
| 263 | `#666` | `var(--border-color-light)` | Disabled border |
| 264 | `#999` | `color-mix(in srgb, var(--theme-text) 40%, transparent)` | Disabled text |
| 270 | `#666` | `var(--surface-muted)` | Disabled hover background |
| 271 | `#777` | `var(--border-color)` | Disabled hover border |

## Implementation Checklist

- [ ] Migrate 3 white text patterns → `var(--theme-text)`
- [ ] Migrate 5 light gray text patterns → `color-mix()` with opacity
- [ ] Migrate 4 success/green patterns → `color-mix()` with `var(--success-color)`
- [ ] Migrate 4 warning/yellow patterns → `color-mix()` with `var(--warning-color)`
- [ ] Migrate 2 error/red patterns → `color-mix()` with `var(--error-color)`
- [ ] Migrate 2 white overlay patterns → `color-mix()` with `--theme-text`
- [ ] Migrate 5 disabled button patterns → surface/border variables
- [ ] Verify all 25 patterns migrated
- [ ] Test with light theme
- [ ] Test with dark theme
- [ ] Verify match badges (exact/close/none) display correctly
- [ ] Test disabled state styling

## Expected Outcome

After migration:
- **Before:** 25 hardcoded patterns
- **After:** 0 hardcoded patterns
- All colors adapt to user-selected theme
- Match quality badges (green/yellow/red) use semantic status colors
- Disabled states clearly visible across themes
- Light/dark themes work correctly

## Common Patterns Reference

```css
/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (50-70% opacity) */
color: #b0b0b0; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 65%, transparent); /* AFTER */

/* Success accent (green) */
box-shadow: 0 0 12px rgba(0, 255, 110, 0.3); /* BEFORE */
box-shadow: 0 0 12px color-mix(in srgb, var(--success-color) 30%, transparent); /* AFTER */

background-color: rgba(0, 255, 110, 0.1); /* BEFORE */
background-color: color-mix(in srgb, var(--success-color) 10%, transparent); /* AFTER */

/* Warning accent (yellow) */
background-color: rgba(255, 200, 0, 0.05); /* BEFORE */
background-color: color-mix(in srgb, var(--warning-color) 5%, transparent); /* AFTER */

border-color: rgba(255, 200, 0, 0.3); /* BEFORE */
border-color: color-mix(in srgb, var(--warning-color) 30%, transparent); /* AFTER */

/* Error accent (red) */
background-color: rgba(255, 68, 68, 0.1); /* BEFORE */
background-color: color-mix(in srgb, var(--error-color) 10%, transparent); /* AFTER */

/* Light overlay borders */
border: 2px solid rgba(255, 255, 255, 0.3); /* BEFORE */
border: 2px solid color-mix(in srgb, var(--theme-text) 30%, transparent); /* AFTER */

/* Disabled button */
background-color: #555; /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

color: #999; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 40%, transparent); /* AFTER */
```

## Notes

- This dialog uses semantic status colors (green/yellow/red) to indicate match quality - these should map to `--success-color`, `--warning-color`, and `--error-color`
- Match quality badges have distinct visual hierarchy:
  - **Exact match**: Green with 5% background, 30% border
  - **Close match**: Yellow with 5% background, 30% border
  - **No match**: Red with 10% background, 30% border
- Disabled button states need clear visual feedback across themes
- Material slots use semi-transparent white borders - these should adapt to theme text color
- All match status colors should remain consistent with the overall status color system
