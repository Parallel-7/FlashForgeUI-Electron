# CSS Migration Spec: rounded-dialog-template.css

**Status:** ✅ COMPLETED
**File:** `src/ui/shared/rounded-dialog-template.css`
**Total Patterns:** 2 patterns (both need migration)
**Priority:** HIGH - Shared template used by ALL dialogs across the application
**Impact:** This file is the foundation for all dialog styling, so changes will affect every dialog window

## Pattern Breakdown

- **Hex colors:** 1 pattern
- **RGB/RGBA:** 1 pattern
- **Named colors:** 0 patterns

## CRITICAL: Shared Template Warning

This CSS file is used as a template for ALL dialogs in the application via `@import url('../shared/rounded-dialog-template.css')`. Changes to this file will affect:
- Settings dialog
- Spoolman dialogs
- Material dialogs
- Job picker dialogs
- Upload dialogs
- Component dialogs
- All other modal windows

**Extra care must be taken to ensure visual consistency across all consuming dialogs.**

## Migration Strategy

### Category 1: Text Shadow (1 pattern)

Text shadow for dialog title headers to provide depth:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 89 | `rgba(0, 0, 0, 0.2)` | `color-mix(in srgb, var(--theme-background) 20%, black)` | Dialog title text shadow for depth |

**Rationale:** This is a subtle shadow behind dialog titles. Using `color-mix()` with the theme background ensures the shadow adapts to both light and dark themes. In dark themes, the shadow will be darker; in light themes, it will be appropriately lighter.

**Before:**
```css
.dialog-header h2,
.dialog-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    -webkit-app-region: no-drag;
}
```

**After:**
```css
.dialog-header h2,
.dialog-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    text-shadow: 0 1px 2px color-mix(in srgb, var(--theme-background) 20%, black);
    -webkit-app-region: no-drag;
}
```

### Category 2: High Contrast Accessibility Border (1 pattern)

Border color override for high contrast mode accessibility:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 239 | `#ffffff` | `var(--theme-text)` | Dialog border for prefers-contrast: high media query |

**Rationale:** This border color is only applied when the user has enabled high contrast mode (`@media (prefers-contrast: high)`). Using `var(--theme-text)` ensures maximum contrast against the dialog background in both light and dark themes. In dark themes, `--theme-text` is white; in light themes, it's black.

**Before:**
```css
/* High contrast accessibility support */
@media (prefers-contrast: high) {
    .dialog-container {
        border-color: #ffffff;
    }
}
```

**After:**
```css
/* High contrast accessibility support */
@media (prefers-contrast: high) {
    .dialog-container {
        border-color: var(--theme-text);
    }
}
```

## Implementation Checklist

- [x] Migrate text shadow on line 89 → `color-mix(in srgb, var(--theme-background) 20%, black)`
- [x] Migrate high contrast border on line 239 → `var(--theme-text)`
- [x] User to run: `npm run type-check`
- [x] User to run: `npm run build:renderer`
- [x] User to run: `npm run lint`
- [x] Verify with hardcoded CSS scanner: `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/shared/rounded-dialog-template.css`
- [ ] **CRITICAL:** Test multiple dialogs to ensure no visual regressions:
  - [ ] Settings dialog
  - [ ] Spoolman selection dialog
  - [ ] Material info dialog
  - [ ] Job picker dialog
  - [ ] Upload dialog
- [ ] User to test with light and dark themes
- [ ] User to test with high contrast mode (Windows accessibility settings or browser DevTools emulation)

## Expected Behavior

**Text Shadow (Line 89):**
- Dark themes: Shadow will be appropriately dark, providing subtle depth to dialog titles
- Light themes: Shadow will be lighter, maintaining readability against light backgrounds
- No visual change to existing dark theme users (shadow remains dark)

**High Contrast Border (Line 239):**
- Dark themes with high contrast mode: Border will be white (from `--theme-text`)
- Light themes with high contrast mode: Border will be black (from `--theme-text`)
- Standard mode (not high contrast): No change - this rule only applies in high contrast mode

## Testing Notes

### Visual Regression Testing Required

Since this is a shared template, thorough visual testing is essential:

1. **Open each dialog type and verify:**
   - Dialog title text shadow looks appropriate (not too harsh, not invisible)
   - High contrast mode border is clearly visible and provides good contrast

2. **Test theme switching:**
   - Switch from Dark Blue to Light theme
   - Verify all dialogs render correctly
   - Verify text shadows remain subtle but visible

3. **Test high contrast mode:**
   - Enable Windows high contrast mode (if available)
   - Open several dialogs
   - Verify dialog borders are clearly visible with maximum contrast

### Browser DevTools Testing

Use browser DevTools to emulate high contrast mode:
1. Open DevTools (F12)
2. Open Rendering tab (Ctrl+Shift+P → "Show Rendering")
3. Under "Emulate CSS media feature prefers-contrast", select "more"
4. Verify dialog borders use appropriate text color

## Common Patterns Reference

```css
/* Black shadow with opacity */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); /* BEFORE */
text-shadow: 0 1px 2px color-mix(in srgb, var(--theme-background) 20%, black); /* AFTER */

/* High contrast border (accessibility) */
border-color: #ffffff; /* BEFORE */
border-color: var(--theme-text); /* AFTER */
```

## Notes

- This template is imported by many CSS files via `@import url('../shared/rounded-dialog-template.css')`
- The template uses CSS variables injected by `CSSVariables.ts` for RoundedUI support
- Text shadow is subtle but important for visual hierarchy in dialogs
- High contrast mode support is critical for accessibility compliance
- Changes should maintain visual consistency with existing dark theme appearance
- Light theme support is a bonus, but dark theme is the primary use case currently
