# CSS Migration Spec: settings.css

**Status:** ✅ COMPLETED
**File:** `src/ui/settings/settings.css`
**Total Patterns:** 10 (3 migrated, 7 intentional kept)
**Priority:** HIGH - Settings dialog (critical UI component)

## Pattern Breakdown

- **Hex colors:** 7 patterns
- **RGB/RGBA:** 3 patterns
- **Named colors:** 0 patterns (all to migrate)

## Migration Strategy

### Category 1: Hue Slider Gradient (7 patterns)

HSL color wheel gradient in color picker (lines 601-608):

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 602 | `#ff0000` (0%) | Keep as-is | Red hue stop (0°) |
| 603 | `#ffff00` (17%) | Keep as-is | Yellow hue stop (60°) |
| 604 | `#00ff00` (33%) | Keep as-is | Green hue stop (120°) |
| 605 | `#00ffff` (50%) | Keep as-is | Cyan hue stop (180°) |
| 606 | `#0000ff` (67%) | Keep as-is | Blue hue stop (240°) |
| 607 | `#ff00ff` (83%) | Keep as-is | Magenta hue stop (300°) |
| 608 | `#ff0000` (100%) | Keep as-is | Red hue stop (360°) |

**Special Note:** These 7 patterns represent the HSL color wheel gradient and should be **KEPT AS-IS**. They are fundamental color wheel stops and not theming colors.

### Category 2: Box Shadow Colors (3 patterns)

Shadow colors for elevation and depth:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 302 | `rgba(0, 0, 0, 0.2)` | `var(--shadow-md)` | Theme card hover shadow |
| 493 | `rgba(0, 0, 0, 0.65)` | `var(--shadow-lg)` | Color picker modal shadow (large/heavy) |
| 621 | `rgba(0, 0, 0, 0.35)` | `var(--shadow-sm)` | Hue slider thumb shadow |

**Note:** The shadow opacities vary (0.2, 0.35, 0.65) indicating different elevation levels. Map to appropriate shadow variables if they exist, otherwise use `color-mix()`.

**Check `index.css` for available shadow variables:**
- If `--shadow-sm`, `--shadow-md`, `--shadow-lg` exist, use them
- Otherwise, use `color-mix(in srgb, var(--theme-background) XX%, black)` with appropriate percentages

## Special Considerations

### Hue Slider Gradient (KEEP AS-IS)

The `#color-picker-hue` slider (lines 597-632) uses a linear gradient representing the full HSL color spectrum. These are **pure color stops** and should **NOT** be migrated:

```css
/* KEEP AS-IS - This is a color wheel, not a theme color */
#color-picker-hue {
    background: linear-gradient(to right,
            #ff0000 0%,    /* Red (0°) */
            #ffff00 17%,   /* Yellow (60°) */
            #00ff00 33%,   /* Green (120°) */
            #00ffff 50%,   /* Cyan (180°) */
            #0000ff 67%,   /* Blue (240°) */
            #ff00ff 83%,   /* Magenta (300°) */
            #ff0000 100%); /* Red (360°) */
}
```

**Rationale:** This gradient represents the fundamental HSL hue spectrum (0-360°). Changing these colors would break the color picker's ability to select accurate hues. These are **mathematical color constants**, not theme-dependent UI colors.

### Box Shadow Patterns

**Line 302 - Theme Card Hover Shadow:**
```css
/* BEFORE */
.theme-profile-card:hover {
    box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.2));
}

/* AFTER - Option 1 (if --shadow-md exists) */
.theme-profile-card:hover {
    box-shadow: var(--shadow-md);
}

/* AFTER - Option 2 (if no shadow variable) */
.theme-profile-card:hover {
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-background) 20%, black);
}
```

**Line 493 - Color Picker Modal Shadow:**
```css
/* BEFORE */
.color-picker-dialog {
    box-shadow: 0 18px 60px var(--shadow-color, rgba(0, 0, 0, 0.65));
}

/* AFTER - Option 1 (if --shadow-lg exists) */
.color-picker-dialog {
    box-shadow: var(--shadow-lg);
}

/* AFTER - Option 2 (if no shadow variable) */
.color-picker-dialog {
    box-shadow: 0 18px 60px color-mix(in srgb, var(--theme-background) 65%, black);
}
```

**Line 621 - Hue Slider Thumb Shadow:**
```css
/* BEFORE */
#color-picker-hue::-webkit-slider-thumb {
    box-shadow: 0 2px 6px var(--shadow-color, rgba(0, 0, 0, 0.35));
}

#color-picker-hue::-moz-range-thumb {
    box-shadow: 0 2px 6px var(--shadow-color, rgba(0, 0, 0, 0.35));
}

/* AFTER - Option 1 (if --shadow-sm exists) */
#color-picker-hue::-webkit-slider-thumb {
    box-shadow: var(--shadow-sm);
}

#color-picker-hue::-moz-range-thumb {
    box-shadow: var(--shadow-sm);
}

/* AFTER - Option 2 (if no shadow variable) */
#color-picker-hue::-webkit-slider-thumb {
    box-shadow: 0 2px 6px color-mix(in srgb, var(--theme-background) 35%, black);
}

#color-picker-hue::-moz-range-thumb {
    box-shadow: 0 2px 6px color-mix(in srgb, var(--theme-background) 35%, black);
}
```

### Existing Theme Variable Usage

This file already uses many theme variables correctly:

**Good Examples (already migrated):**
- Line 13-26: Uses `var(--theme-surface)`, `var(--theme-background)`, `var(--surface-muted)`, etc.
- Line 42: `background: var(--surface-muted, rgba(255, 255, 255, 0.05))`
- Line 69: `background: var(--theme-primary-hover)`
- Line 158: `accent-color: var(--button-bg)`
- Line 208: `background: var(--surface-elevated)`
- Line 432: `background-color: color-mix(in srgb, var(--error-color) 10%, transparent)`

**Only 3 shadow patterns need migration** (all others already use theme variables).

## Implementation Checklist

- [x] **VERIFY** if `--shadow-sm`, `--shadow-md`, `--shadow-lg` exist in `index.css` - Found but with different opacities, used `color-mix()` instead
- [x] Migrate 3 box shadow patterns → `color-mix()` (lines 302, 493, 621/631)
- [x] **DO NOT MIGRATE** hue slider gradient (lines 601-608) - intentional color wheel (PRESERVED)
- [x] Verify only 3 patterns migrated, 7 color wheel stops preserved - ✅ Confirmed
- [ ] User to run: `npm run type-check`
- [ ] User to run: `npm run build:renderer`
- [ ] User to run: `npm run lint`
- [x] Verify no hardcoded CSS remains with scanner (excluding color wheel gradient) - ✅ Only intentional patterns remain

## Migration Examples

```css
/* Theme card hover shadow */
box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.2)); /* BEFORE */
box-shadow: var(--shadow-md); /* AFTER (if variable exists) */
box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-background) 20%, black); /* AFTER (fallback) */

/* Color picker modal shadow */
box-shadow: 0 18px 60px var(--shadow-color, rgba(0, 0, 0, 0.65)); /* BEFORE */
box-shadow: var(--shadow-lg); /* AFTER (if variable exists) */
box-shadow: 0 18px 60px color-mix(in srgb, var(--theme-background) 65%, black); /* AFTER (fallback) */

/* Hue slider thumb shadow */
box-shadow: 0 2px 6px var(--shadow-color, rgba(0, 0, 0, 0.35)); /* BEFORE */
box-shadow: var(--shadow-sm); /* AFTER (if variable exists) */
box-shadow: 0 2px 6px color-mix(in srgb, var(--theme-background) 35%, black); /* AFTER (fallback) */

/* Hue slider gradient - DO NOT CHANGE */
background: linear-gradient(to right,
        #ff0000 0%, #ffff00 17%, #00ff00 33%,
        #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
/* KEEP AS-IS - This is the HSL color wheel spectrum */
```

## Notes

- **CRITICAL:** This file is mostly already migrated to theme variables. Only 3 shadow patterns need updating.
- **CRITICAL:** The hue slider gradient (7 hex color patterns) represents the HSL color wheel and must be preserved. These are mathematical color constants, not theme colors.
- The file demonstrates excellent theme variable usage throughout - use as a reference for other migrations.
- Lines 11-27 define fallback variables using theme variables with defaults - this pattern is good and should be preserved.
- Color picker functionality depends on the pure hue gradient - do not modify it under any circumstances.
- Check `index.css` for shadow variable definitions before choosing migration approach.
- This is a low-priority migration since most colors are already using theme variables correctly.
