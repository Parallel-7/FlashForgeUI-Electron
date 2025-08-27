# Toggleable Rounded UI Implementation Plan

## Overview

This document outlines the complete implementation plan for making the rounded UI system toggleable, with automatic macOS detection and traffic light control positioning fixes.

## Problem Statement

The current rounded UI design causes macOS traffic light controls (red/yellow/green window buttons) to be positioned incorrectly due to:
- Dialog windows using `frame: false` + `transparent: true` without proper `titleBarStyle`
- CSS with `background: transparent` and `padding: 16px` confusing macOS positioning algorithm
- No platform-specific handling for macOS window control requirements

## Solution Architecture

### 1. Configuration System Changes

#### A. Update Config Schema (`src/types/config.ts`)
```typescript
export interface AppConfig {
  // ... existing properties ...
  readonly RoundedUI: boolean;  // New property
}

export interface MutableAppConfig {
  // ... existing properties ...
  RoundedUI: boolean;  // New property
}
```

#### B. Update Validation Schema (`src/validation/config-schemas.ts`)
```typescript
export const AppConfigSchema = z.object({
  // ... existing properties ...
  RoundedUI: z.boolean()
});
```

#### C. Update Default Configuration (`src/types/config.ts`)
```typescript
export const DEFAULT_CONFIG: AppConfig = {
  // ... existing properties ...
  RoundedUI: process.platform !== 'darwin',  // Default: disabled on macOS, enabled elsewhere
};
```

### 2. Settings UI Integration

#### A. Update Settings HTML (`src/ui/settings/settings.html`)
Add to Column 3 (around line 93):
```html
<label class="checkbox-label">
    <input type="checkbox" id="rounded-ui"> Rounded UI
</label>
<div class="settings-info-text">
    Enable rounded windows and dialogs. Restart required after changing.
    <span class="macos-warning" style="display: none; color: #ff9800; font-weight: 500;">
        ⚠️ Disabled on macOS due to system compatibility issues.
    </span>
</div>
```

#### B. Update Settings Renderer (`src/ui/settings/settings-renderer.ts`)
Add to `INPUT_TO_CONFIG_MAP`:
```typescript
const INPUT_TO_CONFIG_MAP: Record<string, keyof AppConfig> = {
  // ... existing mappings ...
  'rounded-ui': 'RoundedUI'
};
```

Add macOS warning logic in `updateUI()` method:
```typescript
private updateUI(config: AppConfig): void {
  // ... existing code ...
  
  // Handle macOS-specific UI
  if (process.platform === 'darwin') {
    const macosWarning = document.querySelector('.macos-warning');
    const roundedUICheckbox = this.inputs.get('rounded-ui');
    
    if (macosWarning) macosWarning.style.display = 'block';
    if (roundedUICheckbox) roundedUICheckbox.disabled = true;
  }
}
```

### 3. Window Factory System Changes

#### A. Modify Window Creation Functions
Update all window creation functions to accept a `roundedUI` parameter:

**`src/windows/shared/WindowConfig.ts`**
```typescript
export const createModalWindow = (
  parentWindow: BrowserWindow | null,
  dimensions: WindowDimensions,
  preloadPath: PreloadPath,
  options: {
    readonly resizable?: boolean;
    readonly frame?: boolean;
    readonly transparent?: boolean;
    readonly roundedUI?: boolean;  // New parameter
  } = {}
): BrowserWindow => {
  const { resizable = true, frame = false, transparent = false, roundedUI = true } = options;
  
  // Use rounded UI configuration only if enabled and not on macOS
  const useRoundedUI = roundedUI && process.platform !== 'darwin';
  
  return new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    minWidth: dimensions.minWidth,
    minHeight: dimensions.minHeight,
    parent: parentWindow,
    modal: true,
    frame: useRoundedUI ? false : true,
    transparent: useRoundedUI ? transparent : false,
    show: false,
    resizable,
    webPreferences: createSecureWebPreferences(preloadPath),
  });
};
```

#### B. Update Dialog Window Factory (`src/windows/factories/DialogWindowFactory.ts`)
Modify all dialog creation functions to pass the `roundedUI` setting:

```typescript
import { getConfigManager } from '../../managers/ConfigManager';

// Example for auto-connect choice dialog:
export const createAutoConnectChoiceDialog = (data: AutoConnectChoiceDialogData): Promise<string | null> => {
  return new Promise((resolve) => {
    const configManager = getConfigManager();
    const config = configManager.getConfig();
    const roundedUI = config.RoundedUI;
    
    // ... existing code ...
    
    const autoConnectChoiceDialogWindow = createModalWindow(
      mainWindow,
      WINDOW_SIZES.AUTO_CONNECT_CHOICE,
      createPreloadPath(path.join(__dirname, '../../ui/auto-connect-choice/auto-connect-choice-preload.js')),
      { resizable: false, frame: false, transparent: true, roundedUI }  // Pass roundedUI
    );
    
    // ... rest of existing code ...
  });
};
```

### 4. CSS Conditional Styling System

#### A. Create CSS Variable Injection System
**`src/utils/CSSVariables.ts`** (New file)
```typescript
import { getConfigManager } from '../managers/ConfigManager';

export const injectCSSVariables = (window: BrowserWindow): void => {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const roundedUI = config.RoundedUI;
  
  const cssVariables = `
    :root {
      --ui-rounded: ${roundedUI ? '1' : '0'};
      --ui-padding: ${roundedUI ? '16px' : '0px'};
      --ui-border-radius: ${roundedUI ? '12px' : '0px'};
      --ui-background: ${roundedUI ? 'transparent' : '#3a3a3a'};
      --container-background: #3a3a3a;
    }
  `;
  
  window.webContents.insertCSS(cssVariables);
};
```

#### B. Update Rounded Dialog Template (`src/ui/shared/rounded-dialog-template.css`)
```css
/* Conditional rounded styling based on CSS variables */
body {
    margin: 0;
    padding: var(--ui-padding, 16px);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--ui-background, transparent);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    box-sizing: border-box;
}

.dialog-container {
    background: var(--container-background, #3a3a3a);
    border: 1px solid #555;
    border-radius: var(--ui-border-radius, 12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    width: 100%;
    max-width: 100%;
    max-height: calc(100vh - calc(var(--ui-padding, 16px) * 2));
    /* ... rest of existing styles ... */
}

/* Non-rounded fallback styles */
body:not([data-rounded-ui]) {
    padding: 0;
    background: #3a3a3a;
}

body:not([data-rounded-ui]) .dialog-container {
    border-radius: 0;
    box-shadow: none;
    height: 100vh;
    max-height: 100vh;
}
```

### 5. macOS Detection and Auto-Disable Logic

#### A. App Launch Detection (`src/index.ts`)
Add to main window creation:
```typescript
import { getConfigManager } from './managers/ConfigManager';

const createMainWindow = async (): Promise<void> => {
  // ... existing code ...
  
  // macOS rounded UI check
  if (process.platform === 'darwin') {
    await handleMacOSRoundedUI();
  }
  
  // ... rest of existing code ...
};

const handleMacOSRoundedUI = async (): Promise<void> => {
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  
  if (config.RoundedUI) {
    // Disable rounded UI on macOS
    await configManager.updateConfig({ RoundedUI: false });
    
    // Show warning popup
    await showMacOSRoundedUIWarning();
  }
};
```

#### B. macOS Warning Dialog
**`src/utils/MacOSWarning.ts`** (New file)
```typescript
import { dialog } from 'electron';

export const showMacOSRoundedUIWarning = async (): Promise<void> => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Rounded UI Disabled',
    message: 'Rounded UI has been automatically disabled on macOS',
    detail: 'The rounded UI feature causes window control positioning issues on macOS. It has been disabled automatically. Please restart the application to avoid UI issues.',
    buttons: ['Restart Now', 'Continue'],
    defaultId: 0,
    cancelId: 1
  });
  
  if (result.response === 0) {
    const { app } = require('electron');
    app.relaunch();
    app.exit();
  }
};
```

### 6. Window Factory Integration Points

#### A. All Dialog Factories Need Updates
Update these files to pass the `roundedUI` parameter:
- `src/windows/factories/DialogWindowFactory.ts` (all dialog creation functions)
- `src/windows/factories/UtilityWindowFactory.ts` 
- `src/windows/factories/CoreWindowFactory.ts`

#### B. CSS Variable Injection Integration
Add CSS variable injection to all window creation functions:
```typescript
// After window creation, before showing:
injectCSSVariables(dialogWindow);
```

### 7. Implementation Checklist

#### Phase 1: Configuration System
- [ ] Update `src/types/config.ts` with `RoundedUI` property
- [ ] Update `src/validation/config-schemas.ts` with validation
- [ ] Update default configuration with platform detection

#### Phase 2: Settings UI
- [ ] Update `src/ui/settings/settings.html` with new checkbox
- [ ] Update `src/ui/settings/settings-renderer.ts` with mapping
- [ ] Add macOS-specific warning display

#### Phase 3: Window System
- [ ] Update `src/windows/shared/WindowConfig.ts` with conditional logic
- [ ] Create `src/utils/CSSVariables.ts` for variable injection
- [ ] Update all dialog factory functions

#### Phase 4: CSS System
- [ ] Update `src/ui/shared/rounded-dialog-template.css` with variables
- [ ] Update all dialog CSS files to use template

#### Phase 5: macOS Integration
- [ ] Add macOS detection logic to `src/index.ts`
- [ ] Create `src/utils/MacOSWarning.ts` warning system


### 8. Technical Notes

#### A. Platform Detection
Use `process.platform === 'darwin'` for macOS detection throughout the codebase.

#### B. Window Configuration Priority
1. **macOS**: Always use standard window configuration (no rounded UI support)
2. **Other Platforms + Rounded**: `frame: false` + `transparent: true`
3. **Other Platforms + Non-Rounded**: Standard window configuration

#### C. CSS Variable System Benefits
- Single source of truth for rounded UI state
- Easy to toggle without CSS file modifications
- Consistent styling across all windows
- Future-proof for additional styling options

#### D. Restart Requirement
The restart is required because:
- Window configuration (frame, transparent, titleBarStyle) can't be changed after creation
- Some CSS changes require window recreation
- Ensures clean state transition

### 9. Future Enhancements

#### A. Theme System Integration
The CSS variable system could be extended to support:
- Multiple UI themes
- Custom color schemes  
- User-defined border radius values
- Animation preferences

#### C. Performance Optimizations
- CSS variable caching
- Window configuration presets
- Lazy loading of platform-specific modules

## Conclusion

This implementation plan provides a comprehensive solution for making the rounded UI system toggleable while fixing the macOS traffic light positioning issues. The system is designed to be maintainable, extensible, and user-friendly with automatic platform detection and appropriate defaults.

The modular approach ensures that existing functionality remains intact while providing the flexibility to support different UI preferences across platforms.