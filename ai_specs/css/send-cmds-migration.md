# CSS Migration Spec: send-cmds.css

**Status:** ⏳ PENDING
**File:** `src/ui/send-cmds/send-cmds.css`
**Total Patterns:** 13 hardcoded colors
**Priority:** MEDIUM - Send G-code commands terminal dialog

## Pattern Breakdown

- **Hex colors:** 12 patterns
- **RGB/RGBA:** 1 pattern
- **Named colors:** 0 patterns

## Migration Strategy

### Category 1: Custom CSS Variables (4 patterns in :root block)

Lines 14-19 define legacy custom variables that should be removed after migrating their usages:

| Line | Variable | Current Value | Replacement Strategy |
|------|----------|---------------|---------------------|
| 15 | `--button-bg` | `#4285f4` | Replace all usages with `var(--theme-primary)` |
| 16 | `--button-hover` | `#5a95f5` | Replace all usages with `var(--theme-primary-hover)` |
| 17 | `--input-bg` | `#2a2a2a` | Replace with `var(--surface-muted)` |
| 18 | `--log-bg` | `#1e1e1e` | Replace with `var(--theme-background)` |

**Action:** After migrating all usages, DELETE the entire `:root` block (lines 14-19).

### Category 2: Direct Hex Color Usage (8 patterns)

Hardcoded colors used directly in styles:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 34 | `#555` | `var(--border-color)` | Log area border |
| 52 | `#555` | `var(--border-color)` | Command input border |
| 39 | `#ffffff` | `var(--theme-text)` | Log area text color |
| 53 | `#ffffff` | `var(--theme-text)` | Command input text color |
| 88 | `#4DACFF` | `var(--theme-primary)` | Command entry color (blue) |
| 93 | `#00FF00` | `var(--success-color)` | Response entry color (green) |
| 97 | `#FF6666` | `var(--error-color)` | Error entry color (red) |
| 102 | `#CCCCCC` | `color-mix(in srgb, var(--theme-text) 75%, transparent)` | Info entry color (gray) |

### Category 3: RGBA Pattern (1 pattern)

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 63 | `rgba(66, 133, 244, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Input focus shadow |

## Legacy Variable Usage Map

Track where legacy variables are used and what they should become:

### `--button-bg` usages:
- Line 62: `#command-input:focus` border → `var(--theme-primary)`
- Line 68: `.dialog-button` background → `var(--theme-primary)`
- Line 69: `.dialog-button` border → `var(--theme-primary)`

### `--button-hover` usages:
- Line 74: `.dialog-button:hover` background → `var(--theme-primary-hover)`
- Line 75: `.dialog-button:hover` border → `var(--theme-primary-hover)`

### `--input-bg` usages:
- Line 51: `#command-input` background → `var(--surface-muted)`

### `--log-bg` usages:
- Line 33: `.log-area` background → `var(--theme-background)`

## Implementation Checklist

- [ ] Replace 3 `--button-bg` usages → `var(--theme-primary)`
- [ ] Replace 2 `--button-hover` usages → `var(--theme-primary-hover)`
- [ ] Replace 1 `--input-bg` usage → `var(--surface-muted)`
- [ ] Replace 1 `--log-bg` usage → `var(--theme-background)`
- [ ] Migrate 8 direct hex color patterns
- [ ] Migrate 1 RGBA focus shadow pattern
- [ ] **DELETE entire :root block** (lines 14-19) after all migrations
- [ ] User to run: `npm run type-check`
- [ ] User to run: `npm run build:renderer`
- [ ] User to run: `npm run lint`
- [ ] Verify with `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/send-cmds`

## Migration Details

### Step 1: Replace Legacy Variable Usages

**Before:**
```css
/* Line 33 - Log area background */
background-color: var(--log-bg);

/* Line 51 - Command input background */
background-color: var(--input-bg);

/* Line 62 - Input focus border */
border-color: var(--button-bg);

/* Line 68-69 - Primary button */
background-color: var(--button-bg);
border-color: var(--button-bg);

/* Line 74-75 - Primary button hover */
background-color: var(--button-hover);
border-color: var(--button-hover);
```

**After:**
```css
/* Line 33 - Log area background */
background-color: var(--theme-background);

/* Line 51 - Command input background */
background-color: var(--surface-muted);

/* Line 62 - Input focus border */
border-color: var(--theme-primary);

/* Line 68-69 - Primary button */
background-color: var(--theme-primary);
border-color: var(--theme-primary);

/* Line 74-75 - Primary button hover */
background-color: var(--theme-primary-hover);
border-color: var(--theme-primary-hover);
```

### Step 2: Migrate Direct Hex Colors

**Before:**
```css
/* Line 34 - Log area border */
border: 1px solid #555;

/* Line 39 - Log area text */
color: #ffffff;

/* Line 52 - Command input border */
border: 1px solid #555;

/* Line 53 - Command input text */
color: #ffffff;

/* Line 63 - Input focus shadow */
box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);

/* Line 88 - Command entry (sent commands) */
color: #4DACFF;

/* Line 93 - Response entry (printer responses) */
color: #00FF00;

/* Line 97 - Error entry (error messages) */
color: #FF6666;

/* Line 102 - Info entry (system info) */
color: #CCCCCC;
```

**After:**
```css
/* Line 34 - Log area border */
border: 1px solid var(--border-color);

/* Line 39 - Log area text */
color: var(--theme-text);

/* Line 52 - Command input border */
border: 1px solid var(--border-color);

/* Line 53 - Command input text */
color: var(--theme-text);

/* Line 63 - Input focus shadow */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 30%, transparent);

/* Line 88 - Command entry (sent commands) */
color: var(--theme-primary);

/* Line 93 - Response entry (printer responses) */
color: var(--success-color);

/* Line 97 - Error entry (error messages) */
color: var(--error-color);

/* Line 102 - Info entry (system info) */
color: color-mix(in srgb, var(--theme-text) 75%, transparent);
```

### Step 3: Delete Legacy :root Block

**Delete lines 14-19:**
```css
/* DELETE THIS ENTIRE BLOCK */
:root {
    --button-bg: #4285f4;
    --button-hover: #5a95f5;
    --input-bg: #2a2a2a;
    --log-bg: #1e1e1e;
}
```

## Expected Result

After migration:
- ✅ **13 hardcoded color patterns migrated** to theme system
- ✅ **Legacy :root block removed** (4 custom variables deleted)
- ✅ Terminal colors use semantic theme variables
- ✅ Command/response/error entries use appropriate status colors
- ✅ Focus states use primary color
- ✅ All colors adapt to user-selected theme

## Notes

- **Dialog Purpose:** Terminal-style interface for sending raw G-code commands to printer
- **Terminal Styling:** Uses monospace font (Consolas/Monaco/Courier New) for code aesthetics
- **Color-Coded Entries:**
  - **Blue** (was `#4DACFF`) - Commands sent to printer → Use `--theme-primary`
  - **Green** (was `#00FF00`) - Responses from printer → Use `--success-color`
  - **Red** (was `#FF6666`) - Error messages → Use `--error-color`
  - **Gray** (was `#CCCCCC`) - Info/system messages → Use muted text
- **Background:** Deep dark background (`#1e1e1e`) for terminal feel → Use `--theme-background`
- **Input:** Slightly lighter background (`#2a2a2a`) for contrast → Use `--surface-muted`
- **Focus State:** Blue glow on input focus → Use `--theme-primary` with `color-mix()`

## Common Patterns Reference

```css
/* Legacy variable replacement */
var(--button-bg) /* BEFORE */
var(--theme-primary) /* AFTER */

var(--button-hover) /* BEFORE */
var(--theme-primary-hover) /* AFTER */

var(--log-bg) /* BEFORE */
var(--theme-background) /* AFTER */

var(--input-bg) /* BEFORE */
var(--surface-muted) /* AFTER */

/* Terminal entry colors */
color: #4DACFF; /* BEFORE - command (blue) */
color: var(--theme-primary); /* AFTER */

color: #00FF00; /* BEFORE - response (green) */
color: var(--success-color); /* AFTER */

color: #FF6666; /* BEFORE - error (red) */
color: var(--error-color); /* AFTER */

color: #CCCCCC; /* BEFORE - info (gray) */
color: color-mix(in srgb, var(--theme-text) 75%, transparent); /* AFTER */

/* Focus shadow */
box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */
```

## Testing Notes

When verifying this migration:
1. Test command input field styling
2. Verify input focus state (blue glow)
3. Check log area background (deep dark)
4. Test command entry color (blue - sent commands)
5. Test response entry color (green - printer responses)
6. Test error entry color (red - errors)
7. Test info entry color (gray - system messages)
8. Verify monospace font rendering
9. Test Send button (primary color)
10. Test with both light and dark themes
11. Ensure terminal colors remain readable across themes
12. Verify log scrolling works correctly
