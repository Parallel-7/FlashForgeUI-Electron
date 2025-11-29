# CSS Migration Spec: input-dialog.css

**Status:** ✅ COMPLETED
**File:** `src/ui/input-dialog/input-dialog.css`
**Total Patterns:** 9 (9 migrated, 0 intentional kept)
**Priority:** HIGH - Input dialog (critical UI component)

## Pattern Breakdown

- **Hex colors:** 8 patterns
- **RGB/RGBA:** 1 pattern
- **Named colors:** 0 patterns (all to migrate)

## Migration Strategy

### Category 1: Primary Button Colors (2 patterns)

Blue primary action button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 7 | `#4285f4` | `var(--theme-primary)` | Primary button background |
| 8 | `#5a95f5` | `var(--theme-primary-hover)` | Primary button hover |

### Category 2: Input Border Colors (2 patterns)

Border colors for input field states:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 9 | `#555` | `var(--border-color)` | Input border default |
| 10 | `#4285f4` | `var(--theme-primary)` | Input border focus |

### Category 3: White Text (2 patterns)

White text for dialog messages and input:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 19 | `#ffffff` | `var(--theme-text)` | Dialog message text |
| 29 | `#ffffff` | `var(--theme-text)` | Input field text |

### Category 4: Dark Backgrounds (2 patterns)

Dark background for input field:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 26 | `#2a2a2a` | `var(--surface-elevated)` | Input field background |
| 72 | `#666` | `var(--surface-elevated)` | Cancel button background |

### Category 5: Light Gray Borders (2 patterns)

Light gray borders for cancel button:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 73 | `#777` | `var(--border-color)` | Cancel button border |
| 78 | `var(--border-color)` | Already migrated | Cancel button hover border |

**Note:** Line 78 already uses `var(--border-color)` correctly. Line 77 uses `var(--surface-elevated)` correctly.

### Category 6: Muted Text (1 pattern)

Gray placeholder text:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 48 | `#888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Input placeholder text |

### Category 7: Focus Box Shadow (1 pattern)

Blue focus glow:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 44 | `rgba(66, 133, 244, 0.3)` | `color-mix(in srgb, var(--theme-primary) 30%, transparent)` | Input focus box shadow |

## Special Considerations

### Root Variable Cleanup

The `:root` block (lines 6-11) defines custom variables that should be removed:

```css
/* BEFORE */
:root {
    --button-bg: #4285f4;
    --button-hover: #5a95f5;
    --input-border: #555;
    --input-focus: #4285f4;
}

/* AFTER - Remove entire block */
/* All colors now use global theme variables */
```

**Action:** Remove the entire `:root` block and update all usages:
- `var(--button-bg)` → `var(--theme-primary)`
- `var(--button-hover)` → `var(--theme-primary-hover)`
- `var(--input-border)` → `var(--border-color)`
- `var(--input-focus)` → `var(--theme-primary)`

### Input Field Styling

Lines 25-45 define the input field with custom variables:

```css
/* BEFORE */
.dialog-input {
    background-color: #2a2a2a;
    border: 1px solid var(--input-border);
    color: #ffffff;
}

.dialog-input:focus {
    border-color: var(--input-focus);
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
}

.dialog-input::placeholder {
    color: #888;
}

/* AFTER */
.dialog-input {
    background-color: var(--surface-elevated);
    border: 1px solid var(--border-color);
    color: var(--theme-text);
}

.dialog-input:focus {
    border-color: var(--theme-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 30%, transparent);
}

.dialog-input::placeholder {
    color: color-mix(in srgb, var(--theme-text) 50%, transparent);
}
```

### Button Styling

Lines 60-68 use custom variables for primary button:

```css
/* BEFORE */
.dialog-button {
    background-color: var(--button-bg);
    border-color: var(--button-bg);
}

.dialog-button:hover {
    background-color: var(--button-hover);
    border-color: var(--button-hover);
}

/* AFTER */
.dialog-button {
    background-color: var(--theme-primary);
    border-color: var(--theme-primary);
}

.dialog-button:hover {
    background-color: var(--theme-primary-hover);
    border-color: var(--theme-primary-hover);
}
```

Lines 71-79 define cancel button (already partially migrated):

```css
/* BEFORE */
.dialog-button.cancel {
    background-color: #666;
    border-color: #777;
}

.dialog-button.cancel:hover {
    background-color: var(--surface-elevated);  /* Already correct */
    border-color: var(--border-color);          /* Already correct */
}

/* AFTER */
.dialog-button.cancel {
    background-color: var(--surface-elevated);
    border-color: var(--border-color);
}

.dialog-button.cancel:hover {
    background-color: var(--surface-muted);     /* Darker on hover */
    border-color: var(--border-color-light);    /* Lighter border on hover */
}
```

## Implementation Checklist

- [x] Remove entire `:root` block (lines 6-11)
- [x] Migrate 2 primary button patterns → `var(--theme-primary)` / `var(--theme-primary-hover)` (lines 61-62, 65-66)
- [x] Migrate 2 input border patterns → `var(--border-color)` and `var(--theme-primary)` (lines 27, 43)
- [x] Migrate 2 white text patterns → `var(--theme-text)` (lines 19, 29)
- [x] Migrate 2 dark background patterns → `var(--surface-elevated)` (lines 26, 72)
- [x] Migrate 2 cancel button border patterns → `var(--border-color)` (line 73)
- [x] Migrate 1 placeholder text → `color-mix()` (line 48)
- [x] Migrate 1 focus box shadow → `color-mix()` (line 44)
- [x] Update cancel button hover to use `var(--surface-muted)` (line 77)
- [x] Verify 9 patterns migrated, 0 intentionally skipped
- [x] User to run: `npm run type-check` ✅ PASSED
- [x] User to run: `npm run build:renderer` ✅ PASSED
- [x] User to run: `npm run lint` ✅ PASSED (no new errors)
- [x] Verify no hardcoded CSS remains with scanner ✅ CLEAN

## Migration Examples

```css
/* Root variables - REMOVE */
:root {
    --button-bg: #4285f4;         /* REMOVE */
    --button-hover: #5a95f5;      /* REMOVE */
    --input-border: #555;         /* REMOVE */
    --input-focus: #4285f4;       /* REMOVE */
}

/* Primary button background */
background-color: var(--button-bg); /* BEFORE */
background-color: var(--theme-primary); /* AFTER */

/* Primary button hover */
background-color: var(--button-hover); /* BEFORE */
background-color: var(--theme-primary-hover); /* AFTER */

/* Input border */
border: 1px solid var(--input-border); /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* Input focus border */
border-color: var(--input-focus); /* BEFORE */
border-color: var(--theme-primary); /* AFTER */

/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Dark input background */
background-color: #2a2a2a; /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

/* Cancel button background */
background-color: #666; /* BEFORE */
background-color: var(--surface-elevated); /* AFTER */

/* Cancel button border */
border-color: #777; /* BEFORE */
border-color: var(--border-color); /* AFTER */

/* Placeholder text */
color: #888; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 50%, transparent); /* AFTER */

/* Focus box shadow */
box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3); /* BEFORE */
box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 30%, transparent); /* AFTER */
```

## Notes

- This dialog uses standard Material Design colors (`#4285f4`) that align perfectly with the theme system.
- The cancel button hover states (lines 77-78) are already partially migrated - complete the migration for consistency.
- All custom `:root` variables should be removed to eliminate fragmentation and use centralized theme variables.
- The dialog inherits styles from `rounded-dialog-template.css` - ensure changes don't conflict with template patterns.
- Input field styling is straightforward with clear semantic mappings to theme variables.
- Consider adding `:disabled` state styling with reduced opacity to match other dialogs.
