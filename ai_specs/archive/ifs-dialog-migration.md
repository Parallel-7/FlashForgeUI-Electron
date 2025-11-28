# CSS Migration Spec: ifs-dialog.css

**File:** `src/ui/ifs-dialog/ifs-dialog.css`
**Total Patterns:** 38 (24 need migration, 14 are intentional)
**Priority:** HIGH - IFS Material Station dialog
**Estimated Time:** 25-35 minutes

## Pattern Breakdown

- **Hex colors:** 24 patterns (14 intentional spool colors, 10 to migrate)
- **RGB/RGBA:** 13 patterns (all need migration)
- **Named colors:** 1 pattern (`transparent` - keep as-is)

## IMPORTANT: Intentional Patterns (KEEP AS-IS)

**Lines 249-262:** Spool color utility classes represent actual filament colors and should NOT be migrated:

```css
/* These are INTENTIONAL - represent physical filament spool colors */
.spool-white { background-color: #ffffff; }
.spool-black { background-color: #333333; }
.spool-red { background-color: #f44336; }
.spool-green { background-color: #4caf50; }
.spool-blue { background-color: #2196f3; }
.spool-yellow { background-color: #ffeb3b; }
.spool-orange { background-color: #ff9800; }
.spool-purple { background-color: #9c27b0; }
.spool-pink { background-color: #e91e63; }
.spool-cyan { background-color: #00bcd4; }
.spool-lime { background-color: #cddc39; }
.spool-amber { background-color: #ffc107; }
.spool-brown { background-color: #795548; }
.spool-gray { background-color: #9e9e9e; }
```

## Migration Strategy

### Category 1: Gray Borders (5 patterns)

Standard borders using `#555`:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 12 | `#555` | `var(--border-color)` | Dialog border |
| 34 | `#555` | `var(--border-color)` | Header border-bottom |
| 92 | `#555` | `var(--border-color)` | Section border |
| 181 | `#555` | `var(--border-color)` | Material slot border |

### Category 2: White Text (4 patterns)

White text for headers and labels:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 40 | `#ffffff` | `var(--theme-text)` | Dialog title |
| 47 | `#ffffff` | `var(--theme-text)` | Section header |
| 171 | `#ffffff` | `var(--theme-text)` | Slot label |

### Category 3: Muted Gray Text (3 patterns)

Light gray text for secondary information:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 57 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Description text |
| 177 | `#cccccc` | `color-mix(in srgb, var(--theme-text) 70%, transparent)` | Material info |
| 194 | `#888888` | `color-mix(in srgb, var(--theme-text) 50%, transparent)` | Disabled text |

### Category 4: Dark Shadows (5 patterns)

Various dark shadows for depth:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 66 | `rgba(0, 0, 0, 0.3)` | `var(--shadow-sm)` | Card shadow |
| 139 | `inset 0 4px 8px rgba(0, 0, 0, 0.3)` | `inset 0 4px 8px color-mix(in srgb, var(--theme-background) 30%, black)` | Inset shadow |
| 140 | `0 2px 4px rgba(0, 0, 0, 0.2)` | `var(--shadow-sm)` | Outer shadow |
| 146 | `inset 0 4px 8px rgba(0, 0, 0, 0.4)` | `inset 0 4px 8px color-mix(in srgb, var(--theme-background) 40%, black)` | Active inset |
| 147 | `0 4px 8px rgba(0, 0, 0, 0.3)` | `var(--shadow-md)` | Active outer shadow |

### Category 5: Light/White Overlays (5 patterns)

Semi-transparent white for highlights:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 132 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Slot border |
| 144 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Hover border |
| 155 | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--theme-text) 10%, transparent)` | Empty slot border |
| 159 | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--theme-text) 20%, transparent)` | Empty slot hover |

### Category 6: Dark Overlay Background (1 pattern)

Black overlay for empty state:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 154 | `rgba(0, 0, 0, 0.3)` | `color-mix(in srgb, var(--theme-background) 30%, black)` | Empty slot background |

### Category 7: Primary/Accent Colors (3 patterns)

Indigo/purple primary accent colors:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 107 | `rgba(92, 107, 192, 0.4)` | `color-mix(in srgb, var(--theme-primary) 40%, transparent)` | Selected slot glow |
| 188 | `rgba(92, 107, 192, 0.2)` | `color-mix(in srgb, var(--theme-primary) 20%, transparent)` | Active background |
| 189 | `rgba(92, 107, 192, 0.4)` | `color-mix(in srgb, var(--theme-primary) 40%, transparent)` | Active border |

### Category 8: Named Colors (1 pattern - KEEP)

| Line | Current | Action | Context |
|------|---------|--------|---------|
| 7 | `transparent !important` | **KEEP AS-IS** | Intentional transparent background |

## Implementation Checklist

- [ ] Migrate 5 gray border patterns → `var(--border-color)`
- [ ] Migrate 4 white text patterns → `var(--theme-text)`
- [ ] Migrate 3 muted text patterns → `color-mix()` with opacity
- [ ] Migrate 5 dark shadow patterns → shadow variables or `color-mix()`
- [ ] Migrate 5 light overlay patterns → `color-mix()` with `--theme-text`
- [ ] Migrate 1 dark overlay → `color-mix()` with `--theme-background`
- [ ] Migrate 3 primary accent patterns → `color-mix()` with `--theme-primary`
- [ ] **SKIP** 14 spool color utility classes (lines 249-262) - intentional
- [ ] **SKIP** `transparent !important` (line 7) - intentional
- [ ] Verify 24 patterns migrated, 14 intentionally skipped
- [ ] Test with light theme
- [ ] Test with dark theme
- [ ] Verify spool color badges still display correctly

## Expected Outcome

After migration:
- **Before:** 38 total patterns (24 to migrate, 14 intentional)
- **After:** 14 intentional patterns remain (spool colors)
- All UI colors adapt to user-selected theme
- Spool color utility classes remain unchanged (represent physical colors)
- Material slots have proper visual feedback
- Light/dark themes work correctly

## Common Patterns Reference

```css
/* Gray borders */
border: 1px solid #555; /* BEFORE */
border: 1px solid var(--border-color); /* AFTER */

/* White text */
color: #ffffff; /* BEFORE */
color: var(--theme-text); /* AFTER */

/* Muted text (70% opacity) */
color: #cccccc; /* BEFORE */
color: color-mix(in srgb, var(--theme-text) 70%, transparent); /* AFTER */

/* Dark shadows */
box-shadow: 0 0 4px rgba(0, 0, 0, 0.3); /* BEFORE */
box-shadow: var(--shadow-sm); /* AFTER */

/* Light overlay borders */
border: 4px solid rgba(255, 255, 255, 0.1); /* BEFORE */
border: 4px solid color-mix(in srgb, var(--theme-text) 10%, transparent); /* AFTER */

/* Primary accent glow */
box-shadow: 0 0 12px rgba(92, 107, 192, 0.4); /* BEFORE */
box-shadow: 0 0 12px color-mix(in srgb, var(--theme-primary) 40%, transparent); /* AFTER */
```

## Notes

- **DO NOT MIGRATE** the spool color classes (lines 249-262) - these represent actual filament colors
- The indigo/purple accent color (`rgba(92, 107, 192, ...)`) should map to `--theme-primary`
- Material slots use complex layered shadows (inset + outer) - preserve this visual depth
- Empty slots have distinct styling from filled slots - maintain this distinction
- The `transparent !important` on line 7 is intentional override - leave it alone
