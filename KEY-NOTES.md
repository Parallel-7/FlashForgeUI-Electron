# FlashForge UI TypeScript - Key Notes

## Architecture Overview

### Core Design Principles
1. **TypeScript-First**: Strict type safety, branded types, discriminated unions
2. **Secure Electron**: Context isolation, validated IPC channels, secure preload scripts
3. **Modular System**: Singleton managers, event-driven communication, clean separation
4. **Professional Build**: Webpack + TypeScript + NSIS installer

### Key Patterns
- **Managers**: Singleton pattern via `getInstance()` for all core systems
- **Dialogs**: 4-file structure (HTML, CSS, renderer.ts, preload.ts)
- **Backend**: `UI → Manager → Factory → Backend → API Client(s)`
- **IPC**: Validated channels in preload.ts for security
- **Updates**: 2.5s polling with event-driven state management

### Backend Types
- **GenericLegacyBackend**: FlashForgeClient only, minimal features
- **Adventurer5MBackend**: Dual API, custom features only  
- **Adventurer5MProBackend**: Dual API, full built-in features
- **AD5XBackend**: Dual API + 4-slot material station + local job start

## Critical System Fixes

### Core Backend Fixes
- **Legacy Print Control**: Fixed GenericLegacyBackend to use proper FlashForgeClient methods instead of manual G-code (startJob, pauseJob/resumeJob/stopJob, LED control)
- **Feature Auto-Detection**: Modified ff-api to expose Product endpoint data for automatic LED/filtration capability detection
- **Temperature Display**: Fixed target temperatures by extracting from correct API fields (`machineInfo.PrintBed.set`, `machineInfo.Extruder.set`)
- **IPC Communication**: Fixed dialog functionality using handle/invoke pattern with Promise handling
- **Dual API Connection**: Fixed AD5X/5M backend failures by creating both FiveMClient and FlashForgeClient for dual API printers
- **IP Change Handling**: Fixed DHCP IP change detection using `currentIpAddress` field

### System Integration
- **Build System**: Implemented webpack bundler with `target: 'electron-renderer'` to resolve "require is not defined" errors
- **Windows Admin Privilege Check**: Added `EnvironmentDetectionService.isRunningAsAdmin()` for Web UI server port binding
- **Web UI**: Complete browser-based interface with Express server, WebSocket updates, token authentication

### Web UI Fixes
- **Authentication**: Fixed 401 errors by eliminating circular dependency, setting token first then verifying
- **Token Validation**: Fixed regex to accept JWT-like format (`base64data.hexsignature`)
- **Camera Integration**: Auto-URL fallback for aftermarket cameras, configurable camera proxy port
- **Polling Architecture**: Centralized polling in main process with `MainProcessPollingCoordinator`
- **Layout & Data**: Added lifetime statistics display, improved desktop layout

### LED Control & AD5X Implementation
- **LED Control**: Fixed DualAPIBackend to use ff-api methods by default, standardized with abstract `setLedEnabled()` method
- **AD5X Local Job Start**: Integrated ff-api methods for multi-color/single-color job starting with material matching dialog
- **Dialog Fixes**: Fixed file naming (added "-dialog" suffix), IPC handlers, CSS styling
- **UI Label Preservation**: Fixed label stripping during UI resets with separate helpers

## Critical Patterns

### Code Quality Patterns
- **Validation**: `Schema.safeParse(data)` with success/error handling
- **Error Handling**: `toAppError(error)` → `createErrorResult(appError)`
- **Safe DOM**: `safeQuerySelector()` with null checks before manipulation
- **IPC**: `ipcMain.handle()` with structured responses, `window.api.invoke()` in renderer
- **Feature Detection**: `backendManager.isFeatureAvailable()` with stub info for unavailable features

## Deployment & Production

### Dependencies
- **Core**: electron, zod, express, ff-api, slicer-meta
- **Build**: typescript, webpack, electron-builder, eslint

### Build Commands
- `npm run build` - Full build
- `npm run typecheck` - Type validation  
- `npm run lint` - Code quality
- `npm run dist` - Create installer

### File Size Limits
- Standard: 512 lines max
- Core architectural: 1024 lines (rare exception)

### Security Requirements
- Context isolation: ALWAYS enabled
- Node integration: ALWAYS disabled  
- IPC channels: ALWAYS validated
- External data: ALWAYS validated with Zod

### Production Status
Application is production-ready with comprehensive type safety, error handling, and professional packaging.

### Build & Deployment Fixes
- **Static File Manager**: Environment-aware path resolution service for asset validation
- **Dialog Renderer Fix**: Fixed "require is not defined" by inlining imports in renderer files
- **Notification Job Names**: Fixed "Unknown Job" by preserving job data through 'Completed' state
- **TCP Socket Conflicts**: Fixed thumbnail timeouts with polling pause during job picker operations
- **Thumbnail System**: Complete rewrite with persistent cache and backend-aware request queuing
- **Configuration Management**: Unified duplicate settings to use `ForceLegacyAPI` consistently
- **GitHub Actions**: Fixed naming consistency to match package.json name "flashforge-ui-ts"