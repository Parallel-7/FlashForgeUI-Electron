# Theme System & CSS Variables

**Last Updated:** 2026-03-11 17:36 ET (America/New_York)

**CRITICAL**: FlashForgeUI uses a unified theme system. NEVER hardcode colors in CSS or inline styles. All fragmented CSS is being progressively consolidated into the centralized theme system.

---

## Core Theme Files

- **`src/main/utils/CSSVariables.ts`** - Main injection utility that reads theme config and injects computed CSS variables into all BrowserWindows. Handles both RoundedUI variables and full theme palette injection.
- **`src/shared/themeColorUtils.ts`** - Pure computation utilities for deriving theme colors. Contains color manipulation functions (`lightenColor`, `darkenColor`, `hexToRgba`, `getLuminance`, `getContrastingTextColor`) and the central `computeThemePalette()` function that generates all derived variables.
- **`src/renderer/src/index.css`** - Root CSS file with `:root` variable declarations. Contains fallback values and legacy compatibility variables. All new CSS should reference computed variables, not define hardcoded values.
- **`src/shared/types/config.ts`** - Defines `ThemeColors` interface (5 user-configurable base colors) and `DEFAULT_THEME`.
- **`src/main/utils/RoundedUICompatibility.ts`** - Platform compatibility checks for Rounded UI. Blocks Rounded UI on macOS (traffic light conflicts with custom title bar) and Windows 11 (native rounded chrome clashes with custom implementation). Use `isRoundedUISupported()` before enabling Rounded UI features.
- **`src/renderer/src/ui/shared/theme-utils.ts`** - Dialog theme utilities. Exports `applyDialogTheme()` function used by ALL dialog renderers to apply theme colors dynamically. This is the standard pattern for theme application in dialogs.

---

## Supporting Files

- **`scripts/css-scanner-whitelist.json`** - Whitelist configuration for the hardcoded CSS scanner (`scripts/detect-hardcoded-css.go`). Contains global patterns (like `transparent`, `white`) and file-specific exemptions for legitimate hardcoded colors (color pickers, filament spool representations, accessibility overrides).
- **`src/main/webui/static/features/layout-theme.ts`** - WebUI client-side theme management. Handles theme profile CRUD operations, theme application to the WebUI DOM, and profile selection UI. Provides `loadWebUITheme()`, `applyWebUITheme()`, and profile management functions.

---

## Theme Computation Architecture

### Base Theme Colors

User-configurable via Settings → Desktop Theme:
- `primary` → `--theme-primary` - Primary accent color (used for focused elements, primary buttons)
- `secondary` → `--theme-secondary` - Secondary accent color (used for secondary buttons, alternative accents)
- `background` → `--theme-background` - Main window background
- `surface` → `--theme-surface` - Card/panel backgrounds
- `text` → `--theme-text` - Primary text color

### Computed Palette

Automatically derived in `computeThemePalette()`:

**Hover States:**
- `--theme-primary-hover` - Primary color lightened 15%
- `--theme-secondary-hover` - Secondary color lightened 15%

**Surface Variants** (luminance-aware, automatically reverse for light themes):
- `--surface-muted` - Surface darkened 6%
- `--surface-elevated` - Surface darkened/lightened 12% based on luminance

**Border Colors** (computed from surface with transparency):
- `--border-color` - rgba(surface ± 30%, 0.35 opacity)
- `--border-color-light` - rgba(surface ± 18%, 0.25 opacity)
- `--border-color-focus` - rgba(surface ± 40%, 0.5 opacity)
- `--ui-border-color` - Stronger border for RoundedUI (surface ± 45%)

**Text Colors** (automatic contrast calculation using WCAG luminance):
- `--button-text-color` - Contrasting text for secondary buttons (computed from `theme.secondary`)
- `--accent-text-color` - Contrasting text for primary buttons (computed from `theme.primary`)
- `--dialog-header-text-color` - Contrasting text for dialog headers (computed from `surfaceMuted`)
- `--container-text-color` - Contrasting text for containers (computed from `theme.surface`)

**Scrollbar Colors** (theme-aware, derived from primary):
- `--scrollbar-track-color` - Surface ± 10% based on luminance
- `--scrollbar-thumb-color` - Primary ± 8-12% based on luminance
- `--scrollbar-thumb-hover-color` - Primary ± 14-20% based on luminance
- `--scrollbar-thumb-active-color` - Primary ± 18-28% based on luminance

**Scrollbar Visibility** (config-driven):
- `--scrollbar-display` - Set to `none` when `HideScrollbars` config is enabled, `initial` otherwise. Apply to scrollbar elements to respect user preference.

**RoundedUI Variables** (when RoundedUI is enabled):
- `--ui-padding`, `--ui-border-radius`, `--ui-background`, `--ui-border`, `--ui-box-shadow`
- `--header-border-radius-top`, `--footer-border-radius-bottom`
- `--rounded-box-shadow` - Depth-aware shadow (varies by theme luminance)

**Legacy Compatibility Variables** (to be phased out):
- `--button-bg`, `--button-hover` - Deprecated, use `--theme-secondary` and `--theme-secondary-hover`

---

## Status Colors (Independent)

These colors are **not** derived from theme and maintain fixed values:
- `--error-color: #f44336` - Error states (defined in `index.css`)
- `--warning-color: #ff9800` - Warning states (defined in `index.css`)
- `--success-color: #00e676` - Success states (defined in `index.css`)

---

## CSS Variable Usage Rules

1. **NEVER hardcode colors** - Always use CSS variables with fallbacks:
   ```css
   /* ❌ BAD */
   background: #4285f4;
   color: #e0e0e0;

   /* ✅ GOOD */
   background: var(--theme-primary);
   color: var(--theme-text);
   ```

2. **Hover states** - Use computed hover variables:
   ```css
   /* ❌ BAD */
   .button:hover { background: #5a95f5; }

   /* ✅ GOOD */
   .button:hover { background: var(--theme-primary-hover); }
   ```

3. **Mixing colors** - Use CSS `color-mix()` for transparency (modern browsers):
   ```css
   /* ❌ BAD */
   background: rgba(66, 133, 244, 0.1);

   /* ✅ GOOD */
   background: color-mix(in srgb, var(--theme-primary) 10%, transparent);
   ```

4. **Borders with transparency** - Prefer computed border variables:
   ```css
   /* ✅ GOOD */
   border: 1px solid var(--border-color);
   ```

5. **Fallbacks** - Always provide fallbacks for compatibility:
   ```css
   color: var(--theme-text, #e0e0e0);
   background: var(--scrollbar-track-color, var(--surface-muted, #1a1a1a));
   ```

---

## Adding New Theme Variables

If you need a new computed color:
1. Add computation logic to `computeThemePalette()` in `src/shared/themeColorUtils.ts`
2. Add the new property to `ComputedThemePalette` interface in the same file
3. Inject it in `injectUIStyleVariables()` in `src/main/utils/CSSVariables.ts` within the `:root` CSS block
4. Document it in this section

**Example:**
```typescript
// In themeColorUtils.ts, add to computeThemePalette():
const surfaceHover = lightenColor(theme.surface, 8);

// Add to ComputedThemePalette interface:
export interface ComputedThemePalette {
  // ... existing properties
  surfaceHover: string;
}

// Return in computeThemePalette():
return {
  // ... existing properties
  surfaceHover,
};

// In CSSVariables.ts, inject the variable:
const cssVariables = `
  :root {
    /* ... existing variables */
    --surface-hover: ${palette.surfaceHover};
  }
`;
```

---

## Common Patterns

**Primary action buttons:**
```css
.primary-button {
  background: var(--theme-primary);
  color: var(--accent-text-color);
  border: none;
}
.primary-button:hover {
  background: var(--theme-primary-hover);
}
```

**Secondary/cancel buttons:**
```css
.secondary-button {
  background: var(--surface-elevated);
  color: var(--theme-text);
  border: 1px solid var(--border-color);
}
.secondary-button:hover {
  background: var(--surface-muted);
  border-color: var(--border-color-light);
}
```

**Status indicators:**
```css
.status.error { color: var(--error-color); }
.status.success { color: var(--success-color); }
.status.warning { color: var(--warning-color); }
```

**Interactive surface elements:**
```css
.card {
  background: var(--theme-surface);
  border: 1px solid var(--border-color);
}
.card:hover {
  background: var(--surface-elevated);
  border-color: var(--border-color-focus);
}
```

---

## Light Theme Support

The theme system automatically handles light/dark themes through **luminance-aware computations**:
- **Surface variants** reverse direction: dark themes lighten elevated surfaces, light themes darken them
- **Border colors** adjust strength: computed from surface with appropriate darkening/lightening based on `getLuminance(theme.surface) > 0.5`
- **Text colors** use WCAG contrast calculations via `getContrastingTextColor()` (returns `#111111` for light backgrounds, `#ffffff` for dark)
- **Scrollbar colors** derive intelligently from primary color luminance

**Test all UI changes with both light and dark themes** to ensure proper contrast and visibility. Use Settings → Desktop Theme to switch between built-in profiles.

### Built-in Theme Profiles

The system includes 8 built-in theme profiles (defined in `SYSTEM_THEME_PROFILES`):

**Dark Themes:**
- **Fluidd** - Klipper-style dark blue theme
- **Mainsail** - Red accent on dark gray
- **Solarized Dark** - Classic Solarized color palette
- **Monokai** - Popular editor syntax theme

**Light Themes:**
- **Aurora Light** - Clean blue on white
- **Glacial Prism** - Icy blue tones on pure white
- **Sandstone Dawn** - Warm terracotta accents
- **Sage Studio** - Natural green tones

---

## Detecting Hardcoded CSS

Use the **`detect-hardcoded-css`** Go tool (`scripts/detect-hardcoded-css.go`) to scan for hardcoded color values that need migration:

**Quick full scan:**
```bash
go run ./scripts/detect-hardcoded-css.go --summary
```

**Scan specific areas:**
```bash
# WebUI CSS files only, show hex + rgb
go run ./scripts/detect-hardcoded-css.go \
  --path-include src/webui \
  --match-types hex,rgb

# Find specific color usage
go run ./scripts/detect-hardcoded-css.go \
  --line-contains "#4285f4"

# Scan TypeScript/CSS files in ui/ directory
go run ./scripts/detect-hardcoded-css.go \
  --path-include src/ui \
  --ext .css,.ts
```

The tool:
- Detects hex literals (`#4285f4`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, gradients, and named colors
- Ignores colors already wrapped in `var(...)` (fallbacks are OK)
- Skips comments to avoid false positives
- Supports filtering by file type, path patterns, and match types

See `scripts/detect-hardcoded-css.md` for full documentation and flag reference.
