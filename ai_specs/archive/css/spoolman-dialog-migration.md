# CSS Migration Spec: spoolman-dialog.css

**Status:** ✅ COMPLETED (2025-11-28)
**File:** `src/ui/spoolman-dialog/spoolman-dialog.css`
**Total Patterns:** 31 (30 migrated, 1 intentional kept)
**Priority:** HIGH - Spoolman filament selection dialog
**Time Taken:** ~15 minutes

## Pattern Breakdown

- **Hex colors:** 23 patterns
- **RGB/RGBA:** 6 patterns
- **Named colors:** 2 patterns (1 `transparent` to keep, 1 `white` to migrate)

## IMPORTANT: Intentional Pattern (KEEP AS-IS)

| Line | Current | Action | Context |
|------|---------|--------|---------|
| 12 | `transparent !important` | **KEEP AS-IS** | Intentional transparent background override |

## Migration Strategy

### Category 1: Dark Backgrounds (5 patterns)

Various dark gray backgrounds for sections:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 17 | `#3a3a3a` | `var(--surface-muted)` | Container background |
| 37 | `#353535` | `var(--surface-elevated)` | Search bar background |
| 44 | `#2a2a2a` | `var(--surface-muted)` | Search input background |
| 162 | `#353535` | `var(--surface-elevated)` | Spool item background |
| 189 | `#666` | `var(--surface-elevated)` | Spool preview background |

### Category 2: Gray Borders (7 patterns)

Standard `#555` borders throughout:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 18 | `#555` | `var(--border-color)` | Container border |
| 38 | `#555` | `var(--border-color)` | Search bar border-bottom |
| 45 | `#555` | `var(--border-color)` | Search input border |
| 95 | `#555` | `var(--border-color)` | Loading spinner border |
| 163 | `#555` | `var(--border-color)` | Spool item border |

### Category 3: Primary/Accent Colors - Indigo (6 patterns)

Indigo accent color (`#5c6bc0`, `#7986cb`) for active states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 54 | `#5c6bc0` | `var(--theme-primary)` | Active item border |
| 96 | `#5c6bc0` | `var(--theme-primary)` | Spinner top color |
| 136 | `#5c6bc0` | `var(--theme-primary)` | Select button background |
| 147 | `#7986cb` | `var(--theme-primary-hover)` | Select button hover |
| 175 | `#5c6bc0` | `var(--theme-primary)` | Selected border |
| 177 | `rgba(92, 107, 192, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Selected glow |

### Category 4: White Text (4 patterns)

White text for labels and buttons:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 47 | `#fff` | `var(--theme-text)` | Search placeholder |
| 137 | `white` | `var(--accent-text-color)` | Button text (needs contrast) |
| 211 | `#fff` | `var(--theme-text)` | Spool name text |

### Category 5: Muted Gray Text (5 patterns)

Light gray text for secondary info:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 58 | `#888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Empty state text |
| 89 | `#aaa` | `color-mix(in srgb, var(--theme-text) 60%, transparent)` | Material type label |
| 130 | `#777` | `color-mix(in srgb, var(--theme-text) 45%, transparent)` | Weight text |
| 221 | `#aaa` | `color-mix(in srgb, var(--theme-text) 60%, transparent)` | Material info |
| 227 | `#888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Vendor text |

### Category 6: Error Color (1 pattern)

Red error text:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 123 | `#f44336` | `var(--error-color)` | Error message text |

### Category 7: Dark Shadows (2 patterns)

Black shadows for depth:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 195 | `inset 0 3px 6px rgba(0, 0, 0, 0.4)` | `inset 0 3px 6px color-mix(in srgb, var(--theme-background) 40%, black)` | Spool preview inset |
| 196 | `0 3px 6px rgba(0, 0, 0, 0.3)` | `var(--shadow-md)` | Spool preview outer shadow |

### Category 8: Light/White Overlays (2 patterns)

Semi-transparent white borders:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 190 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Spool preview border |
| 204 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Empty preview border |

### Category 9: Dark Overlay Background (1 pattern)

Black overlay for empty state:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 203 | `rgba(0, 0, 0, 0.3)` | `color-mix(in srgb, var(--theme-background) 30%, black)` | Empty spool background |

## Implementation Checklist

- [x] Migrate 5 dark background patterns → surface variables
- [x] Migrate 7 gray border patterns → `var(--border-color)`
- [x] Migrate 6 indigo accent patterns → `--theme-primary` / `--theme-primary-hover`
- [x] Migrate 4 white text patterns → `var(--theme-text)` or `var(--accent-text-color)`
- [x] Migrate 5 muted text patterns → `color-mix()` with opacity
- [x] Migrate 1 error color → `var(--error-color)`
- [x] Migrate 2 dark shadow patterns → `var(--shadow-md)` or `color-mix()`
- [x] Migrate 2 light overlay patterns → `color-mix()` with `--theme-text`
- [x] Migrate 1 dark overlay → `color-mix()` with `--theme-background`
- [x] **SKIP** `transparent !important` (line 12) - intentional
- [x] Verify 30 patterns migrated, 1 intentionally skipped
- [ ] Test with light theme (requires runtime testing)
- [ ] Test with dark theme (requires runtime testing)
- [ ] Verify spool selection works correctly (requires runtime testing)

## Completion Summary

Migration completed successfully on 2025-11-28:
- ✅ **Before:** 31 total patterns (30 to migrate, 1 intentional)
- ✅ **After:** 1 intentional pattern remains (`transparent !important` on line 12)
- ✅ All 30 hardcoded color patterns migrated to theme system variables
- ✅ Type checking passed (0 errors)
- ✅ Webpack build passed successfully
- ✅ Lint passed (pre-existing warnings unrelated to this migration)
- ✅ Verified with hardcoded CSS scanner: only 1 intentional pattern remains

**Expected Runtime Behavior:**
- All UI colors adapt to user-selected theme
- Indigo accent maps to `--theme-primary`
- Spool selection visual feedback works across themes
- Error messages use proper error color
- Light/dark themes work correctly

**Note:** Runtime testing with actual Spoolman server required for full verification.

## Common Patterns Reference

```css
/* Dark backgrounds */
background: #3a3a3a; /* BEFORE */
background: var(--surface-muted); /* AFTER */

/* Gray borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Indigo accent (primary) */
background: #5c6bc0; /* BEFORE */
background: var(--theme-primary); /* AFTER */

border-color: #5c6bc0; /* BEFORE */
border-color: var(--theme-primary); /* AFTER */

/* White text */
color: #fff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Button text (needs contrast) */
color: white; /* BEFORE */
color: var(--accent-text-color); /* AFTER */

/* Muted text (50-60% opacity) */
color: #888; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 50%, transparent); /* AFTER */

/* Error text */
color: #f44336; /* BEFORE */
color: var(--error-color); /* AFTER */

/* Primary accent glow */
box-shadow: 0 4px 12px rgba(92, 107, 192, 0.3); /* BEFORE */
box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */

/* Dark shadows */
0 3px 6px rgba(0, 0, 0, 0.3); /* BEFORE */
var(--shadow-md); /* AFTER */

/* Light overlay borders */
border: 3px solid rgba(255, 255, 255, 0.2); /* BEFORE */
border: 3px solid color-mix(in srgb, var(--theme-text) 20%, transparent); /* AFTER */
```

## Notes

- The indigo accent color (`#5c6bc0`) is consistent with IFS dialog and should map to `--theme-primary`
- Loading spinner uses the primary color - preserve this visual connection
- Spool preview uses layered shadows (inset + outer) - maintain visual depth
- Empty state text should be clearly distinct from filled state
- Error messages use Material Design red - map to `--error-color`
- The `transparent !important` on line 12 is an intentional override - leave it alone
