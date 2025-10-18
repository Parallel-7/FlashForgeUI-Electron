# FlashForgeUI Auto-Update System Specification

**Repository:** https://github.com/Parallel-7/FlashForgeUI-Electron

## Overview

This specification defines a complete auto-update system for FlashForgeUI using electron-updater with GitHub Releases. The system supports two update channels (stable/alpha) with platform-aware installation behavior.

## Core Principles

- **Industry Standard**: Uses electron-updater (no custom update mechanisms)
- **No Code Signing Required**: Works on Windows without certificates
- **GitHub Releases**: Uses existing release infrastructure
- **Unified Codebase**: Single update service handles all platforms with platform-specific behavior
- **User Control**: Configurable update checking and channel selection
- **Graceful Degradation**: Each platform gets the best experience possible

## Platform Capabilities

| Platform | Check Updates | Download | Auto-Install | User Action Required |
|----------|--------------|----------|--------------|---------------------|
| **Windows** | ✅ Yes | ✅ Yes | ✅ Yes | Click "Install and Restart" |
| **macOS** | ✅ Yes | ✅ Yes | ❌ No | Open DMG, drag to Applications |
| **Linux** | ✅ Yes | ❌ No | ❌ No | Click to open GitHub Releases |

## Update Channels

### Channel System

Uses electron-updater's `allowPrerelease` property for simple two-channel system:

- **Stable Channel** (`allowPrerelease: false`)
  - Only receives normal GitHub releases (NOT marked as pre-release)
  - Recommended for production users
  - Default channel

- **Alpha Channel** (`allowPrerelease: true`)
  - Receives ALL releases including pre-releases
  - For testing new features
  - Enables `allowDowngrade` for channel switching

### Version Scheme

Current versioning (working perfectly with SemVer 2.0):

```
1.0.1       ← Stable release
1.0.1-1     ← Alpha 1
1.0.1-2     ← Alpha 2
...
1.0.1-10    ← Alpha 10
1.0.2       ← Next stable release
```

**Version Comparison Order:**
`1.0.1-1 < 1.0.1-2 < ... < 1.0.1-10 < 1.0.2`

### GitHub Release Configuration

**Stable Release:**
1. Tag: `v1.0.2`
2. Title: `FlashForgeUI v1.0.2`
3. ✅ Set as the latest release
4. ❌ DO NOT check "Set as a pre-release"
5. Upload: `.exe`, `.dmg`, `.AppImage`

**Alpha Release:**
1. Tag: `v1.0.1-1` (or `v1.0.1-2`, etc.)
2. Title: `FlashForgeUI v1.0.1 Alpha 1`
3. ❌ DO NOT set as the latest release
4. ✅ Check "Set as a pre-release"
5. Upload: `.exe`, `.dmg`, `.AppImage`

## Configuration Schema

### New Config Properties

Add to `AppConfig` interface in `src/types/config.ts`:

```typescript
export interface AppConfig {
  // ... existing properties ...

  // Auto-update settings
  readonly CheckForUpdatesOnLaunch: boolean;      // Enable/disable auto-check on launch
  readonly UpdateChannel: 'stable' | 'alpha';      // Update channel selection
  readonly AutoDownloadUpdates: boolean;           // Auto-download when available
  readonly DismissedUpdateVersion: string;         // Track dismissed update versions
}
```

### Default Values

```typescript
export const DEFAULT_CONFIG: AppConfig = {
  // ... existing defaults ...

  CheckForUpdatesOnLaunch: true,
  UpdateChannel: 'stable',
  AutoDownloadUpdates: false,
  DismissedUpdateVersion: '',
}
```

### Settings UI Mapping

Add to `INPUT_TO_CONFIG_MAP` in `src/ui/settings/settings-renderer.ts`:

```typescript
const INPUT_TO_CONFIG_MAP: Record<string, keyof AppConfig> = {
  // ... existing mappings ...
  'check-updates-on-launch': 'CheckForUpdatesOnLaunch',
  'update-channel': 'UpdateChannel',
  'auto-download-updates': 'AutoDownloadUpdates',
};
```

## Architecture

### New Files to Create

#### Core Service
- **`src/services/AutoUpdateService.ts`**
  - Singleton service managing electron-updater
  - Event-driven state management
  - Platform-aware installation logic
  - Channel switching support

#### UI Components
- **`src/ui/update-available/update-available.html`**
  - Update notification dialog
  - Platform-aware button display
  - Progress bar for downloads

- **`src/ui/update-available/update-available.css`**
  - Dialog styling matching app theme

- **`src/ui/update-available/update-available-renderer.ts`**
  - Dialog logic and event handling
  - Platform detection and UI adaptation

- **`src/ui/update-available/update-available-preload.ts`**
  - IPC bridge for update dialog

#### Window Management
- **`src/windows/shared/WindowTypes.ts`** (modify)
  - Add `UPDATE_AVAILABLE_DIALOG` to `WindowType` enum

- **`src/windows/factories/DialogWindowFactory.ts`** (modify)
  - Add factory method for update dialog

#### IPC Handlers
- **`src/ipc/handlers/update-handlers.ts`**
  - `check-for-updates` - Manual update check
  - `download-update` - Start download
  - `install-update` - Platform-aware install
  - `open-installer` - Open downloaded file (macOS/Linux)
  - `open-release-page` - Open GitHub releases (Linux)
  - `get-update-status` - Current update state
  - `dismiss-update` - User dismissed notification
  - `set-update-channel` - Change update channel

#### Build Configuration
- **`electron-builder-config.js`** (modify)
  - Add GitHub publish configuration

- **`package.json`** (modify)
  - Add electron-updater dependency
  - Add electron-log dependency

### Files to Modify

#### Settings UI
- **`src/ui/settings/settings.html`**
  - Add auto-update settings section

- **`src/ui/settings/settings-renderer.ts`**
  - Handle new update settings
  - Add "Check for Updates Now" button handler

#### Main Process
- **`src/index.ts`**
  - Initialize AutoUpdateService on app ready

- **`src/ipc/handlers/index.ts`**
  - Register update handlers

## AutoUpdateService Implementation

### Update States

```typescript
export enum UpdateState {
  IDLE = 'idle',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  ERROR = 'error'
}
```

### Core Service Structure

```typescript
class AutoUpdateService extends EventEmitter {
  private currentState: UpdateState = UpdateState.IDLE;
  private updateInfo: UpdateInfo | null = null;
  private downloadProgress: UpdateProgress | null = null;
  private lastError: Error | null = null;

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure logging
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false; // Manual control
    autoUpdater.autoInstallOnAppQuit = true;

    // Event listeners
    autoUpdater.on('checking-for-update', () => this.handleCheckingForUpdate());
    autoUpdater.on('update-available', (info) => this.handleUpdateAvailable(info));
    autoUpdater.on('update-not-available', (info) => this.handleUpdateNotAvailable(info));
    autoUpdater.on('download-progress', (progress) => this.handleDownloadProgress(progress));
    autoUpdater.on('update-downloaded', (info) => this.handleUpdateDownloaded(info));
    autoUpdater.on('error', (error) => this.handleError(error));
  }

  public async initialize(): Promise<void> {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    // Set update channel
    this.setUpdateChannel(config.UpdateChannel);

    // Listen for config changes
    configManager.on('config:UpdateChannel', (newChannel: 'stable' | 'alpha') => {
      this.setUpdateChannel(newChannel);
    });

    // Check on launch if enabled (delayed to not slow startup)
    if (config.CheckForUpdatesOnLaunch) {
      setTimeout(() => {
        this.checkForUpdates();
      }, 3000);
    }
  }

  public setUpdateChannel(channel: 'stable' | 'alpha'): void {
    if (channel === 'alpha') {
      autoUpdater.allowPrerelease = true;
      autoUpdater.allowDowngrade = true;
      log.info('Update channel: alpha (pre-releases enabled)');
    } else {
      autoUpdater.allowPrerelease = false;
      autoUpdater.allowDowngrade = false;
      log.info('Update channel: stable (pre-releases disabled)');
    }
  }

  public async checkForUpdates(): Promise<void> {
    if (this.currentState === UpdateState.CHECKING ||
        this.currentState === UpdateState.DOWNLOADING) {
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (this.currentState !== UpdateState.AVAILABLE) {
      throw new Error('No update available to download');
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public quitAndInstall(): void {
    if (this.currentState !== UpdateState.DOWNLOADED) {
      throw new Error('No update downloaded to install');
    }

    // Platform-specific behavior
    if (process.platform === 'win32') {
      // Windows: Full auto-install
      autoUpdater.quitAndInstall(false, true);
    } else if (process.platform === 'darwin') {
      // macOS: Open downloaded DMG in Finder
      this.openDownloadedFile();
    } else if (process.platform === 'linux') {
      // Linux: Open downloaded AppImage location
      this.openDownloadedFile();
    }
  }

  private openDownloadedFile(): void {
    const { shell } = require('electron');
    // Show the downloaded file in file manager
    // electron-updater provides the download path
    shell.showItemInFolder(this.getDownloadedFilePath());
  }

  private getDownloadedFilePath(): string {
    // Get path from electron-updater's download cache
    // Implementation depends on electron-updater's API
    return '';
  }

  public openReleasePage(): void {
    const { shell } = require('electron');
    shell.openExternal('https://github.com/Parallel-7/FlashForgeUI-Electron/releases');
  }

  // Event handlers emit state changes
  private setState(state: UpdateState): void {
    this.currentState = state;
    this.emit('state-changed', {
      state,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      error: this.lastError
    });
  }
}

let instance: AutoUpdateService | null = null;

export const getAutoUpdateService = (): AutoUpdateService => {
  if (!instance) {
    instance = new AutoUpdateService();
  }
  return instance;
};
```

## Update Dialog UI

### Dialog States and Platform Behavior

#### State: UPDATE_AVAILABLE

**Windows:**
- Button: "Download & Install"
- Action: Download → Auto-install on completion

**macOS:**
- Button: "Download Update"
- Action: Download → Show "Open Installer" when done

**Linux:**
- Button: "View on GitHub"
- Action: Open releases page in browser

#### State: DOWNLOADING (Windows & macOS only)

- Show progress bar
- Display download percentage
- Display bytes transferred / total

#### State: DOWNLOADED

**Windows:**
- Button: "Install and Restart"
- Action: Quit app and install update

**macOS:**
- Button: "Open Installer"
- Action: Open DMG in Finder with instructions

**Linux:**
- Not applicable (no download happens)

### Dialog HTML Structure

```html
<div class="update-dialog">
  <h2>Update Available</h2>

  <div id="version-info">
    <p>Current Version: <span id="current-version"></span></p>
    <p>New Version: <span id="new-version"></span></p>
  </div>

  <div id="release-notes">
    <!-- Optional: Show release notes from GitHub -->
  </div>

  <!-- Progress section (Windows & macOS) -->
  <div id="download-progress" style="display: none;">
    <progress id="progress-bar" max="100" value="0"></progress>
    <span id="progress-text">0%</span>
    <span id="download-size">0 MB / 0 MB</span>
  </div>

  <!-- Platform-specific buttons -->
  <div class="button-group">
    <!-- State: UPDATE_AVAILABLE -->
    <button id="btn-download" class="primary">
      <span class="btn-text-windows">Download & Install</span>
      <span class="btn-text-mac">Download Update</span>
      <span class="btn-text-linux">View on GitHub</span>
    </button>

    <!-- State: DOWNLOADED (Windows) -->
    <button id="btn-install-windows" class="primary" style="display: none;">
      Install and Restart
    </button>

    <!-- State: DOWNLOADED (macOS) -->
    <button id="btn-install-mac" class="primary" style="display: none;">
      Open Installer
    </button>

    <button id="btn-later">Remind Me Later</button>
  </div>

  <!-- Platform-specific instructions -->
  <div id="platform-notice" class="info-text" style="display: none;">
    <!-- Shown on macOS: "After downloading, drag the app to Applications to install." -->
    <!-- Shown on Linux: "Manual installation required for Linux." -->
  </div>
</div>
```

## Settings UI

### HTML Addition

Add to Column 1 in `src/ui/settings/settings.html`:

```html
<div class="settings-section" style="margin-top: 20px;">
    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #666;">
        Auto-Update Settings
    </h4>

    <label class="checkbox-label">
        <input type="checkbox" id="check-updates-on-launch"> Check for Updates on Launch
    </label>
    <div class="settings-info-text">
        Automatically check for updates when the app starts.
    </div>

    <div class="input-group">
        <label for="update-channel">Update Channel:</label>
        <select id="update-channel" class="settings-input">
            <option value="stable">Stable (Recommended)</option>
            <option value="alpha">Alpha (Pre-Release)</option>
        </select>
    </div>
    <div class="settings-info-text">
        <strong>Stable:</strong> Only major releases (e.g., v1.0.2)<br>
        <strong>Alpha:</strong> Pre-release versions for testing (e.g., v1.0.1-1)<br>
        ⚠️ Changing channels takes effect on next update check.
    </div>

    <label class="checkbox-label">
        <input type="checkbox" id="auto-download-updates"> Auto-Download Updates
    </label>
    <div class="settings-info-text">
        Automatically download updates in the background. You'll be prompted before installation.
    </div>

    <button class="settings-button" id="check-now-button">Check for Updates Now</button>
    <span id="update-check-status" class="settings-info-text"></span>
</div>
```

## IPC Handlers

### Handler Registration

```typescript
// src/ipc/handlers/update-handlers.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getAutoUpdateService, UpdateState } from '../../services/AutoUpdateService';
import { getWindowManager } from '../../windows/WindowManager';
import { getConfigManager } from '../../managers/ConfigManager';

export function setupUpdateHandlers(): void {
  const updateService = getAutoUpdateService();
  const windowManager = getWindowManager();
  const configManager = getConfigManager();

  // Manual check for updates
  ipcMain.handle('check-for-updates', async () => {
    await updateService.checkForUpdates();
    return {
      state: updateService.getState(),
      updateInfo: updateService.getUpdateInfo()
    };
  });

  // Download update
  ipcMain.handle('download-update', async () => {
    await updateService.downloadUpdate();
    return { success: true };
  });

  // Install update (platform-aware)
  ipcMain.handle('install-update', () => {
    updateService.quitAndInstall();
  });

  // Open installer (macOS/Linux)
  ipcMain.handle('open-installer', () => {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      updateService.openDownloadedFile();
    }
  });

  // Open GitHub releases page
  ipcMain.handle('open-release-page', () => {
    updateService.openReleasePage();
  });

  // Get current update status
  ipcMain.handle('get-update-status', () => {
    return {
      state: updateService.getState(),
      updateInfo: updateService.getUpdateInfo(),
      downloadProgress: updateService.getDownloadProgress(),
      error: updateService.getLastError()
    };
  });

  // Dismiss update notification
  ipcMain.handle('dismiss-update', async (_event: IpcMainInvokeEvent, version: string) => {
    configManager.set('DismissedUpdateVersion', version);
  });

  // Set update channel
  ipcMain.handle('set-update-channel', async (_event: IpcMainInvokeEvent, channel: 'stable' | 'alpha') => {
    updateService.setUpdateChannel(channel);
    return { success: true };
  });

  // Forward update state changes to renderer
  updateService.on('state-changed', (data) => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-state-changed', data);
    }

    // Show update dialog when update is available
    if (data.state === UpdateState.AVAILABLE || data.state === UpdateState.DOWNLOADED) {
      const dismissedVersion = configManager.get('DismissedUpdateVersion');

      if (data.updateInfo && data.updateInfo.version !== dismissedVersion) {
        // Open update dialog
        // windowFactory.createUpdateDialog(data);
      }
    }
  });
}
```

### Handler Registration in Main Process

In `src/ipc/handlers/index.ts`:

```typescript
import { setupUpdateHandlers } from './update-handlers';

export function registerAllIpcHandlers(managers: ManagerCollection): void {
  // ... existing handler registrations ...

  setupUpdateHandlers();
  console.log('Update IPC handlers registered');
}
```

## Build Configuration

### electron-builder Configuration

Update `electron-builder-config.js`:

```javascript
module.exports = {
  // ... existing config ...

  // Publish configuration for auto-updates
  publish: [
    {
      provider: 'github',
      owner: 'Parallel-7',
      repo: 'FlashForgeUI-Electron',
      releaseType: 'release', // Overridden by allowPrerelease at runtime
    }
  ],

  // ... rest of config ...
};
```

### Package Dependencies

Update `package.json`:

```json
{
  "dependencies": {
    "electron-updater": "^6.6.2",
    "electron-log": "^5.2.4"
  }
}
```

## Main Process Integration

### Initialization

In `src/index.ts`, add after app ready:

```typescript
// Initialize auto-update service
const autoUpdateService = getAutoUpdateService();
await autoUpdateService.initialize();
console.log('Auto-update service initialized');
```

## Update Flow Diagrams

### Windows Update Flow

```
User launches app
  ↓
AutoUpdateService.initialize()
  ↓
CheckForUpdatesOnLaunch? → Yes
  ↓
Delay 3 seconds (non-blocking startup)
  ↓
autoUpdater.checkForUpdates()
  ↓
Fetches latest.yml from GitHub
  ↓
Compares versions
  ↓
[NEW VERSION AVAILABLE]
  ↓
Show update dialog
  ↓
User clicks "Download & Install"
  ↓
Download installer with progress bar
  ↓
[DOWNLOAD COMPLETE]
  ↓
Dialog shows "Install and Restart"
  ↓
User clicks "Install and Restart"
  ↓
App quits → Installer runs → App restarts with new version
```

### macOS Update Flow

```
User launches app
  ↓
AutoUpdateService.initialize()
  ↓
CheckForUpdatesOnLaunch? → Yes
  ↓
Delay 3 seconds
  ↓
autoUpdater.checkForUpdates()
  ↓
Fetches latest-mac.yml from GitHub
  ↓
Compares versions
  ↓
[NEW VERSION AVAILABLE]
  ↓
Show update dialog
  ↓
User clicks "Download Update"
  ↓
Download DMG with progress bar
  ↓
[DOWNLOAD COMPLETE]
  ↓
Dialog shows "Open Installer" + Instructions
  ↓
User clicks "Open Installer"
  ↓
Finder opens showing DMG
  ↓
User manually drags app to Applications folder
```

### Linux Update Flow

```
User launches app
  ↓
AutoUpdateService.initialize()
  ↓
CheckForUpdatesOnLaunch? → Yes
  ↓
Delay 3 seconds
  ↓
autoUpdater.checkForUpdates()
  ↓
Fetches latest-linux.yml from GitHub
  ↓
Compares versions
  ↓
[NEW VERSION AVAILABLE]
  ↓
Show update dialog
  ↓
Dialog shows "View on GitHub"
  ↓
User clicks "View on GitHub"
  ↓
Browser opens to GitHub Releases page
  ↓
User manually downloads and installs AppImage
```

## Channel Switching Scenarios

### Stable → Alpha (Upgrade)

```
Current Version: 1.0.2 (stable)
User changes: UpdateChannel = 'alpha'

AutoUpdateService.setUpdateChannel('alpha')
  ↓
autoUpdater.allowPrerelease = true
autoUpdater.allowDowngrade = true
  ↓
Next update check sees:
- 1.0.2 (normal release)
- 1.0.2-1 (pre-release)
  ↓
Result: Update to 1.0.2-1 available
```

### Alpha → Stable (Potential Downgrade)

```
Current Version: 1.0.2-1 (alpha)
User changes: UpdateChannel = 'stable'

AutoUpdateService.setUpdateChannel('stable')
  ↓
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false
  ↓
Next update check sees:
- 1.0.2 (normal release) ← Lower than 1.0.2-1
  ↓
Result: No update available (can't downgrade)
       User stays on 1.0.2-1 until 1.0.3 stable releases
```

### Alpha Progression

```
Current: 1.0.1
Channel: Alpha

Check 1: Finds 1.0.1-1 → Update to 1.0.1-1
Check 2: Finds 1.0.1-2 → Update to 1.0.1-2
Check 3: Finds 1.0.1-10 → Update to 1.0.1-10
Check 4: Finds 1.0.2 → Update to 1.0.2 (stable release)
```

## Error Handling

### Common Error Scenarios

1. **Network Error**
   - Show error in dialog: "Unable to check for updates. Check your internet connection."
   - Allow retry

2. **Download Failed**
   - Show error with retry button
   - Log error details for debugging

3. **Invalid Version Format**
   - Log warning
   - Skip that release

4. **GitHub API Rate Limit**
   - Gracefully handle (5000 requests/hour limit)
   - Show appropriate message to user

5. **Insufficient Disk Space**
   - Detect before download
   - Show clear error message

## Testing Strategy

### Manual Testing Checklist

**Windows:**
- [ ] Update detection works
- [ ] Download shows progress
- [ ] Install and restart works
- [ ] App successfully updates to new version

**macOS:**
- [ ] Update detection works
- [ ] Download shows progress
- [ ] DMG opens in Finder
- [ ] Manual installation completes

**Linux:**
- [ ] Update detection works
- [ ] GitHub releases page opens
- [ ] Manual download and install works

**Channel Switching:**
- [ ] Stable → Alpha shows pre-releases
- [ ] Alpha → Stable hides pre-releases
- [ ] Version comparison works correctly

**Edge Cases:**
- [ ] No internet connection
- [ ] Already on latest version
- [ ] Dismissed update doesn't re-appear
- [ ] Multiple rapid update checks don't conflict
- [ ] Auto-download setting respected

### Version Testing Matrix

| Current | Channel | Available Releases | Expected Result |
|---------|---------|-------------------|-----------------|
| 1.0.1 | Stable | 1.0.2, 1.0.2-1 | Update to 1.0.2 |
| 1.0.1 | Alpha | 1.0.2, 1.0.2-1 | Update to 1.0.2-1 |
| 1.0.2-1 | Stable | 1.0.2 | No update (can't downgrade) |
| 1.0.2-1 | Alpha | 1.0.2, 1.0.2-2 | Update to 1.0.2-2 |
| 1.0.2 | Stable | 1.0.2 | No update available |
| 1.0.1-5 | Alpha | 1.0.1-1 to 1.0.1-10 | Update to 1.0.1-10 |

## Security Considerations

### Update Verification

electron-updater automatically verifies updates using:
- **SHA512 checksums** in `latest.yml` files
- **Code signature verification** (if app is signed)
- **HTTPS** for all GitHub communications

### No Code Signing Impact

**Windows (unsigned):**
- ✅ Auto-update works
- ⚠️ SmartScreen warning on first install only
- ✅ Updates don't trigger SmartScreen (installed by trusted app)

**macOS (unsigned):**
- ❌ Auto-install blocked by Gatekeeper
- ✅ Download works
- ✅ User can manually install from DMG

**Linux (unsigned):**
- ✅ No signing required
- ✅ AppImage runs without installation

## Known Limitations

1. **First Launch**: Can't update on first app launch (installer limitation)
2. **macOS Auto-Install**: Requires code signing for automatic installation
3. **Portable Builds**: Windows portable .exe doesn't support auto-update
4. **Linux AppImage**: Auto-install can be problematic, manual preferred
5. **Channel Downgrade**: Can't automatically downgrade from alpha to older stable

## Future Enhancements

Not in initial implementation but possible to add later:

1. **Update History**: Show changelog for multiple versions
2. **Selective Skip**: Allow users to skip specific versions permanently
3. **Beta Channel**: Third channel between stable and alpha
4. **Rollback**: Ability to downgrade to previous version
5. **Silent Updates**: Background updates with minimal user interaction
6. **Bandwidth Throttling**: Limit download speed for updates
7. **Delta Updates**: Only download changed files (electron-updater supports this)
8. **Code Signing**: Add signing later to improve macOS experience

## Documentation Updates Required

After implementation:

1. **README.md**: Add auto-update section explaining channels
2. **CLAUDE.md**: Document AutoUpdateService in architecture section
3. **User Guide**: Explain update settings and channel selection
4. **Developer Guide**: How to create releases for auto-update
5. **Release Process**: Document stable vs alpha release procedures

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Add dependencies to package.json
- [ ] Create AutoUpdateService.ts with full implementation
- [ ] Update config.ts schema with new properties
- [ ] Update DEFAULT_CONFIG with defaults
- [ ] Add publish config to electron-builder-config.js
- [ ] Initialize AutoUpdateService in index.ts
- [ ] Add @fileoverview documentation to new files

### Phase 2: Settings UI
- [ ] Add settings section HTML to settings.html
- [ ] Update INPUT_TO_CONFIG_MAP in settings-renderer.ts
- [ ] Add "Check Now" button handler
- [ ] Add channel selection dropdown handler
- [ ] Test settings persistence

### Phase 3: Update Dialog
- [ ] Create update-available.html with platform-aware buttons
- [ ] Create update-available.css matching app theme
- [ ] Implement update-available-renderer.ts with state management
- [ ] Create update-available-preload.ts for IPC
- [ ] Add UPDATE_AVAILABLE_DIALOG to WindowType enum
- [ ] Add factory method to DialogWindowFactory
- [ ] Test dialog on all platforms

### Phase 4: IPC Integration
- [ ] Create update-handlers.ts with all handlers
- [ ] Register handlers in index.ts
- [ ] Test IPC communication from settings
- [ ] Test IPC communication from update dialog
- [ ] Test state change event forwarding

### Phase 5: Testing
- [ ] Create test alpha release on GitHub
- [ ] Test stable channel update detection
- [ ] Test alpha channel update detection
- [ ] Test channel switching (stable ↔ alpha)
- [ ] Test Windows auto-install
- [ ] Test macOS download and manual install
- [ ] Test Linux GitHub redirect
- [ ] Test dismissed updates
- [ ] Test auto-download setting
- [ ] Test error scenarios

### Phase 6: Documentation
- [ ] Update README.md
- [ ] Update CLAUDE.md
- [ ] Add inline code documentation
- [ ] Document release process
- [ ] Create user guide section

## Success Criteria

Implementation is complete when:

✅ Users can enable/disable update checking on launch
✅ Users can switch between stable and alpha channels
✅ Windows users get full auto-update experience
✅ macOS users get download + manual install experience
✅ Linux users get redirected to GitHub releases
✅ Update detection works correctly for both channels
✅ Version comparison handles 1.0.1-X format correctly
✅ All settings persist correctly
✅ No errors in type checking (`npm run type-check`)
✅ All code follows project documentation standards
✅ Integration with existing ConfigManager works
✅ Integration with existing WindowManager works

---

**End of Specification**
