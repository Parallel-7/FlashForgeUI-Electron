# CSS Migration Spec: ifs-dialog.css

**Status:** ✅ COMPLETED
**File:** `src/ui/ifs-dialog/ifs-dialog.css`
**Total Patterns:** 17 hardcoded colors
**Priority:** HIGH - Material station filament slot visualization

## Pattern Breakdown

- **Hex colors:** 14 patterns (status indicators + spool utility classes)
- **Named colors:** 1 pattern (`white` in utility class)
- **Intentional patterns:** 2 (`transparent` declarations - keep as-is)

## IMPORTANT: Intentional Patterns (KEEP AS-IS)

| Line | Current | Action | Context |
|------|---------|--------|---------|
| 7 | `transparent !important` | **KEEP AS-IS** | Intentional transparent body background |
| Note | All spool color classes (lines 227-240) | **KEEP AS-IS** | Dynamic filament color visualization - these represent actual filament colors |

## Migration Strategy

### Category 1: Status Indicator Colors (3 patterns)

Material station connection status dots:

| Line | Current | Replacement | Context |
|------|---------|-------------|---------|
| 53 | `#f44336` | `var(--error-color)` | Default/disconnected status (red) |
| 59 | `#4caf50` | `var(--success-color)` | Connected status (green) |
| 63 | `#ff9800` | `var(--warning-color)` | Warning status (orange) |

**Rationale:** These are semantic status colors that should use the fixed status variables, not theme-derived colors.

### Category 2: Spool Color Utility Classes (14 patterns - KEEP AS-IS)

Lines 227-240 define filament color classes (`.spool-white`, `.spool-black`, `.spool-red`, etc.):

| Line | Current | Action | Rationale |
|------|---------|--------|-----------|
| 227 | `#ffffff` | **KEEP** | Represents actual white filament |
| 228 | `#333333` | **KEEP** | Represents actual black filament |
| 229 | `#f44336` | **KEEP** | Represents actual red filament |
| 230 | `#4caf50` | **KEEP** | Represents actual green filament |
| 231 | `#2196f3` | **KEEP** | Represents actual blue filament |
| 232 | `#ffeb3b` | **KEEP** | Represents actual yellow filament |
| 233 | `#ff9800` | **KEEP** | Represents actual orange filament |
| 234 | `#9c27b0` | **KEEP** | Represents actual purple filament |
| 235 | `#e91e63` | **KEEP** | Represents actual pink filament |
| 236 | `#00bcd4` | **KEEP** | Represents actual cyan filament |
| 237 | `#cddc39` | **KEEP** | Represents actual lime filament |
| 238 | `#ffc107` | **KEEP** | Represents actual amber filament |
| 239 | `#795548` | **KEEP** | Represents actual brown filament |
| 240 | `#9e9e9e` | **KEEP** | Represents actual gray filament |

**IMPORTANT:** These classes are applied dynamically based on actual filament colors from the printer. They should NOT be migrated to theme variables because they represent real-world filament colors, not UI theme colors.

## Implementation Checklist

- [x] Migrate 3 status indicator patterns → status color variables
- [x] **SKIP** `transparent !important` (line 7) - intentional
- [x] **SKIP** All 14 spool color utility classes (lines 227-240) - represent actual filament colors
- [x] Verify 3 patterns migrated, 15 intentionally kept
- [x] User to run: `npm run type-check`
- [x] User to run: `npm run build:renderer`
- [x] User to run: `npm run lint`
- [x] Verify with `go run ./scripts/detect-hardcoded-css.go --path-include src/ui/ifs-dialog`

## Migration Details

### Before:
```css
/* Line 53 - Default/disconnected status */
.status-indicator {
  background-color: #f44336;
}

/* Line 59 - Connected status */
.status-indicator.connected {
  background-color: #4caf50;
}

/* Line 63 - Warning status */
.status-indicator.warning {
  background-color: #ff9800;
}
```

### After:
```css
/* Line 53 - Default/disconnected status */
.status-indicator {
  background-color: var(--error-color);
}

/* Line 59 - Connected status */
.status-indicator.connected {
  background-color: var(--success-color);
}

/* Line 63 - Warning status */
.status-indicator.warning {
  background-color: var(--warning-color);
}
```

## Expected Result

After migration:
- ✅ **3 patterns migrated** (status indicators)
- ✅ **1 transparent pattern kept** (body background)
- ✅ **14 spool color patterns kept** (filament visualization)
- ✅ Total: 3 migrations + 15 intentional keeps = 18 total patterns accounted for

## Notes

- **IFS Dialog Context:** This dialog visualizes the Adventurer 5M Pro's Integrated Filament System (material station) with 4 slots
- **Status Indicators:** Red (disconnected), Green (connected), Orange (warning) should use semantic status colors
- **Spool Colors:** The 14 utility classes (`.spool-white` through `.spool-gray`) are dynamically applied based on actual filament colors reported by the printer - these must remain as fixed Material Design colors
- **Visual Fidelity:** Migration should NOT affect the appearance of filament spools, only status indicators
- **Theme Independence:** Status colors are intentionally theme-independent for consistency across light/dark themes

## Common Patterns Reference

```css
/* Status indicators */
background-color: #f44336; /* BEFORE */
background-color: var(--error-color); /* AFTER */

background-color: #4caf50; /* BEFORE */
background-color: var(--success-color); /* AFTER */

background-color: #ff9800; /* BEFORE */
background-color: var(--warning-color); /* AFTER */
```

## Testing Notes

When verifying this migration:
1. Check that disconnected status shows red dot
2. Check that connected status shows green dot
3. Check that warning status shows orange dot
4. **Verify spool colors still display correctly** (white, black, red, green, blue, etc.)
5. Test with both light and dark themes to ensure status dots are visible
6. Ensure the hardcoded detector ignores the spool utility classes after migration
