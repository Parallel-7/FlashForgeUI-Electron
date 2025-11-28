# CSS Migration Spec: connect-choice-dialog.css

**Status:** ⏳ PENDING
**File:** `src/ui/connect-choice-dialog/connect-choice-dialog.css`
**Total Patterns:** 19 hardcoded colors
**Priority:** HIGH - Initial connection flow dialog
**Component Type:** Choice selection dialog (discovery vs manual connection)

## Pattern Breakdown

- **Hex colors:** 15 patterns
- **RGB/RGBA:** 4 patterns
- **Named colors:** 1 pattern (`white` on line 124)

## IMPORTANT: Partial Theme Migration Detected

Lines 46-47, 136-137, 195-196 already use theme variables:
- `var(--theme-primary)` (line 46)
- `var(--surface-elevated)` (lines 47, 136, 196)
- `var(--border-color)` (lines 137, 195)

**Keep these as-is and migrate remaining hardcoded values to match the theme system.**

## Migration Strategy

### Category 1: Dark Gray Backgrounds (3 patterns)

Surface backgrounds for buttons and actions:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 33 | `#4a4a4a` | `var(--surface-elevated)` | Choice button default background |
| 114 | `#353535` | `var(--theme-surface)` | Dialog actions background |

**Note:** Line 47 already uses `var(--surface-elevated)` for hover state - migrate line 33 to match.

### Category 2: Standard Borders (2 patterns)

Gray borders for structure:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 34 | `#555` | `var(--border-color)` | Choice button default border |
| 113 | `#555` | `var(--border-color)` | Dialog actions top border |

**Note:** Lines 137 and 195 already use `var(--border-color)` - migrate remaining to match.

### Category 3: Primary Accent Shadows (3 patterns)

Blue glow effects using primary color:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 49 | `rgba(74, 144, 226, 0.2)` | `color-mix(in srgb, var(--theme-primary) 20%, transparent)` | Choice button hover shadow |
| 54 | `rgba(74, 144, 226, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Choice button active shadow |
| 60 | `rgba(74, 144, 226, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Choice button focus shadow |

**Note:** Line 46 already uses `var(--theme-primary)` for hover border - shadows should use color-mix for consistency.

### Category 4: Focus States (2 patterns)

Keyboard focus indicators:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 59 | `#4a90e2` | `var(--theme-primary)` | Choice button focus border |
| 183 | `#4a90e2` | `var(--theme-primary)` | Keyboard-focused button border |
| 184 | `rgba(74, 144, 226, 0.5)` | `color-mix(in srgb, var(--theme-primary) 50%, transparent)` | Keyboard-focused button shadow |

### Category 5: White Text (2 patterns)

Primary text color:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 99 | `#ffffff` | `var(--theme-text)` | Choice content heading |
| 124 | `white` | `var(--theme-text)` | Secondary button text |

### Category 6: Muted Text (2 patterns)

Secondary/description text:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 105 | `#b0b0b0` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Choice description text |
| 160 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 80%, transparent)` | High contrast description text |

### Category 7: Secondary Button Styles (5 patterns)

Cancel/secondary button colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 123 | `#666` | `var(--surface-elevated)` | Secondary button background |
| 125 | `#777` | `var(--border-color-light)` | Secondary button border |
| 141 | `#555` | `var(--surface-muted)` | Secondary button active background |
| 146 | `rgba(102, 102, 102, 0.5)` | `color-mix(in srgb, var(--surface-elevated) 50%, transparent)` | Secondary button focus shadow |

**Note:** Line 136 already uses `var(--surface-elevated)` for hover - migrate line 123 to match, use `--surface-muted` for active state.

### Category 8: High Contrast Border (1 pattern)

Accessibility support for high contrast mode:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 152 | `#ffffff` | `var(--theme-text)` | High contrast dialog border |
| 156 | `#ffffff` | `var(--theme-text)` | High contrast choice button border |

## Implementation Checklist

- [ ] Migrate 2 dark background patterns → surface variables
- [ ] Migrate 2 border patterns → `var(--border-color)`
- [ ] Migrate 3 primary shadow patterns → `color-mix()` with `--theme-primary`
- [ ] Migrate 3 focus state patterns → `var(--theme-primary)` + `color-mix()`
- [ ] Migrate 2 white text patterns → `var(--theme-text)`
- [ ] Migrate 2 muted text patterns → `color-mix()` with opacity
- [ ] Migrate 4 secondary button patterns → surface variables + `color-mix()`
- [ ] Migrate 2 high contrast patterns → `var(--theme-text)`
- [ ] Verify existing theme variables remain unchanged (lines 46-47, 136-137, 195-196)
- [ ] Test with light theme (runtime testing required)
- [ ] Test with dark theme (runtime testing required)
- [ ] Test keyboard navigation and focus states
- [ ] Test high contrast mode
- [ ] Test reduced motion support
- [ ] Verify choice button hover/active animations

## Common Patterns Reference

```css
/* Dark surface backgrounds */
background: #4a4a4a; /* BEFORE */
background: var(--surface-elevated); /* AFTER */

background: #353535; /* BEFORE */
background: var(--theme-surface); /* AFTER */

/* Borders */
border: 2px solid #555; /* BEFORE */
border: 2px solid var(--border-color); /* AFTER */

border-top: 1px solid #555; /* BEFORE */
border-top: 1px solid var(--border-color); /* AFTER */

/* Primary accent hover/active (already using var(--theme-primary) on line 46) */
border-color: var(--theme-primary); /* ALREADY MIGRATED - keep as-is */

/* Primary accent shadows */
box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2); /* BEFORE */
box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 20%, transparent); /* AFTER */

box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3); /* BEFORE */
box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */

box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */

/* Focus outlines/borders */
border-color: #4a90e2; /* BEFORE */
border-color: var(--theme-primary); /* AFTER */

box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.5); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 50%, transparent); /* AFTER */

/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

color: white; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (70% opacity) */
color: #b0b0b0; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 70%, transparent); /* AFTER */

/* Muted text (80% opacity) */
color: #cccccc; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 80%, transparent); /* AFTER */

/* Secondary button */
background: #666; /* BEFORE */
background: var(--surface-elevated); /* AFTER */

border: 1px solid #777; /* BEFORE */
border: 1px solid var(--border-color-light); /* AFTER */

/* Secondary button hover (already using var(--surface-elevated) on line 136) */
background: var(--surface-elevated); /* ALREADY MIGRATED - keep as-is */

/* Secondary button active */
background: #555; /* BEFORE */
background: var(--surface-muted); /* AFTER */

/* Secondary button focus */
box-shadow: 0 0 0 2px rgba(102, 102, 102, 0.5); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--surface-elevated) 50%, transparent); /* AFTER */

/* High contrast mode */
border-color: #ffffff; /* BEFORE */
border-color: var(--theme-text); /* AFTER */
```

## Notes

- **Partial migration:** This file has already been partially migrated to use theme variables - maintain consistency by completing the migration
- **Existing theme variables:** Lines 46-47, 136-137, 195-196 already use correct theme variables - **do not modify these**
- **Choice buttons:** Primary interactive elements with hover/active/focus states - ensure all states use theme primary for visual feedback
- **Secondary button:** Uses surface colors instead of primary - ensure proper hierarchy distinction
- **Keyboard navigation:** Focus states use primary color with varying shadow opacity for visual feedback
- **High contrast mode:** Media query overrides for accessibility - use `--theme-text` for maximum contrast
- **Reduced motion:** Animation/transition disabling for accessibility - ensure CSS remains
- **Icon scaling:** Subtle transform on hover (1.05) - ensure smooth animation preserved
- **Disabled state:** Already uses opacity - no color migration needed
- This is the first dialog in the connection flow - ensure professional, polished appearance

## Visual Behavior After Migration

**Dark Theme:**
- Choice buttons start with elevated surface, hover to more elevated surface
- Primary accent (blue by default) provides visual feedback on hover/focus
- Secondary button uses muted surface colors to indicate lower priority
- Focus states clearly visible for keyboard navigation

**Light Theme:**
- Surface elevation reverses (elevated becomes lighter)
- Primary accent adapts to user's chosen theme color
- All shadows and borders maintain proper contrast
- Text opacity levels maintain readability

**High Contrast Mode:**
- Dialog and button borders use theme text color (white on dark, black on light)
- Maximum contrast for accessibility

**Reduced Motion:**
- Animations disabled but visual states remain functional

## Dependencies

- Imports `rounded-dialog-template.css` for base dialog structure
- Uses Lucide icons (`.lucide-icon` class) for visual elements
- Keyboard navigation implemented in TypeScript (focus management)
- Platform detection for custom behavior (body classes)
