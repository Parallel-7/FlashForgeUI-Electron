# CSS Migration Spec: single-color-confirmation-dialog.css

**Status:** ⏳ PENDING
**File:** `src/ui/single-color-confirmation-dialog/single-color-confirmation-dialog.css`
**Total Patterns:** 22 hardcoded colors
**Priority:** HIGH - Material station single-color job confirmation
**Component Type:** Confirmation dialog for single-extruder printing

## Pattern Breakdown

- **Hex colors:** 20 patterns
- **RGB/RGBA:** 2 patterns
- **CSS Variables (legacy):** 6 custom variables to remove

## IMPORTANT: Legacy CSS Variables to Remove

Lines 6-13 define legacy CSS variables that duplicate theme system functionality. **These should be removed entirely** and replaced with theme variables throughout the file:

| Line | Legacy Variable | Replacement | Usage Context |
|------|-----------------|-------------|---------------|
| 7 | `--button-bg: #4285f4` | `var(--theme-primary)` | Primary button background |
| 8 | `--button-hover: #5a95f5` | `var(--theme-primary-hover)` | Primary button hover |
| 9 | `--material-type-color: #00ff6e` | `var(--success-color)` | Material type label |
| 10 | `--spool-bg: #808080` | Dynamic value from material data | Spool visualization background |
| 11 | `--card-bg: #353535` | `var(--surface-elevated)` | Material preview card |
| 12 | `--option-bg: #2a2a2a` | `var(--surface-muted)` | Options section background |

**Action:** Delete lines 6-13 entirely and migrate all references to theme variables.

## Migration Strategy

### Category 1: Text Colors (6 patterns)

Primary and secondary text colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 24 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 80%, transparent)` | Confirmation message text |
| 30 | `#ffffff` | `var(--theme-text)` | File name text |
| 47 | `#ffffff` | `var(--theme-text)` | Material preview heading |
| 99 | `#ffffff` | `var(--theme-text)` | Slot label text |
| 133 | `#ffffff` | `var(--theme-text)` | Checkbox label text |
| 184 | `#888888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | No material type text |

### Category 2: Surface Backgrounds (4 patterns)

Card and section backgrounds:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 38 | `var(--card-bg)` → `#353535` | `var(--surface-elevated)` | Material preview background |
| 111 | `var(--option-bg)` → `#2a2a2a` | `var(--surface-muted)` | Options section background |
| 87 | `#1a1a1a` | `var(--theme-background)` | Spool hole center (dark core) |
| 178 | `#333333` | `var(--surface-muted)` | No material spool background |

### Category 3: Borders (6 patterns)

Various border colors for cards, inputs, and elements:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 39 | `#555` | `var(--border-color)` | Material preview border |
| 72 | `rgba(255, 255, 255, 0.3)` | `color-mix(in srgb, var(--theme-text) 30%, transparent)` | Spool color border (outer) |
| 88 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Spool hole border |
| 112 | `#555` | `var(--border-color)` | Options section border |
| 180 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | No material spool border (dashed) |

### Category 4: Primary/Secondary Buttons (6 patterns)

Button backgrounds and hover states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 152 | `var(--button-bg)` → `#4285f4` | `var(--theme-primary)` | Primary button background |
| 153 | `var(--button-bg)` → `#4285f4` | `var(--theme-primary)` | Primary button border |
| 157 | `var(--button-hover)` → `#5a95f5` | `var(--theme-primary-hover)` | Primary button hover background |
| 158 | `var(--button-hover)` → `#5a95f5` | `var(--theme-primary-hover)` | Primary button hover border |
| 162 | `#666` | `var(--surface-elevated)` | Cancel button background |
| 163 | `#777` | `var(--border-color-light)` | Cancel button border |
| 167 | `#777` | `var(--surface-muted)` | Cancel button hover background |
| 168 | `#888` | `var(--border-color)` | Cancel button hover border |

### Category 5: Special Colors (4 patterns)

Error messages, shadows, and accent colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 140 | `rgba(255, 68, 68, 0.1)` | `color-mix(in srgb, var(--error-color) 10%, transparent)` | Error message background |
| 141 | `rgba(255, 68, 68, 0.3)` | `color-mix(in srgb, var(--error-color) 30%, transparent)` | Error message border |
| 142 | `#ff4444` | `var(--error-color)` | Error message text |
| 74 | `inset 0 0 20px rgba(0, 0, 0, 0.4)` | `inset 0 0 20px color-mix(in srgb, var(--theme-background) 40%, black)` | Spool inset shadow |
| 75 | `0 4px 12px rgba(0, 0, 0, 0.4)` | `var(--shadow-md)` | Spool outer shadow |
| 105 | `var(--material-type-color)` → `#00ff6e` | `var(--success-color)` | Material type color (PLA/ABS label) |
| 129 | `var(--button-bg)` → `#4285f4` | `var(--theme-primary)` | Checkbox accent color |

### Category 6: Spool Dynamic Background (Special Case)

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 71 | `var(--spool-bg)` → `#808080` | **Keep as-is** | Dynamic spool color set via inline style from material data |

**Note:** Line 71 uses `var(--spool-bg)` which is dynamically set via inline styles in the TypeScript code based on actual spool color from material data. This should remain as a CSS variable but the fallback value should be removed from the `:root` declaration.

## Implementation Checklist

- [ ] **Remove** `:root` block (lines 6-13) entirely
- [ ] Migrate 6 text color patterns → `var(--theme-text)` or `color-mix()`
- [ ] Migrate 4 surface background patterns → surface variables
- [ ] Migrate 5 border patterns → `var(--border-color)` or `color-mix()`
- [ ] Migrate 8 button patterns → primary/surface variables with hover states
- [ ] Migrate 3 error message patterns → `var(--error-color)`
- [ ] Migrate 2 shadow patterns → `var(--shadow-md)` or `color-mix()`
- [ ] Migrate 1 material type color → `var(--success-color)`
- [ ] Migrate 1 checkbox accent → `var(--theme-primary)`
- [ ] **Keep** `var(--spool-bg)` usage on line 71 (dynamic value from material data)
- [ ] Test with light theme (runtime testing required)
- [ ] Test with dark theme (runtime testing required)
- [ ] Verify material spool visualization displays correctly
- [ ] Verify error states show properly

## Common Patterns Reference

```css
/* Remove legacy CSS variables entirely */
:root {
  --button-bg: #4285f4;           /* DELETE - use var(--theme-primary) */
  --button-hover: #5a95f5;        /* DELETE - use var(--theme-primary-hover) */
  --material-type-color: #00ff6e; /* DELETE - use var(--success-color) */
  --spool-bg: #808080;            /* DELETE - dynamic value from inline style */
  --card-bg: #353535;             /* DELETE - use var(--surface-elevated) */
  --option-bg: #2a2a2a;           /* DELETE - use var(--surface-muted) */
}

/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (80% opacity) */
color: #cccccc; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 80%, transparent); /* AFTER */

/* Muted text (50% opacity) */
color: #888888; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 50%, transparent); /* AFTER */

/* Card backgrounds */
background-color: var(--card-bg); /* BEFORE (legacy variable) */
background-color: var(--surface-elevated); /* AFTER */

background-color: var(--option-bg); /* BEFORE (legacy variable) */
background-color: var(--surface-muted); /* AFTER */

/* Dark background (spool hole center) */
background-color: #1a1a1a; /* BEFORE */
background-color: var(--theme-background); /* AFTER */

/* Borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Semi-transparent borders */
border: 3px solid rgba(255, 255, 255, 0.3); /* BEFORE */
border: 3px solid color-mix(in srgb, var(--theme-text) 30%, transparent); /* AFTER */

border: 2px solid rgba(255, 255, 255, 0.2); /* BEFORE */
border: 2px solid color-mix(in srgb, var(--theme-text) 20%, transparent); /* AFTER */

/* Primary button */
background-color: var(--button-bg); /* BEFORE (legacy variable) */
background-color: var(--theme-primary); /* AFTER */

border-color: var(--button-bg); /* BEFORE (legacy variable) */
border-color: var(--theme-primary); /* AFTER */

/* Primary button hover */
background-color: var(--button-hover); /* BEFORE (legacy variable) */
background-color: var(--theme-primary-hover); /* AFTER */

/* Cancel button */
background-color: #666; /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

border-color: #777; /* BEFORE */
border-color: var(--border-color-light); /* AFTER */

/* Cancel button hover */
background-color: #777; /* BEFORE */
background-color: var(--surface-muted); /* AFTER */

border-color: #888; /* BEFORE */
border-color: var(--border-color); /* AFTER */

/* Error message */
background-color: rgba(255, 68, 68, 0.1); /* BEFORE */
background-color: color-mix(in srgb, var(--error-color) 10%, transparent); /* AFTER */

border: 1px solid rgba(255, 68, 68, 0.3); /* BEFORE */
border: 1px solid color-mix(in srgb, var(--error-color) 30%, transparent); /* AFTER */

color: #ff4444; /* BEFORE */
color: var(--error-color); /* AFTER */

/* Shadows */
box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4); /* BEFORE */
box-shadow: inset 0 0 20px color-mix(in srgb, var(--theme-background) 40%, black); /* AFTER */

box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); /* BEFORE */
box-shadow: var(--shadow-md); /* AFTER */

/* Material type color (success green) */
color: var(--material-type-color); /* BEFORE (legacy variable) */
color: var(--success-color); /* AFTER */

/* Checkbox accent */
accent-color: var(--button-bg); /* BEFORE (legacy variable) */
accent-color: var(--theme-primary); /* AFTER */

/* Dynamic spool color - KEEP AS-IS */
background-color: var(--spool-bg); /* Keep this - set via inline style in TS */
```

## Notes

- **Legacy variables cleanup:** This file has 6 custom CSS variables that duplicate theme system functionality - delete the entire `:root` block
- **Spool visualization:** The `--spool-bg` variable is dynamically set via inline styles from actual material color data - keep the CSS variable usage but remove the fallback declaration
- **Material type color:** Uses bright green (`#00ff6e`) which should map to `--success-color` for consistency
- **Error states:** Follow standard error color pattern (10% background, 30% border, solid text)
- **Button hierarchy:** Primary button uses theme primary, cancel uses muted surface colors
- **Checkbox accent:** Should match primary button color for visual consistency
- **No material state:** Uses dashed border and muted colors to indicate empty state
- This dialog is part of the material station workflow - ensure proper visual hierarchy

## Visual Behavior After Migration

**Dark Theme:**
- Material preview card uses elevated surface
- Options section uses muted surface (darker than card)
- Primary button uses user's accent color
- Spool visualization adapts borders to theme text color
- Error messages show red with proper contrast

**Light Theme:**
- Surface hierarchy reverses (muted becomes lighter)
- All borders and shadows adapt properly
- Spool visualization maintains visibility
- Error messages remain clearly visible

## Dependencies

- Imports `rounded-dialog-template.css` for base dialog structure
- TypeScript code sets `--spool-bg` via inline style based on material data
- Material station backend provides color/type data for visualization
