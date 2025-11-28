# CSS Migration Spec: gridstack.css

**Status:** 🔴 NOT STARTED
**File:** `src/ui/gridstack/gridstack.css`
**Total Patterns:** 1 pattern (needs verification, likely intentional)
**Priority:** MEDIUM - GridStack dashboard styling for main window
**Impact:** Affects the main dashboard grid layout edit mode visual feedback

## Pattern Breakdown

- **Hex colors:** 0 patterns
- **RGB/RGBA:** 1 pattern
- **Named colors:** 0 patterns

## Context: Warning Color Box Shadow

This file contains a single hardcoded color pattern that appears to be intentional but should be verified:

### Category 1: Warning Color Glow for Locked Items (1 pattern)

Box shadow for locked grid items in edit mode to indicate they cannot be moved:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 360 | `rgba(255, 152, 0, 0.2)` | `color-mix(in srgb, var(--warning-color) 20%, transparent)` | Warning glow for locked items in edit mode |

**Current Code Context:**
```css
body.edit-mode .grid-stack-item.grid-stack-item-locked .grid-stack-item-content {
  border-color: var(--warning-color);
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
}
```

**Analysis:**
- This rule applies when the grid is in edit mode AND an item is locked
- The border color already uses `var(--warning-color)` (correctly)
- The box shadow uses a hardcoded `rgba(255, 152, 0, 0.2)` which is orange (#ff9800 at 20% opacity)
- Orange (#ff9800) matches the theme system's `--warning-color: #ff9800` (defined in `index.css`)

**Verification:**
```css
/* From src/index.css */
--warning-color: #ff9800;

/* Current gridstack.css line 360 */
box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);

/* RGB to hex conversion check */
rgb(255, 152, 0) = #ff9800 ✓
```

**Issue:** While the color value is correct, it's hardcoded instead of deriving from `--warning-color`. If a user customizes the warning color in the future (unlikely but possible), this glow effect would not update.

## Migration Strategy

**Recommendation:** Migrate to use `color-mix()` with `--warning-color` for consistency and future-proofing.

**Before:**
```css
body.edit-mode .grid-stack-item.grid-stack-item-locked .grid-stack-item-content {
  border-color: var(--warning-color);
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
}
```

**After:**
```css
body.edit-mode .grid-stack-item.grid-stack-item-locked .grid-stack-item-content {
  border-color: var(--warning-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--warning-color) 20%, transparent);
}
```

**Rationale:**
- Maintains visual consistency with the adjacent `border-color` rule (both use warning color)
- Ensures the glow automatically adapts if `--warning-color` ever changes
- Uses modern `color-mix()` syntax consistent with other theme migrations
- Zero visual change with current theme (both produce the same orange glow)

## Implementation Checklist

- [ ] Verify this is the ONLY hardcoded pattern in the file
- [ ] Migrate line 360 box-shadow → `color-mix(in srgb, var(--warning-color) 20%, transparent)`
- [ ] User to run: `npm run type-check`
- [ ] User to run: `npm run build:renderer`
- [ ] User to run: `npm run lint`
- [ ] Verify with hardcoded CSS scanner: `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/gridstack/gridstack.css`
- [ ] Test grid edit mode with locked items (requires runtime testing)
- [ ] Verify warning color glow appears correctly on locked items in edit mode

## Expected Behavior

**Visual Appearance:**
- No visual change with current theme (orange glow remains identical)
- Warning glow adapts if `--warning-color` is ever customized
- Locked items in edit mode show orange border + subtle orange glow
- Unlocked items in edit mode show primary color border + primary glow

**Testing Procedure:**
1. Open the main application window
2. Enable grid edit mode (Edit Layout button or shortcut)
3. Observe locked grid items (if any exist by default)
4. Verify they have an orange border + subtle orange glow (2px spread)
5. Compare against unlocked items which should have primary color border + glow

## Context: GridStack Edit Mode Visual Feedback

The gridstack.css file provides visual feedback for the dashboard layout editor:

- **Edit Mode Indicator** (line 87-106): Floating badge showing "Edit Mode" is active
- **Item Borders** (line 170-176): Primary color border + glow for editable items
- **Resize Handles** (line 201-245): Visual handles for resizing components
- **Locked Items** (line 358-361): **Warning color border + glow for items that cannot be moved**

The locked item styling uses warning color to clearly distinguish items that are locked from items that can be edited. This migration ensures the glow effect stays synchronized with the border color.

## Common Patterns Reference

```css
/* Warning color glow (current hardcoded) */
box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--warning-color) 20%, transparent); /* AFTER */

/* Related: Primary color glow (already correctly implemented on line 171) */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 25%, transparent);
```

## Notes

- `--warning-color` is defined in `src/index.css` as `#ff9800` (orange)
- This is a status color independent of theme (same across all themes)
- The hardcoded `rgba(255, 152, 0, 0.2)` exactly matches `--warning-color` at 20% opacity
- Migration is primarily for consistency and maintainability, not visual change
- Only 1 pattern in this file - very minimal migration
- GridStack is only used in the main window dashboard (not in dialogs)
- Edit mode must be enabled to see this effect (locked items are rare in normal usage)
