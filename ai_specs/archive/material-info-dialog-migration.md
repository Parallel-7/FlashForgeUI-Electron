# CSS Migration Spec: material-info-dialog.css

**File:** `src/ui/material-info-dialog/material-info-dialog.css`
**Total Patterns:** 23
**Priority:** HIGH - Material information display dialog
**Estimated Time:** 20-25 minutes

## Pattern Breakdown

- **Hex colors:** 9 patterns
- **RGB/RGBA:** 14 patterns
- **Named colors:** 0 patterns

## Migration Strategy

### Category 1: White Text (2 patterns)

White text for labels:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 26 | `#ffffff` | `var(--theme-text)` | Material name |
| 149 | `#ffffff` | `var(--theme-text)` | Info label |

### Category 2: Light Gray Text (3 patterns)

Muted text for secondary info:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 36 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Vendor text |
| 155 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Info value |
| 166 | `#aaaaaa` | `color-mix(in srgb, var(--theme-text) 60%, transparent)` | Empty state text |

### Category 3: Gray Borders (4 patterns)

Standard `#555` borders:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 59 | `#555` | `var(--border-color)` | Material card border |
| 159 | `#555` | `var(--border-color)` | Info grid border |
| 170 | `#555` | `var(--border-color)` | Divider border |

### Category 4: Dark Backgrounds (1 pattern)

Dark gray background:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 158 | `#2a2a2a` | `var(--surface-muted)` | Info grid background |

### Category 5: Light/White Overlays (7 patterns)

Semi-transparent white for highlights and borders:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 42 | `rgba(255, 255, 255, 0.05)` | `color-mix(in srgb, var(--theme-text) 5%, transparent)` | Material card background |
| 43 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Material card border |
| 87 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Spool preview border |
| 99 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Hover border |
| 110 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Empty spool border |
| 114 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Empty spool hover |
| 133 | `rgba(255, 255, 255, 0.05)` | `color-mix(in srgb, var(--theme-text) 5%, transparent)` | Info row hover |

### Category 6: Dark Shadows (4 patterns)

Black shadows for depth:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 94 | `inset 0 4px 8px rgba(0, 0, 0, 0.3)` | `inset 0 4px 8px color-mix(in srgb, var(--theme-background) 30%, black)` | Spool inset shadow |
| 95 | `0 2px 4px rgba(0, 0, 0, 0.2)` | `var(--shadow-sm)` | Spool outer shadow |
| 101 | `inset 0 4px 8px rgba(0, 0, 0, 0.4)` | `inset 0 4px 8px color-mix(in srgb, var(--theme-background) 40%, black)` | Hover inset shadow |
| 102 | `0 4px 8px rgba(0, 0, 0, 0.3)` | `var(--shadow-md)` | Hover outer shadow |

### Category 7: Dark Overlay Background (1 pattern)

Black overlay for empty state:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 109 | `rgba(0, 0, 0, 0.3)` | `color-mix(in srgb, var(--theme-background) 30%, black)` | Empty spool background |

### Category 8: Primary/Accent Colors (2 patterns)

Indigo primary accents:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 71 | `rgba(92, 107, 192, 0.2)` | `color-mix(in srgb, var(--theme-primary) 20%, transparent)` | Selected card glow |
| 141 | `rgba(92, 107, 192, 0.2)` | `color-mix(in srgb, var(--theme-primary) 20%, transparent)` | Primary info row |

## Implementation Checklist

- [ ] Migrate 2 white text patterns → `var(--theme-text)`
- [ ] Migrate 3 light gray text patterns → `color-mix()` with opacity
- [ ] Migrate 4 gray border patterns → `var(--border-color)`
- [ ] Migrate 1 dark background → `var(--surface-muted)`
- [ ] Migrate 7 light overlay patterns → `color-mix()` with `--theme-text`
- [ ] Migrate 4 dark shadow patterns → shadow variables or `color-mix()`
- [ ] Migrate 1 dark overlay → `color-mix()` with `--theme-background`
- [ ] Migrate 2 primary accent patterns → `color-mix()` with `--theme-primary`
- [ ] Verify all 23 patterns migrated
- [ ] Test with light theme
- [ ] Test with dark theme
- [ ] Verify spool preview displays correctly
- [ ] Test info grid hover states

## Expected Outcome

After migration:
- **Before:** 23 hardcoded patterns
- **After:** 0 hardcoded patterns
- All colors adapt to user-selected theme
- Indigo accent maps to `--theme-primary`
- Spool preview has proper visual depth
- Info grid hover states work across themes
- Light/dark themes work correctly

## Common Patterns Reference

```css
/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (60-70% opacity) */
color: #cccccc; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 70%, transparent); /* AFTER */

/* Gray borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Dark backgrounds */
background-color: #2a2a2a; /* BEFORE */
background-color: var(--surface-muted); /* AFTER */

/* Light overlays */
background-color: rgba(255, 255, 255, 0.05); /* BEFORE */
background-color: color-mix(in srgb, var(--theme-text) 5%, transparent); /* AFTER */

border: 1px solid rgba(255, 255, 255, 0.1); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent); /* AFTER */

/* Dark shadows */
0 2px 4px rgba(0, 0, 0, 0.2); /* BEFORE */
var(--shadow-sm); /* AFTER */

inset 0 4px 8px rgba(0, 0, 0, 0.3); /* BEFORE */
inset 0 4px 8px color-mix(in srgb, var(--theme-background) 30%, black); /* AFTER */

/* Dark overlay */
background-color: rgba(0, 0, 0, 0.3); /* BEFORE */
background-color: color-mix(in srgb, var(--theme-background) 30%, black); /* AFTER */

/* Primary accent */
box-shadow: 0 4px 12px rgba(92, 107, 192, 0.2); /* BEFORE */
box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 20%, transparent); /* AFTER */
```

## Notes

- Similar to IFS dialog, uses indigo accent (`rgba(92, 107, 192, ...)`) which should map to `--theme-primary`
- Spool preview uses layered shadows (inset + outer) - preserve this visual depth
- Info grid has subtle hover effects with light overlays - maintain this polish
- Empty spool state has distinct styling from filled state
- Material card has very subtle background overlay (5%) - preserve this subtlety
