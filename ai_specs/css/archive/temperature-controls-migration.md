# CSS Migration Spec: temperature-controls.css

**Status:** ✅ COMPLETED (2025-11-28)
**File:** `src/ui/components/temperature-controls/temperature-controls.css`
**Total Patterns:** 11 hardcoded colors
**Priority:** MEDIUM - Temperature control panel component

## Pattern Breakdown

- **RGB/RGBA:** 11 patterns (shadows, insets, overlays)
- **Named colors:** 0 patterns
- **Hex colors:** 0 patterns

## Migration Strategy

### Category 1: Dark Shadow Insets (6 patterns)

Black-based shadows for depth and card styling:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 26 | `rgba(0, 0, 0, 0.2)` | `color-mix(in srgb, var(--theme-background) 20%, black)` | Panel header box-shadow |
| 50 | `rgba(255, 255, 255, 0.03)` | `color-mix(in srgb, var(--theme-text) 3%, transparent)` | Temp card inset highlight |
| 63 | `rgba(255, 255, 255, 0.06)` | `color-mix(in srgb, var(--theme-text) 6%, transparent)` | Temp card hover inset highlight |
| 122 | `rgba(255, 255, 255, 0.15)` | `color-mix(in srgb, var(--theme-text) 15%, transparent)` | Button inset highlight |
| 143 | `rgba(0, 0, 0, 0.3)` | `color-mix(in srgb, var(--theme-background) 30%, black)` | Button active inset shadow |
| 153 | `rgba(0, 0, 0, 0.3)` | `color-mix(in srgb, var(--theme-background) 30%, black)` | Button disabled inset shadow |

**Rationale:** These create subtle depth effects using semi-transparent black/white. Using `color-mix()` ensures they adapt to theme luminance.

### Category 2: Light Overlay Highlights (2 patterns)

White overlay for card hover effects:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 173 | `rgba(255, 255, 255, 0.03)` | `color-mix(in srgb, var(--theme-text) 3%, transparent)` | Fan card inset highlight |
| 181 | `rgba(255, 255, 255, 0.06)` | `color-mix(in srgb, var(--theme-text) 6%, transparent)` | Fan card hover inset highlight |

**Rationale:** Consistent with temp card hover effects, should use same pattern.

### Category 3: Temperature Status Glows (2 patterns)

Colored text-shadow effects for temperature states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 215 | `rgba(255, 152, 0, 0.4)` | `color-mix(in srgb, var(--warning-color) 40%, transparent)` | Heating temperature glow (orange) |
| 220 | `rgba(0, 230, 118, 0.4)` | `color-mix(in srgb, var(--success-color) 40%, transparent)` | At-target temperature glow (green) |

**Rationale:** Status-based glows should reference status color variables for consistency.

### Category 4: Already Migrated (1 pattern - verify only)

The file already uses some theme variables correctly:

| Line | Variable | Status | Notes |
|------|----------|--------|-------|
| 201 | `var(--accent-color)` | ✅ Correct | Fan value background |
| 202 | `var(--accent-color)` | ✅ Correct | Fan value border |
| 209 | `var(--accent-color)` | ✅ Correct | Fan value hover background |
| 210 | `var(--accent-color)` | ✅ Correct | Fan value hover border |

**Note:** `--accent-color` should be `--theme-primary` based on theme system architecture. Add verification task.

## Implementation Checklist

- [x] Migrate 6 dark shadow inset patterns → `color-mix()` with `--theme-background`
- [x] Migrate 2 light overlay patterns → `color-mix()` with `--theme-text`
- [x] Migrate 2 temperature glow patterns → `color-mix()` with status colors
- [x] **VERIFY** `--accent-color` usage (lines 201, 202, 209, 210) - should be `--theme-primary`
- [x] User to run: `npm run type-check`
- [x] User to run: `npm run build:renderer`
- [x] User to run: `npm run lint`
- [x] Verify with `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/components/temperature-controls`

## Migration Details

### Before:
```css
/* Line 26 - Panel header shadow */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

/* Line 50 - Temp card inset highlight */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), var(--shadow-sm);

/* Line 63 - Temp card hover inset highlight */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), var(--shadow-md);

/* Line 122 - Button inset highlight */
box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.15);

/* Line 143 - Button active inset shadow */
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);

/* Line 153 - Button disabled inset shadow */
box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);

/* Line 173 - Fan card inset highlight */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), var(--shadow-sm);

/* Line 181 - Fan card hover inset highlight */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), var(--shadow-md);

/* Line 215 - Heating temperature glow */
text-shadow: 0 0 10px rgba(255, 152, 0, 0.4);

/* Line 220 - At-target temperature glow */
text-shadow: 0 0 10px rgba(0, 230, 118, 0.4);
```

### After:
```css
/* Line 26 - Panel header shadow */
box-shadow: 0 1px 3px color-mix(in srgb, var(--theme-background) 20%, black);

/* Line 50 - Temp card inset highlight */
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text) 3%, transparent), var(--shadow-sm);

/* Line 63 - Temp card hover inset highlight */
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text) 6%, transparent), var(--shadow-md);

/* Line 122 - Button inset highlight */
box-shadow: var(--shadow-sm), inset 0 1px 0 color-mix(in srgb, var(--theme-text) 15%, transparent);

/* Line 143 - Button active inset shadow */
box-shadow: inset 0 2px 4px color-mix(in srgb, var(--theme-background) 30%, black);

/* Line 153 - Button disabled inset shadow */
box-shadow: inset 0 1px 2px color-mix(in srgb, var(--theme-background) 30%, black);

/* Line 173 - Fan card inset highlight */
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text) 3%, transparent), var(--shadow-sm);

/* Line 181 - Fan card hover inset highlight */
box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text) 6%, transparent), var(--shadow-md);

/* Line 215 - Heating temperature glow */
text-shadow: 0 0 10px color-mix(in srgb, var(--warning-color) 40%, transparent);

/* Line 220 - At-target temperature glow */
text-shadow: 0 0 10px color-mix(in srgb, var(--success-color) 40%, transparent);
```

## Additional Cleanup Task

**Variable Name Correction:**
The file uses `--accent-color` which is not defined in the theme system. Based on context (primary action highlighting), this should be `--theme-primary`:

### Before:
```css
/* Lines 201-202, 209-210 */
background: color-mix(in srgb, var(--accent-color) 12%, transparent);
border: 1px solid color-mix(in srgb, var(--accent-color) 25%, transparent);
```

### After:
```css
background: color-mix(in srgb, var(--theme-primary) 12%, transparent);
border: 1px solid color-mix(in srgb, var(--theme-primary) 25%, transparent);
```

**Affected Lines:** 201, 202, 209, 210

## Expected Result

After migration:
- ✅ **11 RGBA patterns migrated** to `color-mix()`
- ✅ **4 variable corrections** (`--accent-color` → `--theme-primary`)
- ✅ All shadows/glows adapt to theme
- ✅ Temperature status glows use proper status colors

## Notes

- **Component Purpose:** Temperature control panel for extruder/bed temperature management
- **Visual Effects:** Extensive use of subtle shadows and insets for modern card-based design
- **Status Glows:** Orange glow when heating, green glow when at target temperature
- **Light Highlights:** White insets (`rgba(255, 255, 255, X)`) should use `--theme-text` so they adapt to theme
- **Dark Shadows:** Black-based shadows should use `--theme-background` for proper luminance-aware darkening
- **Fan Display:** Uses accent color (should be `--theme-primary`) to highlight fan speed values

## Common Patterns Reference

```css
/* Dark shadows (black-based) */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); /* BEFORE */
box-shadow: 0 1px 3px color-mix(in srgb, var(--theme-background) 20%, black); /* AFTER */

/* Light inset highlights (white-based) */
inset 0 1px 0 rgba(255, 255, 255, 0.03) /* BEFORE */
inset 0 1px 0 color-mix(in srgb, var(--theme-text) 3%, transparent) /* AFTER */

/* Status glows */
text-shadow: 0 0 10px rgba(255, 152, 0, 0.4); /* BEFORE - orange */
text-shadow: 0 0 10px color-mix(in srgb, var(--warning-color) 40%, transparent); /* AFTER */

text-shadow: 0 0 10px rgba(0, 230, 118, 0.4); /* BEFORE - green */
text-shadow: 0 0 10px color-mix(in srgb, var(--success-color) 40%, transparent); /* AFTER */

/* Accent color usage */
var(--accent-color) /* BEFORE - undefined variable */
var(--theme-primary) /* AFTER - proper theme variable */
```

## Testing Notes

When verifying this migration:
1. Check temperature card shadows render correctly
2. Check hover effects work (subtle highlight increase)
3. Verify button shadows (normal, hover, active, disabled states)
4. Test heating glow (orange) when temperatures are rising
5. Test at-target glow (green) when temperatures stabilize
6. Verify fan speed value highlighting
7. Test with both light and dark themes to ensure shadows/glows are visible
8. Check that all effects maintain depth perception across themes
