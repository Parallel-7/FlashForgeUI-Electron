# CSS Migration Spec: palette.css

**Status:** 🔴 NOT STARTED
**File:** `src/ui/palette/palette.css`
**Priority:** Medium
**Patterns Found:** 9 hardcoded color patterns

## Pattern Breakdown

### Category 1: White/Light Overlays (1 pattern)
**Line 69** - Header border:
```css
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
```

### Category 2: Dark Shadow/Background (5 patterns)
**Line 79** - Title text shadow:
```css
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
```

**Line 158** - Scrollbar track background:
```css
background: rgba(30, 30, 30, 0.5);
```

**Line 190** - Hover box shadow:
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
```

**Line 204** - Icon box shadow:
```css
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
```

### Category 3: Muted Text Colors (2 patterns)
**Line 280** - Loading state text:
```css
color: #888;
```

**Line 290** - Empty state text:
```css
color: #999;
```

### Category 4: Error Text (1 pattern)
**Line 294** - Error state text:
```css
color: #f8b4b4;
```

### Category 5: Primary Focus Outline (1 pattern)
**Line 313** - Accessibility focus outline:
```css
outline: 2px solid rgba(74, 144, 226, 0.8);
```

---

## Migration Strategy

### Category 1: White/Light Overlays → `color-mix()` with `--theme-text`

**Before:**
```css
.palette-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
```

**After:**
```css
.palette-header {
  border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
}
```

**Rationale:** Light overlay borders should adapt to theme text color for proper contrast in both light/dark themes.

---

### Category 2: Dark Shadow/Background → `color-mix()` with `--theme-background`

**Before:**
```css
.palette-title {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.component-list::-webkit-scrollbar-track {
  background: rgba(30, 30, 30, 0.5);
}

.palette-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.palette-item-icon {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
```

**After:**
```css
.palette-title {
  text-shadow: 0 1px 2px color-mix(in srgb, var(--theme-background) 20%, black);
}

.component-list::-webkit-scrollbar-track {
  background: var(--scrollbar-track-color);
}

.palette-item:hover {
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-background) 25%, black);
}

.palette-item-icon {
  box-shadow: 0 2px 6px color-mix(in srgb, var(--theme-background) 20%, black);
}
```

**Rationale:**
- Shadows should use theme-aware darkening via `color-mix()`
- Scrollbar track should use existing computed `--scrollbar-track-color` variable (defined in theme system)

---

### Category 3: Muted Text Colors → `color-mix()` with `--theme-text`

**Before:**
```css
.component-list.loading::after {
  color: #888; /* 53% opacity gray */
}

.component-list-empty {
  color: #999; /* 60% opacity gray */
}
```

**After:**
```css
.component-list.loading::after {
  color: color-mix(in srgb, var(--theme-text) 53%, transparent);
}

.component-list-empty {
  color: color-mix(in srgb, var(--theme-text) 60%, transparent);
}
```

**Rationale:** Muted text states should adapt to theme text color with appropriate opacity for hierarchy.

---

### Category 4: Error Text → `--error-color`

**Before:**
```css
.component-list-error {
  color: #f8b4b4; /* Light pink error */
}
```

**After:**
```css
.component-list-error {
  color: var(--error-color);
}
```

**Rationale:** Error states should use the semantic `--error-color` variable for consistency across the application.

---

### Category 5: Primary Focus Outline → `color-mix()` with `--theme-primary`

**Before:**
```css
.close-btn:focus,
.palette-item:focus,
.palette-item-action:focus {
  outline: 2px solid rgba(74, 144, 226, 0.8);
}
```

**After:**
```css
.close-btn:focus,
.palette-item:focus,
.palette-item-action:focus {
  outline: 2px solid color-mix(in srgb, var(--theme-primary) 80%, transparent);
}
```

**Rationale:** Accessibility focus outlines should use the user's primary theme color with 80% opacity.

---

## Implementation Checklist

### Agent Responsibilities:
- [ ] Migrate all 9 hardcoded patterns to theme variables
- [ ] Use `color-mix()` for transparency instead of `rgba()`
- [ ] Use `--scrollbar-track-color` instead of hardcoded scrollbar background
- [ ] Use `--error-color` for error state text
- [ ] Verify with scanner: `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/palette`
- [ ] Notify user when coding is complete

### User Responsibilities:
- [ ] Run type checking: `npm run type-check`
- [ ] Run webpack build: `npm run build:renderer`
- [ ] Run linting: `npm run lint`
- [ ] Test palette window in both light and dark themes
- [ ] Verify component hover states, focus outlines, and loading/error states
- [ ] Ensure scrollbar styling works correctly

---

## Expected Visual Result

**Dark Theme:**
- Header border uses light text color with 10% opacity
- Shadows remain dark, adapting to theme background
- Scrollbar track uses computed scrollbar color
- Muted text states maintain hierarchy with 53-60% opacity
- Error text uses semantic error color (red)
- Focus outlines use primary accent color with 80% opacity

**Light Theme:**
- Header border adapts to dark text color with 10% opacity
- Shadows lighten automatically via `color-mix()` with theme background
- Scrollbar track adapts to light theme
- Muted text maintains proper contrast
- Error text remains visible with semantic error color
- Focus outlines use primary color, maintaining accessibility

**Benefits:**
- All colors adapt to user theme preferences
- Proper contrast maintained in both light/dark modes
- Consistent use of semantic colors (error)
- Enhanced accessibility with theme-aware focus states
- Scrollbar styling uses centralized theme system

---

## Testing Notes

**Focus on:**
1. Palette window appearance in light vs dark themes
2. Component hover effects (shadow should adapt)
3. Loading/empty/error state text visibility
4. Scrollbar visibility and contrast
5. Keyboard focus outlines (Tab navigation)
6. Icon shadows maintaining depth

**Edge Cases:**
- Ensure scrollbar track remains visible but subtle
- Verify focus outlines meet WCAG contrast requirements
- Test with custom theme colors (non-default primary)
