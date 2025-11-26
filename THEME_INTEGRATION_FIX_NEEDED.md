# Theme Integration - Type Errors Fix Needed

## Issue Summary
All 19 dialogs have theme listeners added, but there are 17 TypeScript compilation errors from webpack due to type signature mismatches in the `receive` method callbacks.

## Root Cause
Different dialog APIs have different `receive` method signatures:
- Some expect `(data: unknown) => void`
- Some expect specific types like `(options: DialogInitOptions) => void`
- Some don't have `receive` in their type definition at all

Our theme listeners use `(theme: ThemeColors) => void` which conflicts.

## Files with Errors

### Type 1: Wrong parameter type (needs cast)
1. `about-dialog-renderer.ts:40` - `(...args: unknown[]) => void` vs `(theme: ThemeColors)`
2. `connect-choice-dialog-renderer.ts:31` - Same
3. `status-dialog-renderer.ts:347` - Same
4. `input-dialog-renderer.ts:235` - `(options: DialogInitOptions)` vs `(theme: ThemeColors)`
5. `printer-connected-warning-renderer.ts:82` - `(data: PrinterConnectedWarningData)` vs `(theme: ThemeColors)`
6. `spoolman-dialog-renderer.ts:49` - `(options: DialogInitOptions)` vs `(theme: ThemeColors)`
7. `spoolman-offline-dialog-renderer.ts:39` - Same

### Type 2: Missing `receive` in type definition
8. `log-dialog-renderer.ts:191` - Property 'receive' does not exist on type 'ILogDialogAPI'
9. `material-matching-dialog-renderer.ts:583` - Property 'receive' does not exist on type 'MaterialMatchingAPI'
10. `palette.ts:265` - Property 'receive' does not exist on type 'PaletteAPI'
11. `send-cmds-renderer.ts:171` - Property 'receive' does not exist
12. `shortcut-config-dialog.ts:381` - Property 'receive' does not exist on type 'ShortcutConfigDialogAPI'
13. `single-color-confirmation-dialog-renderer.ts:284` - Property 'receive' does not exist on type 'SingleColorConfirmAPI'
14. `update-available-renderer.ts:514` - Property 'receive' does not exist on type 'UpdateDialogAPI'

### Type 3: Class visibility issue
15. `log-dialog-renderer.ts:208` - Property 'registerThemeListener' is private (should be public or move call inside class)

### Type 4: Missing property/import
16. `settings-renderer.ts:627` - Property 'api' does not exist on type 'SettingsRenderer'
17. `settings-renderer.ts:628` - Cannot find name 'applyDialogTheme' (missing import)

## Solution Pattern

### For Type 1 (parameter mismatch):
Change from:
```typescript
api?.receive?.('theme-changed', (theme: ThemeColors) => {
  applyDialogTheme(theme);
});
```

To:
```typescript
api?.receive?.('theme-changed', (data: unknown) => {
  applyDialogTheme(data as ThemeColors);
});
```

### For Type 2 (missing receive in type):
Add to the interface definition in `src/types/global.d.ts` or inline:
```typescript
interface SomeAPI {
  // ... existing properties
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}
```

### For Type 3 (log-dialog visibility):
Make `registerThemeListener()` public OR call it inside `initialize()` method.

### For Type 4 (settings missing api/import):
- Fix the `this.api` reference (should be `window.settingsAPI`)
- Add missing import for `applyDialogTheme`

## Estimated Fix Time
~10-15 minutes - straightforward type corrections across 17 locations.

## Status
- ✅ All preload files updated with `receive` method
- ✅ All renderer files have theme listener code
- ✅ All CSS migrated to theme variables
- ❌ TypeScript compilation errors (webpack build fails)
- ⏳ Need type signature fixes before runtime testing
