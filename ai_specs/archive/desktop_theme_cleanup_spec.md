# Desktop Theme Cleanup (Desktop UI Only)

## Objective
- Remove gradient backgrounds and hard-coded gray fills from all Electron renderer surfaces so every component and dialog respects the dynamic theme colors configured in `AppConfig`.
- Align button styling with the shared dialog template so primary/secondary states draw directly from theme tokens rather than scattered overrides.
- Provide a repeatable approach for future dialogs/components without touching WebUI assets (per user clarification).

## Scope
- **In-scope:** Electron renderer styles under `src/index.css`, `src/ui/**/*`, shared dialog template, and any component CSS referenced by the desktop UI (GridStack widgets, dialogs, component dialogs, palette/settings infrastructure).
- **Out-of-scope:** WebUI (`src/webui/**`), headless server styles, and any RTSP/web routes. These will be handled later.

## Existing Theme Infrastructure (for reference)
- Desktop themes are applied at runtime via `applyDesktopTheme` in `src/renderer.ts:482-507`, which sets `--theme-primary`, `--theme-background`, etc. on `document.documentElement`.
- Dialog windows receive their variables from `src/utils/CSSVariables.ts:15-57`. Currently `--container-background` is hard-coded to `#3a3a3a` even though the dialog template expects theme-driven colors.
- `src/index.css:1-58` defines derived tokens such as `--card-bg`, `--border-color`, `--accent-color`, and `--shadow-*`. Components should reuse these tokens instead of defining bespoke hex literals.
- The shared dialog template (`src/ui/shared/rounded-dialog-template.css:16-225`) already references `var(--container-background)`/`var(--theme-surface)` but still hard-codes hover/active states to `#777/#555`, which causes mismatched buttons when dialogs try to override only the primary action.

## Tooling Support
- Use `scripts/detect-hardcoded-css.go` (documented in `scripts/detect-hardcoded-css.md`) to inventory every literal color/gradient across the renderer before touching CSS. This CLI strips comments, ignores `var()` fallbacks, and reports file/line info so you can prioritize components that still bypass theme tokens.
- Primary workflows:
  - `go run ./scripts/detect-hardcoded-css.go --path-include src/ui --ext ".css" --match-types hex,rgb,gradient` to focus on renderer CSS files.
  - `go run ./scripts/detect-hardcoded-css.go --summary` for a quick regression check after edits. Set `GOCACHE=$(pwd)/.cache/go-build` if needed.
- Keep results archived per session (drop a snippet in the PR description or spec notes) so future passes can see which directories were already sanitized versus those that still emit matches.

## Current Issues & File References

### Global / Shared Styles
| Area | File:Lines | Details |
| --- | --- | --- |
| Empty grid placeholder | `src/index.css:95-120` | Uses a radial gradient background unaligned with the active theme. |
| Scrollbar skins | `src/index.css:613-636` | Linear gradients for scrollbar thumbs persist even when the theme expects flat fills. |
| GridStack panels | `src/ui/gridstack/gridstack.css:1-220` | Every widget (`.grid-stack-item-content`), edit-mode indicator, and resize handle draws a gradient (e.g., lines 29-40, 96-117, 205-220). |
| Component dialogs | `src/ui/component-dialog/component-dialog.css:170-185` | Scrollbar thumbs are multi-stop gradients; the window background inherits from global CSS but still assumes grays elsewhere. |
| Shared log panel | `src/ui/shared/log-panel/log-panel.shared.css:11-40` and `src/ui/log-dialog/log-dialog.css:60-96` | Panels and headers use gradient fills plus rgba black overlays, ignoring theme surfaces. |

### Dialogs / Screens Called Out by the User
- **Settings Menu** — `src/ui/settings/settings.css:11-235`
  - Local `:root` block redefines palette constants (`--dark-bg`, `--border-color`, `--button-bg`) to fixed grays and blues, preventing inheritance from the desktop theme.
  - `.tab-panels`, `.settings-tab-button`, and `.dialog-button` (lines 49-235) rely on rgba whites and #666/#777 button fills, so only the “Save” button ever sees `var(--button-bg)`.
  - Color picker header uses a gradient swatch (`line 488`).
- **About Menu** — `src/ui/about-dialog/about-dialog.css:18-137`
  - Icon, info cards, and link cards are all hard-coded (#1f1f1f, #3a3a3a, rgba white). No theme variables are referenced, so the dialog always appears gray.
- **IFS Dialog** — `src/ui/ifs-dialog/ifs-dialog.css:10-195`
  - Body/container backgrounds are literal (#3a3a3a, #353535, #2a2a2a) with a bespoke `:root` palette (lines 15-24). Slot tiles and hover states stay gray across themes.
- **Printer Connected Warning** — `src/ui/printer-connected-warning/printer-connected-warning.css:18-126`
  - Buttons rely on local `--button-bg` / `--cancel-bg` (#666, #777) and warnings colors are inline. Dialog container inherits template defaults but still renders mismatched secondary buttons.
- **Server Status Dialog** — `src/ui/status-dialog/status-dialog.css:21-165`
  - Tabs, cards, and sections use rgba overlays on `#1e1e1e` backgrounds plus `#444` borders, so the theme configuration has no effect.
- **Set Temperature Dialogs** — `src/ui/components/temperature-controls/temperature-controls.css:16-200` and `src/ui/input-dialog/input-dialog.css:5-58`
  - The component cards, status rows, and action buttons are gradient-heavy (#2d/#33 etc.). The actual numeric input dialog redefines `:root` with #2a backgrounds and #666 cancel buttons.
- **Upload Job** — `src/ui/job-uploader/job-uploader.css:18-212` & `359-386`
  - Both columns, file rows, and progress controls use #353/#2a backgrounds, blue-specific gradients (`line 359`), and `--blue` tokens unrelated to the theme.
- **Select Job (Recent/Local)** — `src/ui/job-picker/job-picker.css:18-212`
  - `:root` mirrors the old palette (#2a/#1e). Buttons (lines 163-211) use #666 defaults, and selection states rely on rgba(66,133,244,0.2) regardless of theme.
- **Command Terminal** — `src/ui/send-cmds/send-cmds.css:14-76`
  - `:root` locks background colors to #2a/#1e. Borders, inputs, and even `log-entry` colors are absolute hexes.
- **Connect to Printer + Auto Connect** — `src/ui/connect-choice-dialog/connect-choice-dialog.css:30-146` and `src/ui/auto-connect-choice/auto-connect-choice.css:32-167`
  - Option cards use #4a/#353 backgrounds with borders at #555. “Recommended” buttons add blue gradients (lines 91-100) totally independent of the theme.

### Other Desktop Components with Gradients
- **Component palette & palette buttons** (`src/ui/palette/palette.css:63-267`) still default to gradient backgrounds even though the palette editor rewrites theme colors.
- **Camera Preview / Job Stats / Additional Info / Controls Grid / Printer Status / Printer Tabs** — Each component CSS under `src/ui/components/**` contains multiple gradient declarations. Example: camera preview overlays at `src/ui/components/camera-preview/camera-preview.css:75-182`, temperature controls (lines 16-182 noted above), controls grid buttons (`src/ui/components/controls-grid/controls-grid.css:17-86`), etc.
- These components sit inside GridStack cards, so removing gradients from both the cards and the component interiors is necessary to achieve a flat, uniform appearance.

### Button Style Divergence
- The shared template (`src/ui/shared/rounded-dialog-template.css:174-222`) uses literal #777/#555 for default/hover states, which clashes once backgrounds are theme-driven.
- Many dialogs duplicate button rules (`settings.css:191-235`, `job-picker.css:163-211`, `connect-choice-dialog.css:122-146`), leading to inconsistent focus/hover colors and requiring extra overrides for the “primary” button.

## Proposed Remediation Plan

1. **Extend Theme Tokens**
   - Update `src/utils/CSSVariables.ts:33-50` so `--container-background` and (optionally) new helper tokens such as `--surface-muted` and `--surface-elevated` originate from `theme.surface` / `theme.background`. This ensures dialogs default to the user’s palette even before per-dialog overrides.
   - Consider updating `src/types/config.ts:36-40` comments so `ThemeColors.secondary` no longer references “gradient end” (helps set expectations going forward).

2. **Normalize Button Styling**
   - Adjust the shared dialog template to:
     - Use `var(--theme-surface)`/`var(--theme-text)` for the default button background/foreground.
     - Derive hover/active fills via CSS color-mix or rely on the existing `--theme-primary-hover` for primary buttons.
     - Expose a `--button-border-color` token so dialogs rarely need local overrides.
   - Delete redundant `.dialog-button` / `.btn-secondary` blocks in individual dialog CSS files and rely on template defaults, only customizing layout (spacing/order).

3. **Replace Gradients with Solid Theme Surfaces**
   - Global surfaces:
     - `src/index.css`: replace the radial placeholder background and scrollbar gradients with single-color fills derived from `--card-bg`/`--border-color`.
     - `src/ui/gridstack/gridstack.css`: use `var(--card-bg)` / `var(--card-bg-hover)` for widgets, `var(--accent-color)` only for outlines, and flatten edit-mode indicators/resize handles.
     - `src/ui/component-dialog/component-dialog.css` and `src/ui/shared/log-panel/log-panel.shared.css`: flatten scrollbars and panel backgrounds.
   - Component CSS (non-dialog):
     - For each component with gradients (temperature controls, camera preview, controls grid, job stats, additional info, printer status, printer tabs, palette), replace gradient declarations with `var(--card-bg)`, `var(--theme-surface)`, or lightly tinted overlays using rgba + theme tokens.
     - Remove ad-hoc `:root` variables when they simply restate colors (e.g., `--slot-bg` in `ifs-dialog.css`) and replace with existing derived variables plus status colors already defined in `src/index.css`.

4. **Refactor Each Requested Dialog**
   - **Settings (`src/ui/settings/settings.css`)**: delete the local `:root` block; use `var(--theme-surface)`/`var(--border-color)` for tabs/panels; convert `.dialog-button` to rely on template styling; switch the color-picker header to `var(--theme-primary)` without gradients.
   - **About (`src/ui/about-dialog/about-dialog.css`)**: map icon, cards, and link backgrounds to theme tokens (e.g., `var(--theme-surface)` for cards, `color-mix` for subtle hover). Replace rgba overlays with `var(--border-color)`.
   - **IFS (`src/ui/ifs-dialog/ifs-dialog.css`)**: bind container and slot backgrounds to `var(--theme-surface)` / `var(--card-bg)`. Instead of `--slot-bg`, re-use derived tokens and keep status colors as provided by the theme (accent, error, warning). Ensure spool highlights rely on `var(--accent-color)`.
   - **Printer Connected Warning (`src/ui/printer-connected-warning/printer-connected-warning.css`)**: remove the rigid button palette; let the template style cancel buttons via `--theme-surface`, and only use warning colors for icons/text.
   - **Status dialog (`src/ui/status-dialog/status-dialog.css`)**: convert rgba backgrounds to `var(--theme-surface)` (with optional `color-mix`/opacity) and replace `#444` borders with `var(--border-color)`.
   - **Temperature input**: update both `src/ui/components/temperature-controls/temperature-controls.css` and `src/ui/input-dialog/input-dialog.css` so cards, fan rows, and input backgrounds reference `var(--card-bg)`/`var(--theme-surface)` with simple opacity overlays—no gradients.
   - **Job Uploader / Job Picker / Command Terminal**: remove their custom `:root` palettes and adopt the shared tokens. Replace progress bar gradients with single-color fills (primary/secondary). Ensure text colors use `var(--text-color)` or the secondary variant.
   - **Connect Choice + Auto Connect**: convert `.choice-button` / `.option-button` backgrounds to `var(--theme-surface)`; express hover via `color-mix` or `var(--border-color-focus)`. For “primary/recommended” actions, rely on `.dialog-button.primary` or add a `data-variant` class that uses `var(--accent-color)` for a flat fill instead of gradients.

5. **Document + Guard Rails**
   - Record the agreed theme tokens and guidance inside `docs/README.md` or a new entry in `ai_reference/ARCHITECTURE.md` so future contributors avoid gradients.
   - Bake the new `detect-hardcoded-css` workflow into reviews: call out the command variants above and ensure diffs include “before/after” snippets from the tool so regressions are immediately visible without manually re-auditing files.

## Detailed File Checklist

| File/Directory | Action Items |
| --- | --- |
| `src/utils/CSSVariables.ts` | Tie `--container-background`, `--ui-background` fallbacks, and button variables to theme colors; drop hard-coded `#3a3a3a`. |
| `src/index.css` | Remove radial background + scrollbar gradients; ensure derived tokens support multiple elevation levels (`--surface-muted`, etc.) for components to consume. |
| `src/ui/gridstack/gridstack.css` | Flat fill for `.grid-stack-item-content`, edit mode indicator, buttons, and resize handles; rely on `--accent-color` only for outlines. |
| `src/ui/shared/rounded-dialog-template.css` | Update button hover/active colors to use theme tokens; ensure body/container backgrounds align with theme; document how dialogs can opt into alternative surfaces without re-declaring `:root`. |
| `src/ui/settings/settings.css` | Remove local theme palette; express tabs/panels/button states with theme tokens; flatten color picker header. |
| `src/ui/about-dialog/about-dialog.css` | Migrate backgrounds/borders to `var(--theme-surface)`/`var(--border-color)`; keep highlight colors derived from `--accent-color`. |
| `src/ui/ifs-dialog/ifs-dialog.css` | Replace `:root` palette with theme tokens; convert slot and spool backgrounds to theme-derived solids; keep status colors referencing `var(--error-color)` etc. from `src/index.css`. |
| `src/ui/printer-connected-warning/printer-connected-warning.css` | Ensure warning icon uses theme status colors but buttons rely on template defaults; background should match `var(--theme-surface)`. |
| `src/ui/status-dialog/status-dialog.css` | Replace rgba overlays with theme surfaces; rely on `var(--border-color)` and text tokens. |
| `src/ui/components/temperature-controls/temperature-controls.css` & `src/ui/input-dialog/input-dialog.css` | Flatten cards/buttons; remove gradients; ensure disabled/hot states rely on theme colors. |
| `src/ui/job-uploader/job-uploader.css` | Replace `#353/#2a` backgrounds and `--blue` references with theme tokens; flatten progress bars. |
| `src/ui/job-picker/job-picker.css` | Remove local `:root`, share template button styles, and make selection highlight use `var(--accent-color)` with opacity or border. |
| `src/ui/send-cmds/send-cmds.css` | Use `var(--theme-surface)` for log + inputs; rely on shared button styles for submit/cancel. |
| `src/ui/connect-choice-dialog/*.css` & `src/ui/auto-connect-choice/auto-connect-choice.css` | Flatten cards, drop gradients, and style recommended buttons with theme tokens. |
| `src/ui/palette/palette.css` | Replace gradient backgrounds for palette headers/buttons with flat `var(--theme-primary)` / lighten variants. |
| `src/ui/shared/log-panel/log-panel.shared.css` | Use `var(--card-bg)` + border tokens; keep scroll area backgrounds simple. |

## Testing & Validation
1. Run `npm run type-check` (ensures any TS touched—e.g., `CSSVariables.ts`—still compiles).
2. Run `npm run lint`.
3. Run `npm run linecount` (per repo expectations) after large CSS edits.
4. Run `go run ./scripts/detect-hardcoded-css.go --path-include src/ui --ext ".css" --match-types hex,rgb,gradient --summary` to confirm gradients and literal fills are gone; repeat without `--summary` if you need per-line output for the PR notes.
5. Smoke-test dialogs manually if possible (launching the Electron app) focusing on:
   - Settings, About, IFS, Server Status, Printer Connected Warning.
   - Job uploader/picker, command terminal, connect dialogs.
   - GridStack components (temperature controls, camera preview) in both normal and edit mode.
6. Verify RoundedUI on/off modes so transparent windows still look correct with the new theme tokens.

## Risks / Open Questions
- **Theme contrast:** Flattening gradients removes faux depth; ensure `var(--theme-surface)` vs. `var(--card-bg)` still provide enough contrast. May need to introduce additional derived tokens (e.g., `--surface-raised`) computed from theme colors.
- **Legacy references:** Some dialogs (e.g., palette editor) expect `--theme-primary` to be a gradient fallback; confirm no code depends on that assumption before replacing with solid colors.
- **Button semantics:** After centralizing button styling, confirm that dialogs that previously highlighted “danger” actions (e.g., auto-connect cancel, job delete) still convey affordances—might need a standardized `.dialog-button.danger` variant tied to `--error-color`.
- **RoundedUI transparency:** When `RoundedUI` is on, body backgrounds become transparent. Ensure new surface tokens look acceptable over translucent windows; we might need to keep a slight alpha overlay to avoid showing desktop wallpaper behind dialogs.

This spec captures every desktop asset currently using gradients or hard-coded grays so future Codex sessions can implement the cleanup directly without re-auditing the files.***
