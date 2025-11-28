# CSS Migration Spec: status-dialog.css

**Status:** ⏳ PENDING
**File:** `src/ui/status-dialog/status-dialog.css`
**Total Patterns:** 20 hardcoded colors
**Priority:** MEDIUM - Printer status information dialog
**Component Type:** Multi-tab status display dialog

## Pattern Breakdown

- **Hex colors:** 18 patterns
- **RGB/RGBA:** 2 patterns
- **Named colors:** 0 patterns

## Migration Strategy

### Category 1: Dark Gray Backgrounds (3 patterns)

Primary surface backgrounds for tabs and panels:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 35 | `#1e1e1e` | `var(--theme-surface)` | Active tab background |
| 48 | `#1e1e1e` | `var(--theme-surface)` | Tab panels background |

### Category 2: Surface Overlays (3 patterns)

Semi-transparent overlays for inactive tabs and cards:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 27 | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--theme-text) 4%, transparent)` | Inactive tab background |
| 81 | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--theme-text) 4%, transparent)` | Summary card background |
| 118 | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--theme-text) 4%, transparent)` | Status section background |

### Category 3: Borders (3 patterns)

Standard gray borders throughout:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 25 | `#444` | `var(--border-color)` | Tab button border |
| 46 | `#444` | `var(--border-color)` | Tab panels border |
| 82 | `#444` | `var(--border-color)` | Summary card border |
| 121 | `#444` | `var(--border-color)` | Status section border |

### Category 4: Focus/Active States (2 patterns)

Keyboard focus indicator using primary color:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 41 | `#4285f4` | `var(--theme-primary)` | Tab button focus outline color |

### Category 5: White/Light Text (4 patterns)

Primary text colors at various opacity levels:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 36 | `#ffffff` | `var(--theme-text)` | Active tab text color |
| 71 | `#f0f0f0` | `var(--theme-text)` | Tab panel title |
| 100 | `#ffffff` | `var(--theme-text)` | Summary title text |
| 106 | `#ffffff` | `var(--theme-text)` | Summary value text |

### Category 6: Muted Gray Text (4 patterns)

Secondary text for labels and metadata:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 28 | `#e0e0e0` | `color-mix(in srgb, var(--theme-text) 88%, transparent)` | Inactive tab text |
| 111 | `#b8b8b8` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Summary subtext |
| 134 | `#e0e0e0` | `color-mix(in srgb, var(--theme-text) 88%, transparent)` | Status label text |
| 142 | `#b8b8b8` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Status value text |

### Category 7: Status Indicators (2 patterns)

Active/inactive status indicator dots:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 156 | `#4CAF50` | `var(--success-color)` | Active status indicator (green) |
| 160 | `#f44336` | `var(--error-color)` | Inactive status indicator (red) |

## Implementation Checklist

- [ ] Migrate 2 dark background patterns → `var(--theme-surface)`
- [ ] Migrate 3 surface overlay patterns → `color-mix()` with `--theme-text`
- [ ] Migrate 4 border patterns → `var(--border-color)`
- [ ] Migrate 1 focus state → `var(--theme-primary)`
- [ ] Migrate 4 white text patterns → `var(--theme-text)`
- [ ] Migrate 4 muted text patterns → `color-mix()` with opacity
- [ ] Migrate 2 status indicator patterns → status color variables
- [ ] Test with light theme (runtime testing required)
- [ ] Test with dark theme (runtime testing required)
- [ ] Verify tab switching works correctly
- [ ] Verify status indicators display correctly
- [ ] Verify keyboard navigation and focus states

## Common Patterns Reference

```css
/* Dark surface backgrounds */
background: #1e1e1e; /* BEFORE */
background: var(--theme-surface); /* AFTER */

/* Semi-transparent surface overlays */
background: rgba(255, 255, 255, 0.04); /* BEFORE */
background: color-mix(in srgb, var(--theme-text) 4%, transparent); /* AFTER */

/* Borders */
border: 1px solid #444; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Focus outline (primary accent) */
outline: 2px solid #4285f4; /* BEFORE */
outline: 2px solid var(--theme-primary); /* AFTER */

/* White text (100% opacity) */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Light text (close to white) */
color: #f0f0f0; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (88% opacity) */
color: #e0e0e0; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 88%, transparent); /* AFTER */

/* Muted text (70% opacity) */
color: #b8b8b8; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 70%, transparent); /* AFTER */

/* Active status indicator (green) */
background-color: #4CAF50; /* BEFORE */
background-color: var(--success-color); /* AFTER */

/* Inactive status indicator (red) */
background-color: #f44336; /* BEFORE */
background-color: var(--error-color); /* AFTER */
```

## Notes

- **Tab system:** Uses ARIA attributes for accessibility (`aria-selected`) - ensure focus states remain clearly visible
- **Status indicators:** Use standard success (green) and error (red) colors for active/inactive states
- **Surface hierarchy:** Active tabs use `--theme-surface`, inactive tabs use subtle overlay for visual distinction
- **Text hierarchy:** Three levels of text opacity (100%, 88%, 70%) for clear information hierarchy
- **Focus states:** Keyboard navigation uses primary color for focus outlines - maintain 2px width for accessibility
- **Grid layout:** Summary cards use auto-fill grid - ensure proper spacing and borders adapt to theme
- **Scrollable content:** Tab panels have `overflow-y: auto` - ensure scrollbar styling inherits from global theme
- This dialog provides system status information - ensure all states are clearly distinguishable

## Visual Behavior After Migration

**Dark Theme:**
- Active tabs use theme surface (typically dark gray)
- Inactive tabs show subtle overlay
- Borders provide clear separation
- Status indicators use bright success/error colors for visibility
- Focus states use primary accent for keyboard navigation

**Light Theme:**
- Surface colors invert appropriately
- Overlays adapt to provide proper contrast
- Text maintains readability at all opacity levels
- Status indicators remain clearly visible

## Dependencies

- Imports `rounded-dialog-template.css` for base dialog structure
- Uses ARIA attributes for tab accessibility
- Keyboard navigation implemented in TypeScript (focus management)
