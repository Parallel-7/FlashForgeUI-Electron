# CSS Migration Spec: job-uploader.css

**File:** `src/ui/job-uploader/job-uploader.css`
**Total Patterns:** 39
**Priority:** HIGH - Core job upload workflow
**Estimated Time:** 30-40 minutes

## Pattern Breakdown

- **Hex colors:** 33 patterns
- **RGB/RGBA:** 5 patterns
- **Named colors:** 1 pattern (`white`)

## Migration Strategy

### Category 1: Dark Backgrounds & Surfaces (13 patterns)

These are various dark gray backgrounds that should use theme-aware surface variables:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 24 | `#353535` | `var(--surface-elevated)` | Main container background |
| 72 | `#353535` | `var(--surface-elevated)` | Drop zone background |
| 319 | `#2a2a2a` | `var(--surface-muted)` | Upload progress container |
| 350 | `#1e1e1e` | `var(--theme-surface)` | File list background |
| 292 | `rgba(58, 58, 58, 0.9)` | `color-mix(in srgb, var(--surface-elevated) 90%, transparent)` | Overlay background |
| 310 | `rgba(58, 58, 58, 0.95)` | `color-mix(in srgb, var(--surface-elevated) 95%, transparent)` | Upload status overlay |

### Category 2: Gray Borders (17 patterns)

Multiple `#555`, `#666`, `#777`, `#888` borders should use theme border variables:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 25, 32, 73, 106, 160, 170, 196, 320, 351 | `#555` | `var(--border-color)` | Standard borders (9 occurrences) |
| 126 | `#555` | `var(--border-color)` | File item border-bottom |
| 270 | `#666` | `var(--border-color-light)` | Disabled button border |
| 277 | `#777` | `var(--border-color-light)` | Active button border |
| 282 | `#888` | `var(--border-color-focus)` | Selected button border |

### Category 3: White Text (10 patterns)

White text colors should use theme text variables:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 36 | `#ffffff` | `var(--theme-text)` | Header text |
| 50 | `white` | `var(--theme-text)` | Drop zone text |
| 83 | `#ffffff` | `var(--theme-text)` | Button text |
| 127 | `#ffffff` | `var(--theme-text)` | File name text |
| 147 | `#ffffff` | `var(--theme-text)` | Action text |
| 226 | `#ffffff` | `var(--theme-text)` | Status text |
| 252 | `#ffffff` | `var(--theme-text)` | Result text |
| 298 | `#ffffff` | `var(--theme-text)` | Progress text |
| 338 | `#ffffff` | `var(--theme-text)` | Modal header text |

### Category 4: Muted/Gray Text (5 patterns)

Light gray text for secondary information:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 141 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | File size text |
| 185 | `#888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Hint text |
| 219 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Upload status label |
| 245 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Error details text |
| 367 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Empty state text |

### Category 5: Button State Backgrounds (3 patterns)

Gray backgrounds for button states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 269 | `#555` | `var(--surface-elevated)` | Disabled button background |
| 276 | `#666` | `var(--surface-muted)` | Active button background |
| 281 | `#777` | `var(--theme-primary)` | Selected button background |

### Category 6: Primary Color Accents (2 patterns)

Blue primary color for upload zone highlights:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 233 | `rgba(66, 133, 244, 0.1)` | `color-mix(in srgb, var(--theme-primary) 10%, transparent)` | Active drop zone background |
| 234 | `rgba(66, 133, 244, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Active drop zone border |

### Category 7: Shadows (1 pattern)

Dark shadow for modal overlay:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 325 | `rgba(0, 0, 0, 0.5)` | `var(--shadow-lg)` | Upload modal shadow |

## Implementation Checklist

- [ ] Migrate 13 dark background patterns → surface variables
- [ ] Migrate 17 gray border patterns → border variables
- [ ] Migrate 10 white text patterns → `var(--theme-text)`
- [ ] Migrate 5 muted text patterns → `color-mix()` with opacity
- [ ] Migrate 3 button state backgrounds → surface/primary variables
- [ ] Migrate 2 primary color accents → `color-mix()` with `--theme-primary`
- [ ] Migrate 1 shadow → `var(--shadow-lg)`
- [ ] Verify all 39 patterns migrated
- [ ] Test with light theme
- [ ] Test with dark theme

## Expected Outcome

After migration:
- **Before:** 39 hardcoded patterns
- **After:** 0 hardcoded patterns
- All colors adapt to user-selected theme
- Light/dark themes work correctly
- Button states have proper visual feedback
- Upload states clearly visible across themes

## Common Patterns Reference

```css
/* Dark backgrounds */
background: #353535; /* BEFORE */
background: var(--surface-elevated); /* AFTER */

/* Borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (70% opacity) */
color: #cccccc; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 70%, transparent); /* AFTER */

/* Primary accent with transparency */
background: rgba(66, 133, 244, 0.1); /* BEFORE */
background: color-mix(in srgb, var(--theme-primary) 10%, transparent); /* AFTER */
```

## Notes

- The file uses a lot of gray shades (`#555`, `#666`, `#777`, `#888`) for borders - these create a visual hierarchy that should be preserved using different border variables
- Button states (disabled/active/selected) need distinct backgrounds while staying theme-aware
- Drop zone active state uses primary color - this should remain visually prominent
- Modal overlays use semi-transparent backgrounds - these should adapt to theme surface colors
