# CSS Migration Spec: update-available.css

**Status:** ⏳ PENDING
**File:** `src/ui/update-available/update-available.css`
**Total Patterns:** 24 hardcoded colors
**Priority:** HIGH - Auto-update notification dialog
**Component Type:** System dialog for application updates

## Pattern Breakdown

- **RGB/RGBA:** 19 patterns
- **Hex colors:** 5 patterns
- **Named colors:** 0 patterns

## Migration Strategy

### Category 1: White Text & Overlays (5 patterns)

Primary text colors and semi-transparent white overlays:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 4 | `#ffffff` | `var(--theme-text)` | Body text color |
| 37 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Icon button hover background |
| 70 | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--theme-text) 4%, transparent)` | Version summary background |
| 72 | `rgba(255, 255, 255, 0.08)` | `color-mix(in srgb, var(--theme-text) 8%, transparent)` | Version summary border |
| 95 | `rgba(255, 255, 255, 0.03)` | `color-mix(in srgb, var(--theme-text) 3%, transparent)` | Release notes background |
| 97 | `rgba(255, 255, 255, 0.06)` | `color-mix(in srgb, var(--theme-text) 6%, transparent)` | Release notes border |
| 119 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Scrollbar thumb |
| 135 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Progress bar background |
| 139 | `rgba(255, 255, 255, 0.08)` | `color-mix(in srgb, var(--theme-text) 8%, transparent)` | Progress webkit bar background |
| 215 | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--theme-text) 4%, transparent)` | Platform notice background |
| 216 | `rgba(255, 255, 255, 0.08)` | `color-mix(in srgb, var(--theme-text) 8%, transparent)` | Platform notice border |

### Category 2: Status Banner Colors (8 patterns)

Status banners for info, success, warning, and error states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 48 | `rgba(66, 133, 244, 0.15)` | `color-mix(in srgb, var(--theme-primary) 15%, transparent)` | Info banner background |
| 49 | `rgba(66, 133, 244, 0.4)` | `color-mix(in srgb, var(--theme-primary) 40%, transparent)` | Info banner border |
| 53 | `rgba(76, 175, 80, 0.15)` | `color-mix(in srgb, var(--success-color) 15%, transparent)` | Success banner background |
| 54 | `rgba(76, 175, 80, 0.4)` | `color-mix(in srgb, var(--success-color) 40%, transparent)` | Success banner border |
| 58 | `rgba(255, 193, 7, 0.15)` | `color-mix(in srgb, var(--warning-color) 15%, transparent)` | Warning banner background |
| 59 | `rgba(255, 193, 7, 0.4)` | `color-mix(in srgb, var(--warning-color) 40%, transparent)` | Warning banner border |
| 63 | `rgba(229, 62, 62, 0.15)` | `color-mix(in srgb, var(--error-color) 15%, transparent)` | Error banner background |
| 64 | `rgba(229, 62, 62, 0.4)` | `color-mix(in srgb, var(--error-color) 40%, transparent)` | Error banner border |

### Category 3: Muted Gray Text (5 patterns)

Secondary text colors for labels and metadata:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 84 | `#a0aec0` | `color-mix(in srgb, var(--theme-text) 65%, transparent)` | Version row label |
| 90 | `#f7fafc` | `var(--theme-text)` | Version row value |
| 106 | `#d0d7ff` | `color-mix(in srgb, var(--theme-text) 85%, var(--theme-primary) 15%)` | Release notes heading (slight primary tint) |
| 151 | `#cbd5f5` | `color-mix(in srgb, var(--theme-text) 80%, transparent)` | Progress details text |
| 217 | `#e2e8f0` | `color-mix(in srgb, var(--theme-text) 90%, transparent)` | Platform notice text |

## Implementation Checklist

- [ ] Migrate 11 white/transparent overlay patterns → `color-mix()` with `--theme-text`
- [ ] Migrate 8 status banner patterns → `color-mix()` with status/primary colors
- [ ] Migrate 5 muted text patterns → `color-mix()` or `var(--theme-text)`
- [ ] Verify progress bar uses `var(--accent-color)` (line 144 - already migrated)
- [ ] Verify button styles use theme variables (lines 175-192 - already migrated)
- [ ] Test with light theme (runtime testing required)
- [ ] Test with dark theme (runtime testing required)
- [ ] Verify update download progress UI
- [ ] Verify status banners display correctly for all states

## Common Patterns Reference

```css
/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Semi-transparent white overlays (surfaces) */
background: rgba(255, 255, 255, 0.04); /* BEFORE */
background: color-mix(in srgb, var(--theme-text) 4%, transparent); /* AFTER */

border: 1px solid rgba(255, 255, 255, 0.08); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--theme-text) 8%, transparent); /* AFTER */

/* Status banners - Info (uses primary) */
background: rgba(66, 133, 244, 0.15); /* BEFORE */
background: color-mix(in srgb, var(--theme-primary) 15%, transparent); /* AFTER */

border: 1px solid rgba(66, 133, 244, 0.4); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--theme-primary) 40%, transparent); /* AFTER */

/* Status banners - Success */
background: rgba(76, 175, 80, 0.15); /* BEFORE */
background: color-mix(in srgb, var(--success-color) 15%, transparent); /* AFTER */

border: 1px solid rgba(76, 175, 80, 0.4); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--success-color) 40%, transparent); /* AFTER */

/* Status banners - Warning */
background: rgba(255, 193, 7, 0.15); /* BEFORE */
background: color-mix(in srgb, var(--warning-color) 15%, transparent); /* AFTER */

border: 1px solid rgba(255, 193, 7, 0.4); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--warning-color) 40%, transparent); /* AFTER */

/* Status banners - Error */
background: rgba(229, 62, 62, 0.15); /* BEFORE */
background: color-mix(in srgb, var(--error-color) 15%, transparent); /* AFTER */

border: 1px solid rgba(229, 62, 62, 0.4); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--error-color) 40%, transparent); /* AFTER */

/* Muted text (65-90% opacity) */
color: #a0aec0; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 65%, transparent); /* AFTER */

color: #e2e8f0; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 90%, transparent); /* AFTER */

/* Release notes heading (primary tint) */
color: #d0d7ff; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 85%, var(--theme-primary) 15%); /* AFTER */

/* Scrollbar thumb */
background-color: rgba(255, 255, 255, 0.2); /* BEFORE */
background-color: color-mix(in srgb, var(--theme-text) 20%, transparent); /* AFTER */

/* Progress bar backgrounds */
background-color: rgba(255, 255, 255, 0.1); /* BEFORE */
background-color: color-mix(in srgb, var(--theme-text) 10%, transparent); /* AFTER */
```

## Notes

- **Status banners** use a consistent pattern: 15% opacity background + 40% opacity border
- **Info banner** should use `--theme-primary` to match the user's accent color preference
- **Success/Warning/Error** use fixed status colors independent of theme
- **Scrollbar** should adapt to theme text color for consistency
- **Progress bar** already uses `var(--accent-color)` (line 144) - no migration needed
- **Buttons** already use theme variables (lines 175-192) - no migration needed
- **White overlays** use very subtle opacity (3-10%) for surfaces - maintain these values for proper visual hierarchy
- **Release notes heading** has a slight primary color tint - use `color-mix()` with both `--theme-text` and `--theme-primary`
- This dialog is critical for user experience during auto-updates - ensure all states are clearly visible

## Visual Behavior After Migration

**Dark Theme:**
- White overlays become theme-text overlays (typically white/light gray with low opacity)
- Status banners show colored backgrounds with proper contrast
- Progress bar uses user's primary accent color
- All text adapts to theme text color

**Light Theme:**
- White overlays adapt to theme-text overlays (typically dark with low opacity)
- Status banners maintain visibility with proper color-mix opacity
- All elements remain clearly readable

## Dependencies

- Imports `rounded-dialog-template.css` for base dialog structure
- Uses `var(--accent-color)` for progress bar (already theme-aware)
- Uses `var(--accent-text-color)`, `var(--surface-muted)`, `var(--border-color)`, etc. in button row (already theme-aware)
