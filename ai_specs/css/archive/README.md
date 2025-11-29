# CSS Theme Migration Specs

This directory contains detailed migration specifications for converting hardcoded CSS colors to the centralized theme system.

## Migration Status Overview

### ✅ Completed Migrations
- `spoolman-dialog.css` - 31 patterns (30 migrated, 1 intentional) - See `archive/css/spoolman-dialog-migration.md`

### 🔄 Pending Migrations

#### Group 1 - High Priority Dialogs
- `ifs-dialog.css` - 25 patterns
- `update-available.css` - 24 patterns
- `status-dialog.css` - 15 patterns
- `printer-selection.css` - 21 patterns

#### Group 2 - UI Components
- `temperature-controls.css` - 18 patterns
- `gridstack.css` - 16 patterns
- `rounded-dialog-template.css` - 11 patterns
- `single-color-confirmation-dialog.css` - 15 patterns

#### Group 3 - More Dialogs (Current Group)
- `spoolman-offline-dialog.css` - 18 patterns (17 migrated, 1 intentional)
- `printer-connected-warning.css` - 20 patterns
- `settings.css` - 10 patterns (3 actual, 7 color wheel - keep)
- `input-dialog.css` - 9 patterns

## Spec Files

Each spec file contains:
- Pattern breakdown by type (hex, rgb, rgba, hsl, named)
- Categorized migration mappings
- Before/after code examples
- Special considerations and edge cases
- Implementation checklist
- Migration priority

## Using These Specs

1. **Read the spec file** for the target CSS file
2. **Follow the migration strategy** outlined in each category
3. **Use the before/after examples** for guidance
4. **Complete the implementation checklist** as you work
5. **Agent completes coding** and notifies user to test
6. **User runs validation** (type-check, build:renderer, lint)
7. **User verifies** runtime behavior and theme compatibility

## Theme System Variables

### Core Variables
- Surface: `--theme-surface`, `--surface-muted`, `--surface-elevated`
- Text: `--theme-text`, `--accent-text-color`, `--button-text-color`, `--container-text-color`
- Primary/Secondary: `--theme-primary`, `--theme-primary-hover`, `--theme-secondary`, `--theme-secondary-hover`
- Borders: `--border-color`, `--border-color-light`, `--border-color-focus`
- Status: `--error-color`, `--warning-color`, `--success-color`

### Advanced Patterns
- Transparency: `color-mix(in srgb, var(--theme-text) XX%, transparent)`
- Shadows: `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-lg)` (check `index.css` for availability)
- Dark overlays: `color-mix(in srgb, var(--theme-background) XX%, black)`

## Common Patterns Reference

```css
/* Backgrounds */
background: #2a2a2a; /* BEFORE */
background: var(--surface-elevated); /* AFTER */

/* Borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Primary accent */
background: #4285f4; /* BEFORE */
background: var(--theme-primary); /* AFTER */

/* Hover states */
background: #5a95f5; /* BEFORE */
background: var(--theme-primary-hover); /* AFTER */

/* White text */
color: #fff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (50% opacity) */
color: #888; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 50%, transparent); /* AFTER */

/* Error/warning/success */
color: #f44336; /* BEFORE */
color: var(--error-color); /* AFTER */

/* Transparency with color */
background: rgba(66, 133, 244, 0.3); /* BEFORE */
background: color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */

/* Shadows */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* BEFORE */
box-shadow: var(--shadow-md); /* AFTER (if variable exists) */
box-shadow: 0 2px 4px color-mix(in srgb, var(--theme-background) 20%, black); /* AFTER (fallback) */
```

## Quality Checklist

**Agent responsibilities:**
- [ ] All hardcoded colors migrated (except intentional patterns)
- [ ] Used appropriate semantic theme variables
- [ ] Added fallbacks: `var(--theme-primary, #4285f4)`
- [ ] Used `color-mix()` for transparency instead of rgba()
- [ ] Removed legacy `:root` variable definitions
- [ ] Documented intentional patterns (e.g., `transparent`, color wheel gradients)
- [ ] Verify with scanner: `go run ./scripts/detect-hardcoded-css.go --path-include <target-path>`
- [ ] Notify user when coding is complete

**User responsibilities:**
- [ ] Run type checking: `npm run type-check`
- [ ] Run webpack build: `npm run build:renderer`
- [ ] Run linting: `npm run lint`
- [ ] Test with both light and dark themes
- [ ] Verify visual fidelity (no unexpected UI changes)

## Notes

- Always check CLAUDE.md "Theme System & CSS Variables" section for latest variable definitions
- Use `detect-hardcoded-css.go` tool to verify migrations (agent runs this ~200ms scan)
- Preserve visual fidelity - migrations should be invisible to users
- Focus on CODE CHANGES, not time estimates or ETAs
- **Agent completes coding + scanner verification, then user handles build/lint/runtime testing**
