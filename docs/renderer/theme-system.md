# Theme System

**NEVER hardcode colors** in CSS or inline styles. All colors come from theme CSS
variables; the system derives the full palette from 5 user-configurable base colors
and handles light/dark automatically.

## Core files (all verified)

| File | Role |
| --- | --- |
| `src/shared/themeColorUtils.ts` | Pure color math (`lightenColor`, `darkenColor`, `hexToRgba`, `getLuminance`, `getContrastingTextColor`) + central `computeThemePalette()` |
| `src/main/utils/CSSVariables.ts` | Injects computed variables into all BrowserWindows (theme + RoundedUI) |
| `src/renderer/src/index.css` | `:root` declarations, fallbacks, legacy compatibility variables |
| `src/shared/types/config.ts` | `ThemeColors` (5 base colors) + `DEFAULT_THEME` |
| `src/main/utils/RoundedUICompatibility.ts` | RoundedUI platform gates (blocked on macOS + Windows 11); use `isRoundedUISupported()` |
| `src/renderer/src/ui/shared/theme-utils.ts` | `applyDialogTheme()` — the standard pattern ALL dialog renderers use |
| `src/main/webui/static/features/layout-theme.ts` | WebUI client theme profile CRUD + application |

## Palette

Base (user-configurable): `--theme-primary`, `--theme-secondary`,
`--theme-background`, `--theme-surface`, `--theme-text`.

Computed by `computeThemePalette()`:

- Hover: `--theme-primary-hover`, `--theme-secondary-hover` (+15%)
- Surfaces (luminance-aware, reverse for light themes): `--surface-muted` (±6%),
  `--surface-elevated` (±12%)
- Borders: `--border-color`, `--border-color-light`, `--border-color-focus`,
  `--ui-border-color` (RoundedUI)
- Text contrast (WCAG luminance): `--button-text-color`, `--accent-text-color`,
  `--dialog-header-text-color`, `--container-text-color`
- Scrollbars: `--scrollbar-track/thumb/thumb-hover/thumb-active-color`;
  `--scrollbar-display` honors the `HideScrollbars` config
- RoundedUI: `--ui-padding`, `--ui-border-radius`, `--ui-background`, `--ui-border`,
  `--rounded-box-shadow`, header/footer radii
- Legacy (phase out): `--button-bg`, `--button-hover`

Status colors are NOT theme-derived (fixed in `index.css`): `--error-color`,
`--warning-color`, `--success-color`.

## Usage rules

```css
background: var(--theme-primary);                     /* not #4285f4 */
.button:hover { background: var(--theme-primary-hover); }
background: color-mix(in srgb, var(--theme-primary) 10%, transparent); /* not rgba() */
border: 1px solid var(--border-color);
```

## Hardcoded-CSS scanner

`scripts/detect-hardcoded-css.go` + `scripts/css-scanner-whitelist.json` (global
patterns like `transparent`/`white` + file-specific exemptions for color pickers,
filament swatches, accessibility). Run it before theme-heavy PRs; extend the
whitelist only with justification.
