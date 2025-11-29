# Settings Dialog Theme Live Update Fix

## Problem Description

The Settings Dialog does not update theme inputs in real-time when:
- Switching between theme profiles (e.g., Dark Blue → Dark Purple)
- Clicking the "Reset to Default" button
- Receiving external theme changes from other windows

**Current Behavior**: CSS variables update correctly (visual theme changes), but color picker inputs, hex text fields, and color swatches remain unchanged until the dialog is closed and reopened.

**Expected Behavior**: All theme inputs should update immediately when theme changes are received, matching the behavior of the rest of the application UI.

---

## Root Cause Analysis

The Settings Dialog renderer (`src/renderer/src/ui/settings/settings-renderer.ts`) has a `registerThemeListener()` method that subscribes to `theme-changed` IPC events. This method currently only calls `applyDialogTheme()` to update CSS variables, but **does not call** `desktopThemeSection.applyTheme()` to update the input fields.

### Current Theme Update Flow

1. **User Action** → `DesktopThemeSection` method (e.g., `handleProfileSelect()`, `handleResetDesktopTheme()`)
2. **Section Method** → Calls `this.applyTheme(theme)` (updates inputs) + `this.emitThemeChange(theme)` (broadcasts change)
3. **IPC Broadcast** → Main process receives `theme-updated` and sends `theme-changed` to ALL windows
4. **Settings Dialog Receives** → `registerThemeListener()` callback fires
5. **CSS Update Only** → `applyDialogTheme(theme)` updates CSS variables
6. **❌ Missing Step** → No call to `desktopThemeSection.applyTheme(theme)` to update inputs

This creates a race condition where the CSS updates but the inputs don't, leaving the UI in an inconsistent state.

---

## The Fix

**File**: `src/renderer/src/ui/settings/settings-renderer.ts`
**Location**: Lines 645-647 (in `registerThemeListener()` method)

### Current Code

```typescript
private registerThemeListener(): void {
  this.settingsAPI?.receive?.('theme-changed', (data: unknown) => {
    applyDialogTheme(data as ThemeColors);
    // ❌ MISSING: No call to update DesktopThemeSection inputs!
  });
}
```

### Fixed Code

```typescript
private registerThemeListener(): void {
  this.settingsAPI?.receive?.('theme-changed', (data: unknown) => {
    const theme = data as ThemeColors;
    applyDialogTheme(theme);
    // Update the theme section inputs to reflect the new theme
    this.desktopThemeSection?.applyTheme(theme);
  });
}
```

**Change Summary**: Add a single line calling `this.desktopThemeSection?.applyTheme(theme)` after `applyDialogTheme()`.

---

## Technical Details

### Theme Update Methods

**`applyDialogTheme(theme: ThemeColors)`** (`src/renderer/src/ui/shared/theme-utils.ts`)
- Updates CSS variables in the dialog's `<style>` tag
- Handles visual theme changes only
- Does NOT touch input fields

**`DesktopThemeSection.applyTheme(theme: ThemeColors)`** (`src/renderer/src/ui/settings/sections/DesktopThemeSection.ts`, lines 116-128)
- Updates color picker `.value` properties
- Updates hex input field text content
- Updates swatch background colors
- Sets profile dropdown to "Custom" if theme doesn't match a preset
- Handles all input synchronization

### Why This Works

The `DesktopThemeSection` class already has a complete `applyTheme()` method designed for this exact purpose. It's called correctly in:
- `handleProfileSelect()` (line 698): When user selects a preset
- `handleResetDesktopTheme()` (line 235): When user clicks reset button
- `initialize()` (line 87): On dialog load

The only place it's **not** called is in the `theme-changed` listener, which causes the regression when theme updates come from IPC broadcasts.

### IPC Flow Reference

**Main Process** (`src/main/ipc/handlers/theme-handlers.ts`, lines 45-50):
```typescript
ipcMain.on('theme-updated', (_event, theme: ThemeColors) => {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('theme-changed', theme);
    }
  });
});
```

This broadcasts theme changes to ALL windows, including the Settings Dialog itself. Without the `applyTheme()` call, the Settings Dialog receives the broadcast but doesn't update its own inputs.

---

## Testing the Fix

After applying the fix, verify that:

1. **Profile Switching**: Select different theme profiles → inputs update immediately
2. **Reset Button**: Click "Reset to Default" → inputs revert immediately
3. **External Changes**: Change theme from main window → Settings Dialog inputs update
4. **Cross-Window Sync**: Open multiple windows → theme changes sync to Settings Dialog

All updates should occur in real-time without requiring dialog close/reopen.

---

## Impact

- **Scope**: Single-line fix in `settings-renderer.ts`
- **Risk**: Low (uses existing, well-tested method)
- **Benefit**: Restores expected real-time theme update behavior
- **Regression Potential**: None (method is already called in other paths)
