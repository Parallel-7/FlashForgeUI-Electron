# FlashForgeUI-Electron Architecture Reference

This document provides essential architectural information, development commands, and common patterns for working with the FlashForgeUI-Electron codebase.

---

## Core Components

- **Main Process** (`src/index.ts`): Electron main process entry point
- **Renderer Process** (`src/renderer.ts`): Main UI renderer
- **Preload Scripts** (`src/preload.ts`): Secure IPC bridge between main and renderer
- **WebUI Server** (`src/webui/`): Express-based web interface for remote access

## Key Directories

- `src/managers/`: Core application managers (Config, Connection, Backend, etc.)
- `src/services/`: Business logic services (Discovery, Polling, Notifications, etc.)
- `src/printer-backends/`: Printer-specific backend implementations
- `src/ui/`: Various dialog windows and UI components
- `src/webui/`: Web-based interface with REST API and WebSocket support
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions and helpers

## Key Services and Managers

### Managers (Singleton Pattern)
- **ConfigManager**: Application configuration management
- **ConnectionFlowManager**: Printer connection orchestration
- **LoadingManager**: UI loading state management
- **PrinterBackendManager**: Backend lifecycle and selection
- **PrinterDetailsManager**: Saved printer data persistence

### Services
- **PrinterDiscoveryService**: Network printer discovery
- **PrinterPollingService**: Real-time printer status updates
- **ConnectionEstablishmentService**: Connection establishment logic
- **NotificationService**: System notifications for print events
- **CameraProxyService**: Camera stream proxy server
- **ThumbnailRequestQueue**: Job thumbnail processing

## External Dependencies

- **ff-api**: FlashForge printer communication library
  - Repository: https://github.com/GhostTypes/ff-5mp-api-ts
  - Package: https://github.com/GhostTypes/ff-5mp-api-ts/pkgs/npm/ff-api
- **slicer-meta**: G-code metadata parsing
  - Repository: https://github.com/Parallel-7/slicer-meta
  - Package: https://github.com/orgs/Parallel-7/packages/npm/package/slicer-meta
- **electron**: Desktop application framework
- **express**: Web server for WebUI
- **ws**: WebSocket implementation
- **axios**: HTTP client for API calls

---

## Development Commands

### Build Commands
- `npm run build` - Build all components (main, renderer, webui)
- `npm run build:main` - Compile main process TypeScript
- `npm run build:renderer` - Bundle renderer with Webpack
- `npm run build:webui` - Build WebUI static files
- `npm run dev` - Development mode with file watching

### Quality Assurance
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run docs:check` - Check for @fileoverview documentation

### Platform-Specific Builds
- `npm run build:win` - Windows NSIS installer + portable
- `npm run build:linux` - Linux AppImage, deb, rpm packages
- `npm run build:mac` - macOS DMG package

### Utility Commands
- `npm start` - Build and run the application
- `npm run linecount` - Generate line count statistics (supports `-- --min-lines=N` to show only files with N+ lines)
- `npm run clean` - Remove build artifacts

---

## Backend Architecture

### Backend Hierarchy

```
BasePrinterBackend (abstract)
├── GenericLegacyBackend
│   └── Uses: FlashForgeClient only
│   └── Features: Basic legacy printer support
│
└── DualAPIBackend (abstract)
    ├── Adventurer5MBackend
    │   └── Uses: FiveMClient + FlashForgeClient
    │   └── Features: Custom controls only
    │
    ├── Adventurer5MProBackend
    │   └── Uses: FiveMClient + FlashForgeClient
    │   └── Features: Full built-in features (LED, filtration)
    │
    └── AD5XBackend
        └── Uses: FiveMClient + FlashForgeClient
        └── Features: 4-slot material station + local job start
```

### Backend Selection Flow

```
UI Request
    ↓
ConnectionFlowManager
    ↓
PrinterBackendManager.createBackend()
    ↓
PrinterBackendFactory.createBackend()
    ↓
Backend Instance (GenericLegacy | Adventurer5M | Adventurer5MPro | AD5X)
    ↓
API Client(s) (FlashForgeClient and/or FiveMClient)
```

### Backend Capabilities

**GenericLegacyBackend:**
- Single API client (FlashForgeClient)
- Basic status monitoring
- Job control (start, pause, resume, stop)
- LED control via G-code
- Temperature control
- Local job listing and starting
- Thumbnail support (M662 command)
- No file uploads, no recent jobs, no advanced features

**Adventurer5MBackend:**
- Dual API clients (FiveMClient + FlashForgeClient)
- Enhanced status monitoring
- Job management (list, start, upload)
- Custom control support only
- No built-in LED/filtration

**Adventurer5MProBackend:**
- Dual API clients (FiveMClient + FlashForgeClient)
- Full feature set
- Built-in LED control
- Built-in filtration control
- Custom control support
- Complete job management

**AD5XBackend:**
- Dual API clients (FiveMClient + FlashForgeClient)
- 4-slot material station support
- Local job starting with material matching
- Multi-color and single-color job workflows
- Material validation and compatibility checking
- Enhanced job management

### Backend Factory Pattern

The factory uses printer model detection to select appropriate backend:

```typescript
// Simplified logic
if (config.ForceLegacyAPI || isLegacyModel(model)) {
  return new GenericLegacyBackend(...)
}

switch(model) {
  case 'Adventurer 5X': return new AD5XBackend(...)
  case 'Adventurer 5M Pro': return new Adventurer5MProBackend(...)
  case 'Adventurer 5M': return new Adventurer5MBackend(...)
  default: return new GenericLegacyBackend(...)
}
```

---

## Common Pitfalls & Patterns

### Code Quality Patterns

**Validation:**
```typescript
// Validate data before processing
if (!isValidData(data)) {
  // Handle validation error
  return createErrorResult(new AppError(...));
}
// Process validated data
```

**Error Handling:**
```typescript
try {
  // Operation
} catch (error) {
  const appError = toAppError(error);
  return createErrorResult(appError);
}
```

**Safe DOM Manipulation:**
```typescript
const element = safeQuerySelector('#my-element');
if (!element) {
  logger.error('Element not found');
  return;
}
// Safe to use element
```

**IPC Communication:**
```typescript
// Main process (handler)
ipcMain.handle('channel-name', async (event, arg) => {
  try {
    const result = await operation(arg);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Renderer process (caller)
const response = await window.api.invoke('channel-name', arg);
if (response.success) {
  // Use response.data
} else {
  // Handle response.error
}
```

**Feature Detection:**
```typescript
const backendManager = getPrinterBackendManager();
if (!backendManager.isFeatureAvailable('ledControl')) {
  // Show stub info or disable button
  return;
}
// Feature is available
```

### Security Requirements

**Context Isolation:**
- ALWAYS enabled in BrowserWindow configuration
- NEVER disable for convenience

**Node Integration:**
- ALWAYS disabled in renderer processes
- Use preload scripts for secure IPC bridge

**IPC Channel Validation:**
- ALWAYS validate channels in preload scripts
- Use explicit channel allow-lists
- Never expose arbitrary IPC access

**External Data Validation:**
- ALWAYS validate external data
- Never trust printer response data
- Validate before processing or displaying

### Common Mistakes to Avoid

**1. Dialog File Naming:**
- Dialog files MUST include "-dialog" suffix
- Example: `material-matching-dialog.html`, not `material-matching.html`
- WindowFactory expects this naming convention

**2. Renderer Import Errors:**
- Dialog renderers run in browser context
- CANNOT use ES6 imports that compile to `require()`
- Must inline types and utilities directly

**3. CSS Selector Mismatches:**
- Always verify HTML class names match CSS selectors
- Read component TypeScript `templateHTML` property first
- Don't blindly edit CSS without checking actual HTML

**4. Dual UI Mode Compliance:**
- All UI must work in both "rounded" and "square" modes
- Use CSS variables from CSSVariables.ts
- Never hardcode border-radius or padding values
- Import shared template: `@import url('../shared/rounded-dialog-template.css')`

**5. IPC Pattern Mistakes:**
- Use `ipcMain.handle()` with `window.api.invoke()` for request-response
- Use `ipcMain.on()` with `window.api.send()` for fire-and-forget
- Always return structured responses with success/error handling

**6. Backend Feature Assumptions:**
- Never assume all printers support all features
- Always check `backend.features` capabilities
- Use `isFeatureAvailable()` before operations

**7. Polling During Operations:**
- Pause polling during job picker operations (prevents TCP conflicts)
- Resume polling after dialog closes
- Essential for GenericLegacyBackend (single TCP socket)

**8. Path Resolution:**
- Use EnvironmentDetectionService for all asset paths
- Never hardcode paths like `'src/...'` or `'dist/...'`
- Support both development and production environments

### File Structure Conventions

**Dialog Structure (4 files):**
```
dialog-name-dialog.html     # HTML template
dialog-name-dialog.css      # Styles (imports shared template)
dialog-name-dialog-preload.ts   # Secure IPC bridge
dialog-name-dialog-renderer.ts  # UI logic (inline types)
```

**Component Structure:**
```
src/ui/components/component-name/
├── component-name.ts       # Component class
└── component-name.css      # Component styles
```

**Service/Manager Pattern:**
```typescript
// Singleton pattern
let instance: ServiceName | null = null;

export function getServiceName(): ServiceName {
  if (!instance) {
    instance = new ServiceName();
  }
  return instance;
}

// Usage
const service = getServiceName();
```

---

## IPC Communication

- **Main-Renderer IPC**: Secure communication via preload scripts
- **Dialog Windows**: Separate renderer processes for various dialogs
- **Event-Driven**: Extensive use of EventEmitter pattern

## Testing

- Jest configuration for unit tests
- Test files located in `src/services/__tests__/`
- Test utilities and mocks for service testing

## Common Architecture Patterns

- Singleton managers accessed via `getXXXManager()` functions
- Service classes extending EventEmitter for event-driven architecture
- Type-safe IPC communication
- Feature flags and backend capabilities for printer-specific functionality

---

## Critical System Notes

### WebUI Server Architecture
- Express server on configurable port (default 8005)
- Token-based authentication with session management
- WebSocket for real-time status updates
- REST API endpoints for printer control
- Static files served from `src/webui/static/`
- Starts when printer connects, stops on disconnect
- Requires admin privileges on Windows for port binding

### Thumbnail System
- Persistent file-based cache in `cache/thumbnails/{printerSerial}/`
- Backend-aware request queuing:
  - GenericLegacyBackend: 1 concurrent request (sequential)
  - DualAPIBackend: 3 concurrent requests
- No expiration - cached forever
- Queue cancellation on dialog close

### Configuration Management
- Type definitions in `src/types/config.ts`
- User data stored in Electron userData directory
- Use `ForceLegacyAPI` setting (NOT `forceLegacy`)

### Build System
- TypeScript compilation for main process
- Webpack bundling for renderer (target: 'electron-renderer')
- Separate WebUI build with static file copying
- NSIS installer for Windows, DMG for macOS, AppImage/deb/rpm for Linux
- GitHub Actions workflow for multi-platform builds

---

---

## UI Debugging and CSS Architecture

### Critical CSS Debugging Principles

Based on resolved issues in the component architecture, follow these essential debugging practices:

**Always Verify HTML-CSS Alignment First:**
- Before editing CSS, read the component's TypeScript file to examine the actual `templateHTML` property
- Verify CSS selectors match the exact class names used in the HTML template
- Common failure: CSS targets `.component-name` but HTML uses `.name-container`

**Component Architecture Understanding:**
- FlashForgeUI components are in `src/ui/components/[component-name]/`
- TypeScript files contain `templateHTML` with actual HTML structure
- CSS files must target exact classes used in templateHTML
- CSS is imported into the TypeScript component file

**Red Flags - Stop and Investigate When:**
- Multiple CSS changes show no visual effect
- User reports "still not working" after several attempts
- Spacing/layout changes aren't appearing in UI
- CSS selectors appear correct but styles aren't applying

**Systematic Debugging Process:**
1. **Read component's TypeScript file** to see actual HTML template
2. **Compare HTML class names** to CSS selector names
3. **Fix selector mismatches** before making style changes
4. **Test incrementally** - make one change and verify effect
5. **Ask user for confirmation** when changes should be visible

**Avoid Blind CSS Attempts:**
- STOP making more CSS changes if current changes aren't taking effect
- Investigate WHY styles aren't applying rather than trying different approaches
- Fix root cause (selector mismatch) rather than working around symptoms

---

## Project Status

- ✅ Zero TypeScript compilation errors
- ✅ Zero ESLint warnings
- ✅ Production-ready with comprehensive error handling
- ✅ Cross-platform builds (Windows, Linux, macOS)
- ✅ Professional NSIS installer
- ✅ Complete WebUI for remote access
- ✅ All core features implemented and tested
