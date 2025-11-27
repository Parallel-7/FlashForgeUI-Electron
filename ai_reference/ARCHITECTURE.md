# FlashForgeUI-Electron Architecture Reference

**Last Updated:** 2025-01-26

This document provides comprehensive architectural documentation for FlashForgeUI-Electron, covering all major systems, design patterns, and integration points.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Bootstrap and Entry Points](#2-bootstrap-and-entry-points)
3. [Core Managers](#3-core-managers)
4. [Multi-Context Architecture](#4-multi-context-architecture)
5. [Printer Backend System](#5-printer-backend-system)
6. [IPC Communication Architecture](#6-ipc-communication-architecture)
7. [Renderer and UI Components](#7-renderer-and-ui-components)
8. [Window Management](#8-window-management)
9. [WebUI and Headless Mode](#9-webui-and-headless-mode)
10. [External Integrations](#10-external-integrations)
11. [Type System](#11-type-system)
12. [Utilities and Helpers](#12-utilities-and-helpers)
13. [Build System](#13-build-system)
14. [Quality Assurance](#14-quality-assurance)
15. [Development Workflow](#15-development-workflow)

---

## 1. System Overview

FlashForgeUI-Electron is a sophisticated desktop and headless controller for FlashForge 3D printers built on Electron. The application supports:

- **Multi-Printer Contexts**: Simultaneous connections to multiple printers
- **Dual Operating Modes**: Desktop GUI and headless server modes
- **Real-Time Monitoring**: 3-second polling intervals with instant context switching
- **Advanced Features**: Material station support (AD5X), Spoolman filament tracking, RTSP/MJPEG camera streaming
- **Remote Access**: Full-featured WebUI with WebSocket real-time updates
- **External Integrations**: Discord notifications, desktop notifications, Spoolman integration

### Core Architecture Principles

1. **Singleton Managers with Branded Types**: Single source of truth for application state
2. **Event-Driven Communication**: Loose coupling via EventEmitter pattern
3. **Multi-Context Isolation**: Per-printer service instances coordinated by singleton coordinators
4. **Unified GUI/Headless Stack**: Same services for both modes, minimal conditional branching
5. **Security First**: Context isolation, IPC channel whitelisting, no direct Node.js access in renderers
6. **Type Safety**: Strict TypeScript throughout with branded types and comprehensive validation

---

## 2. Bootstrap and Entry Points

### 2.1 Bootstrap Sequence

**CRITICAL**: `src/bootstrap.ts` **MUST** be the first import in `src/index.ts`.

**Purpose**: Set Electron app name before any singleton captures `app.getPath('userData')`.

```typescript
// src/bootstrap.ts
app.setName('FlashForgeUI');
app.setAppUserModelId('com.ghosttypes.flashforgeui');
```

**Problem Solved**: Without bootstrap, singletons like `ConfigManager` and `PrinterDetailsManager` lock in the default "Electron" app name, causing GUI/headless configuration desynchronization.

**Platform-Specific Paths**:
- **macOS**: `~/Library/Application Support/FlashForgeUI/`
- **Linux**: `~/.config/FlashForgeUI/`
- **Windows**: `%APPDATA%/FlashForgeUI/`

### 2.2 Main Entry Point (`src/index.ts`)

**Responsibilities**:
- Application lifecycle management
- Single-instance enforcement
- IPC handler registration (before window creation)
- Manager initialization
- Mode detection (GUI vs headless)
- Service coordination

**GUI Mode Initialization**:
```
1. setupEventDrivenServices() - Auto-connect handlers
2. setupConfigLoadedForwarding() - Config events to renderer
3. registerAllIpcHandlers(managers) - ALL handlers BEFORE windows
4. setupPrinterContextHandlers() - Context CRUD
5. setupConnectionStateHandlers() - Connection tracking
6. setupCameraContextHandlers() - Camera proxies
7. setupDialogHandlers() - Loading overlays
8. createMainWindow() - Renderer window with preload
9. initializeSpoolmanIntegrationService() - After window
10. setupWindowControlHandlers() - Title bar controls
11. setupEventForwarding() - Manager events to renderer
12. initializeCameraService() - MJPEG proxies
13. getRtspStreamService().initialize() - RTSP support
14. getMultiContextTemperatureMonitor().initialize()
15. getMultiContextSpoolmanTracker().initialize()
16. initializeNotificationSystem()
17. getMultiContextNotificationCoordinator().initialize()
18. getDiscordNotificationService().initialize()
19. getThumbnailCacheService().initialize()
```

**Headless Mode Initialization**:
```
1. validateHeadlessConfig() - CLI validation
2. setHeadlessMode(true) - Global flag
3. Wait for config-loaded event
4. Initialize services (RTSP, Spoolman, monitors, notifications)
5. getHeadlessManager().initialize(headlessConfig)
   - Apply overrides (port, password)
   - Connect printers (last-used/all-saved/explicit)
   - Start WebUI server
   - Setup event forwarding
   - Start polling
   - Initialize cameras
   - Setup signal handlers (SIGINT/SIGTERM)
```

### 2.3 Lifecycle Management

**Single Instance Lock**:
```typescript
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
```

**Cleanup Sequence** (`before-quit` event):
```
1. Stop power save blocker
2. Stop all polling
3. Dispose notification system
4. Disconnect from printers
5. Shutdown camera proxies
6. Dispose camera IPC handler
7. Shutdown WebUI server
8. Dispose ConfigManager
```

---

## 3. Core Managers

### 3.1 ConfigManager (`src/managers/ConfigManager.ts`)

**Purpose**: Centralized configuration with automatic persistence and event-driven updates.

**Singleton Pattern**: `ConfigManager.getInstance()` / `getConfigManager()`

**Storage**:
- **Location**: `app.getPath('userData')/config.json`
- **Lock file**: `app.getPath('userData')/config.lock`

**Key Features**:
- Live in-memory configuration access
- Automatic file persistence with debounced saves (300ms)
- Event emission for updates (`config:*` events)
- Thread-safe via lock file handling
- Type-safe with branded types

**Core Methods**:
- `getConfig()`: Get complete readonly configuration
- `get<K>(key)`: Get specific value
- `set<K>(key, value)`: Set value and trigger save
- `updateConfig(updates)`: Batch updates
- `isConfigLoaded()`: Check load status

**Events**:
- `config-loaded`: Initial config loaded
- `config:${key}`: Specific key changed
- `config-updated`: Any change

### 3.2 PrinterContextManager (`src/managers/PrinterContextManager.ts`)

**Purpose**: Multi-printer context lifecycle management.

**Singleton Pattern**: Branded type + `PrinterContextManager.getInstance()`

**Context Structure**:
```typescript
interface PrinterContext {
  id: string;                    // "context-{counter}-{timestamp}"
  name: string;
  printerDetails: PrinterDetails;
  backend: BasePrinterBackend | null;
  connectionState: ContextConnectionState;
  pollingService: PrinterPollingService | null;
  notificationCoordinator: PrinterNotificationCoordinator | null;
  cameraProxyPort: number | null; // 8181-8191
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  activeSpoolId: number | null;
  activeSpoolData: ActiveSpoolData | null;
}
```

**Core Operations**:
- `createContext(printerDetails)`: Create with unique ID
- `removeContext(contextId)`: Cleanup and remove
- `switchContext(contextId)`: Change active context
- `getActiveContext()`: Get current active
- `updateContext(contextId, updates)`: Partial updates

**Events**:
- `context-created`: { contextId, contextInfo }
- `context-removed`: { contextId, contextInfo }
- `context-switched`: { fromId, toId, contextInfo }
- `context-updated`: { contextId }

**Event Consumers**:
- MultiContextPollingCoordinator
- MultiContextPrintStateMonitor
- MultiContextTemperatureMonitor
- MultiContextSpoolmanTracker
- MultiContextNotificationCoordinator
- Camera services
- WebUI

### 3.3 PrinterBackendManager (`src/managers/PrinterBackendManager.ts`)

**Purpose**: Backend lifecycle coordination for multi-context environment.

**Backend Selection Logic**:
```typescript
Adventurer5MBackend     → model.startsWith('Adventurer 5M') && !includes('Pro')
Adventurer5MProBackend  → model.startsWith('Adventurer 5M Pro')
AD5XBackend            → model.startsWith('AD5X')
GenericLegacyBackend   → All others (fallback)
```

**Multi-Context Storage**:
```typescript
contextBackends: Map<contextId, BasePrinterBackend>
contextPrinterDetails: Map<contextId, PrinterDetails>
contextInitPromises: Map<contextId, Promise<InitResult>>
```

**Core Operations**:
- `initializeBackend(options, contextId)`: Create and init
- `disposeBackend(contextId)`: Cleanup
- `getBackend(contextId)`: Retrieve instance
- `hasFeature(feature, contextId)`: Check support
- `executeJobOperation/executeMaterialOperation`: Route commands

**Events**:
- `backend-initialized`
- `backend-initialization-failed`
- `backend-disposed`
- `backend-error`

### 3.4 ConnectionFlowManager (`src/managers/ConnectionFlowManager.ts`)

**Purpose**: High-level orchestrator for discovery and connection workflows.

**Service Coordination** (Facade Pattern):
```
ConnectionFlowManager
├── PrinterDiscoveryService      → Network scanning
├── SavedPrinterService           → Persistent storage
├── AutoConnectService            → Startup auto-connect
├── ConnectionStateManager        → State tracking
├── DialogIntegrationService      → User dialogs
└── ConnectionEstablishmentService → Low-level connection
```

**Connection Flows**:
1. **Network Discovery**: startDiscovery() → user selects → connectToPrinter()
2. **Direct IP**: connectToManualIPPrinter(ip) → type detection → connection
3. **Auto-connect**: tryAutoConnect() → saved printers → connection

**Flow Tracking**:
```typescript
activeFlows: Map<flowId, ConnectionFlowState>
flowId: "flow-{counter}"
```

### 3.5 PrinterDetailsManager (`src/managers/PrinterDetailsManager.ts`)

**Purpose**: Multi-printer persistence with per-printer settings.

**Storage Structure**:
```typescript
interface MultiPrinterConfig {
  lastUsedPrinterSerial: string | null;
  printers: {
    [serialNumber: string]: StoredPrinterDetails
  };
}

interface StoredPrinterDetails extends PrinterDetails {
  lastConnected?: string;
  customCameraEnabled?: boolean;
  customCameraUrl?: string;
  customLedsEnabled?: boolean;
  forceLegacyMode?: boolean;
  webUIEnabled?: boolean;
  activeSpoolData?: ActiveSpoolData | null;
}
```

**Location**: `app.getPath('userData')/printer_details.json`

**Legacy Migration**: Automatically migrates single-printer format to multi-printer.

### 3.6 HeadlessManager (`src/managers/HeadlessManager.ts`)

**Purpose**: Headless mode lifecycle orchestration.

**CLI Modes**:
- `--last-used`: Connect to last used
- `--all-saved-printers`: Connect to all saved
- `--printers="<ip>:<type>:<checkcode>"`: Explicit specs

**Initialization**:
```
applyConfigOverrides() → connectPrinters() → startWebUI()
→ setupEventForwarding() → startPolling() → initializeCameraProxies()
→ setupSignalHandlers()
```

**Graceful Shutdown**:
```
SIGINT/SIGTERM → shutdown() → Stop polling → Disconnect printers
→ Close cameras → Stop WebUI → process.exit(0)
```

### 3.7 LoadingManager (`src/managers/LoadingManager.ts`)

**Purpose**: Centralized loading state for modal overlays.

**States**: 'hidden' | 'loading' | 'success' | 'error'

**Operations**:
- `show(options)`: Display overlay
- `hide()`: Hide overlay
- `showSuccess/Error(message, autoHideAfter?)`: Feedback with auto-hide
- `updateProgress(progress)`: 0-100 percentage

**Event-Driven**: Emits `loading-state-changed` forwarded to all windows via IPC.

### 3.8 WindowManager (`src/windows/WindowManager.ts`)

**Purpose**: Centralized BrowserWindow reference management.

**Window Types** (20 total): MAIN, SETTINGS, STATUS, LOG_DIALOG, INPUT_DIALOG, JOB_UPLOADER, PRINTER_SELECTION, JOB_PICKER, SEND_COMMANDS, IFS_DIALOG, MATERIAL_INFO_DIALOG, MATERIAL_MATCHING_DIALOG, SINGLE_COLOR_CONFIRMATION_DIALOG, AUTO_CONNECT_CHOICE_DIALOG, CONNECT_CHOICE_DIALOG, PALETTE, SHORTCUT_CONFIG_DIALOG, COMPONENT_DIALOG, UPDATE_DIALOG, ABOUT_DIALOG

**API Pattern**:
```typescript
getSettingsWindow(): BrowserWindow | null
setSettingsWindow(window): void
hasSettingsWindow(): boolean  // Checks !isDestroyed()
```

**Bulk Operations**: `closeAllExceptMain()`, `closeAll()`, `getActiveWindows()`

---

## 4. Multi-Context Architecture

### 4.1 Context Lifecycle

**Creation Flow**:
```
User Connect → Discovery → Connection → Context Creation
    ↓
PrinterContextManager.createContext()
    ↓
emit('context-created')
    ↓
PrinterBackendManager.initializeBackend()
    ↓
emit('backend-initialized')
    ↓
Service Cascade (polling, monitoring, notifications, camera)
```

**Removal Flow**:
```
PrinterContextManager.removeContext()
    ↓
emit('context-removed')
    ↓
All Coordinators Cleanup:
  - Stop polling
  - Dispose monitors
  - Release camera ports
  - Remove trackers
  - Cleanup notifications
```

### 4.2 Coordinator Pattern

**Singleton Coordinators + Per-Context Services**:
```
MultiContextPollingCoordinator (singleton)
├── PrinterPollingService (context-1)
├── PrinterPollingService (context-2)
└── PrinterPollingService (context-3)
```

**Key Coordinators**:
1. **MultiContextPollingCoordinator**: Manages polling services per context
2. **MultiContextPrintStateMonitor**: Print lifecycle tracking
3. **MultiContextTemperatureMonitor**: Temperature monitoring
4. **MultiContextSpoolmanTracker**: Filament usage tracking
5. **MultiContextNotificationCoordinator**: Notification orchestration

### 4.3 Polling Architecture

**Frequency Strategy**:
- **Active Context**: 3 seconds
- **Inactive Contexts**: 3 seconds (prevents TCP keep-alive failures)
- **Instant Switch**: Cached data emitted immediately on context switch

**Data Distribution**:
- **Renderer**: Only receives active context data
- **Services**: All coordinators receive all context data
- **Discord**: Updates all printer statuses
- **Notifications**: Work for all contexts

**Event Chain**:
```
PrinterPollingService → data-updated
    ↓
MultiContextPollingCoordinator → polling-data (contextId, data)
    ↓
├── Renderer (if active) → polling-update
├── Discord → updatePrinterStatus(contextId)
└── Services → monitoring, tracking, notifications
```

### 4.4 Service Dependencies

```
PrintStateMonitor (foundation)
    ↓
├── TemperatureMonitoringService (depends on PrintStateMonitor)
├── SpoolmanUsageTracker (depends on PrintStateMonitor)
└── NotificationCoordinator (depends on both)
```

**Initialization Order**:
1. Create PrintStateMonitor
2. Create TemperatureMonitor (with PrintStateMonitor)
3. Create SpoolmanTracker (with PrintStateMonitor)
4. Create NotificationCoordinator (with both monitors)

---

## 5. Printer Backend System

### 5.1 Backend Hierarchy

```
BasePrinterBackend (abstract)
├── GenericLegacyBackend
│   └── Uses: FlashForgeClient only
│   └── Features: Basic legacy support
│
└── DualAPIBackend (abstract)
    ├── Adventurer5MBackend
    │   └── Uses: FiveMClient + FlashForgeClient
    │   └── Features: Auto-enabled LED (TCP)
    │
    ├── Adventurer5MProBackend
    │   └── Uses: FiveMClient + FlashForgeClient
    │   └── Features: Built-in RTSP, LED (HTTP), filtration
    │
    └── AD5XBackend
        └── Uses: FiveMClient + FlashForgeClient
        └── Features: 4-slot material station
```

### 5.2 Feature Detection System

**PrinterFeatureSet**:
```typescript
interface PrinterFeatureSet {
  camera: CameraFeature;
  ledControl: LEDControlFeature;
  filtration: FiltrationFeature;
  gcodeCommands: GCodeCommandFeature;
  statusMonitoring: StatusMonitoringFeature;
  jobManagement: JobManagementFeature;
  materialStation: MaterialStationFeature;
}
```

**Feature Resolution Flow**:
1. **Base Features**: Child class defines capabilities
2. **Product Detection**: DualAPIBackend fetches hardware info
3. **Settings Overrides**: Per-printer settings applied
4. **Final Feature Set**: Built via `buildFeatureSet()`

### 5.3 Material Station (AD5X)

**Data Flow**:
```
fiveMClient.info.get() → MatlStationInfo
    ↓
isAD5XMachineInfo() type guard
    ↓
Cache in lastMachineInfo
    ↓
extractMaterialStationStatus()
    ↓
MaterialStationStatus (UI-ready)
```

**Material Mapping**:
```typescript
interface AD5XMaterialMapping {
  toolId: number;      // Tool/extruder
  slotId: number;      // Material station slot
  materialName: string;
  toolMaterialColor: string;
  slotMaterialColor: string;
}
```

### 5.4 External Dependency: ff-api

**Package**: `@ghosttypes/ff-api`

**Key Clients**:
- **FiveMClient**: HTTP API for modern printers
- **FlashForgeClient**: TCP API for legacy printers and G-code

**Integration Pattern**:
```typescript
// DualAPIBackend
this.fiveMClient = options.primaryClient as FiveMClient;
this.legacyClient = options.secondaryClient as FlashForgeClient;

// GenericLegacyBackend
this.legacyClient = options.primaryClient as FlashForgeClient;
```

---

## 6. IPC Communication Architecture

### 6.1 Security Model

**Context Bridge Pattern**:
```
Renderer Process (Sandboxed)
    ↓ window.api calls
Preload Script (Privileged)
    ↓ Channel validation
    ↓ contextBridge
ipcRenderer
    ↓ Whitelisted channels
ipcMain Handlers
    ↓ Business logic
Services/Managers
```

### 6.2 Preload Scripts

**Main Renderer** (`src/preload.cts`):
- ~150 send channels
- ~70 receive channels
- ~30 invoke channels
- Specialized namespaces: `config`, `dialog`, `loading`, `camera`, `printerContexts`, `spoolman`

**Component Dialog** (`src/ui/component-dialog/component-dialog-preload.cts`):
- Mirrors main preload API
- Adds `componentDialogAPI` for lifecycle
- Same security guarantees

**Channel Validation**:
```typescript
const validSendChannels = ['request-printer-data', 'pause-print', ...];

send: (channel, data) => {
  if (validSendChannels.includes(channel)) {
    ipcRenderer.send(channel, data);
  }
}
```

### 6.3 Handler Registration

**Central Registry** (`src/ipc/handlers/index.ts`):
```typescript
export function registerAllIpcHandlers(managers: AppManagers) {
  registerConnectionHandlers();
  registerBackendHandlers();
  registerJobHandlers();
  registerDialogHandlers();
  registerMaterialHandlers();
  registerControlHandlers();
  registerWebUIHandlers();
  registerCameraHandlers();
  registerSpoolmanHandlers();
  // ... 13+ handler modules
}
```

**Registration Order in index.ts**:
```
1. Domain handlers (via registerAllIpcHandlers)
2. Multi-context handlers (printer contexts, connection state)
3. Legacy handlers (dialog handlers)
4. Window controls
5. THEN create windows
```

### 6.4 Domain Handlers

**Connection Domain** (`connection-handlers.ts`):
- `printer-selection:start-discovery`
- `printer-connection:connect-to-ip`
- `printer-selection:cancel`

**Backend Domain** (`backend-handlers.ts`):
- `request-model-preview`
- `request-printer-data`
- `get-material-station-status`
- `printer:get-features`

**Control Domain** (`control-handlers.ts`):
- Temperature: `set-bed-temp`, `set-extruder-temp`, `turn-off-*-temp`
- LED: `led-on`, `led-off`
- Print: `pause-print`, `resume-print`, `cancel-print`
- Operations: `home-axes`, `set-filtration`, `clear-status`

**Job Domain** (`job-handlers.ts`):
- `job:get-local-files`, `job:get-recent-files`
- `job:start-job` (with material mapping for AD5X)
- `job:upload-file` (with progress)
- `job:request-thumbnail`

**Spoolman Domain** (`spoolman-handlers.ts`):
- `spoolman:open-dialog`
- `spoolman:search-spools`
- `spoolman:select-spool`
- `spoolman:get-active-spool`
- `spoolman:test-connection`

### 6.5 Communication Patterns

**1. Request-Response** (invoke/handle):
```typescript
// Renderer
const result = await window.api.invoke('printer-contexts:switch', contextId);

// Main
ipcMain.handle('printer-contexts:switch', async (_event, contextId) => {
  contextManager.switchContext(contextId);
});
```

**2. One-Way Send** (send/on):
```typescript
// Renderer
window.api.send('pause-print');

// Main
ipcMain.on('pause-print', async () => {
  await backendManager.pausePrint(contextId);
});
```

**3. Event Broadcasting** (receive):
```typescript
// Main
mainWindow.webContents.send('polling-update', data);

// Renderer
window.api.receive('polling-update', (data) => {
  updateUI(data);
});
```

### 6.6 Renderer API Surface

```typescript
interface ElectronAPI {
  send/receive/removeListener/invoke
  config: ConfigAPI
  dialog: DialogNamespace
  loading: LoadingAPI
  camera: CameraAPI
  printerContexts: PrinterContextsAPI
  connectionState: ConnectionStateAPI
  printerSettings: PrinterSettingsAPI
  spoolman: SpoolmanAPI
}
```

---

## 7. Renderer and UI Components

### 7.1 Renderer Bootstrap (`src/renderer.ts`)

**Initialization Order**:
```
1. CSS & Icon Loading
2. Component System Import (ComponentManager, GridStack)
3. Platform Detection & Theme Application
4. Printer Tabs Initialization
5. GridStack System (controller, persistence, edit mode)
6. Shortcut System
7. Polling Listeners (polling-update IPC)
8. State Tracking (printer state, backend events)
9. Renderer Ready Signal
```

### 7.2 Component System

**ComponentManager** (`src/ui/components/ComponentManager.ts`):
- Singleton: `export const componentManager = new ComponentManager()`
- **Registration**: `registerComponent(component)`
- **Initialization**: `initializeAll()` - calls `initialize()` on all
- **Update Distribution**: `updateAll(data)` - fans out polling data
- **Lifecycle**: `destroyAll()`, `removeComponent(id)`, `reinitializeComponent(id)`

**BaseComponent** (`src/ui/components/base/component.ts`):
```typescript
abstract class BaseComponent {
  abstract readonly componentId: string;
  abstract readonly templateHTML: string;
  abstract update(data: ComponentUpdateData): void;
  abstract setupEventListeners(): Promise<void>;
}
```

**11 Registered Components**:
- camera-preview (main)
- controls-grid (main)
- model-preview (main)
- job-stats (main)
- printer-status (status-bar)
- temperature-controls (status-bar)
- filtration-controls (status-bar)
- additional-info (status-bar)
- spoolman-tracker (status-bar)
- log-panel (utility)
- job-info (main)

### 7.3 GridStack Layout System

**GridStackManager** (`src/ui/gridstack/GridStackManager.ts`):
```typescript
export const gridStackManager = new GridStackManager('.grid-stack');
```

**Operations**:
- `initialize(options)`: 12 columns, 80px cell height
- `addWidget(config, element)`: Add with position/size
- `removeWidget(element)`: Remove and cleanup
- `serialize()`: Export layout
- `enable()/disable()`: Toggle editing
- `onChange(callback)`: Layout change listener

**LayoutPersistence** (`src/ui/gridstack/LayoutPersistence.ts`):
- **Storage**: localStorage with per-printer keys
- `saveLayout(serial, layout)`: Persist
- `loadLayout(serial)`: Restore with defaults
- **Keys**: `gridstack_layout_<serial>`, `gridstack_layout_global`

**EditModeController** (`src/ui/gridstack/EditModeController.ts`):
- **Toggle**: CTRL+E
- **Features**: Drag/resize handles, remove buttons, palette integration
- **State**: Edit mode disabled when no printer connected

### 7.4 Multi-Printer Support

**PrinterTabsComponent** (`src/ui/components/printer-tabs/`):
- `addTab(context)`: Create tab with status indicator
- `removeTab(contextId)`: Remove from UI
- `setActiveTab(contextId)`: Highlight active
- `updateTab(contextId, updates)`: Update label/status

**Context Switching Flow**:
```
tab-clicked event
    ↓
Save current layout → localStorage
    ↓
Switch context (IPC)
    ↓
Load new layout ← localStorage
    ↓
Reload grid → ComponentManager.updateAll(cached data)
    ↓
Update tabs
```

### 7.5 Settings Dialog

**Modular Section System** (`src/ui/settings/sections/`):
```typescript
interface SettingsSection {
  initialize(): void | Promise<void>;
  dispose(): void;
}
```

**Sections**:
- TabSection (navigation)
- DesktopThemeSection (theme with live CSS)
- AutoUpdateSection (update config)
- SpoolmanTestSection (connectivity testing)
- DiscordWebhookSection (webhook testing)
- PrinterContextSection (per-printer indicator)
- RoundedUISection (platform compatibility)
- InputDependencySection (dependent inputs)

**Dual Settings Routing**:
- **Global**: config.json via ConfigManager
- **Per-Printer**: printer_details.json via PrinterDetailsManager

---

## 8. Window Management

### 8.1 WindowFactory (`src/windows/WindowFactory.ts`)

**Specialized Factories**:
- **CoreWindowFactory**: Settings, status, logs, about
- **DialogWindowFactory**: Input, material matching/info, IFS, connection dialogs
- **UtilityWindowFactory**: Job uploader/picker, printer selection, send commands
- **ComponentDialogWindowFactory**: Standalone component dialogs

### 8.2 Component Dialog System

**Purpose**: Display grid components in modal windows

**Features**:
- Modal blocking
- Frameless with custom title bar
- Per-component sizes
- Own ComponentManager instance
- Same polling updates as main window

**Communication**:
```
Main → createComponentDialog(componentId)
    ↓
Load component-dialog.html
    ↓
Send componentId via IPC
    ↓
Dialog creates component
    ↓
Polling updates forwarded
```

---

## 9. WebUI and Headless Mode

### 9.1 Headless Architecture

**CLI Modes**:
- `--last-used`
- `--all-saved-printers`
- `--printers="<ip>:<type>:<checkcode>"`

**Overrides**:
- `--webui-port=<port>` (default 3000)
- `--webui-password=<password>`

**Shared Stack**:
- Same connection/polling/camera services as desktop
- Minimal `isHeadlessMode()` conditionals
- Event forwarding from HeadlessManager to WebUI

### 9.2 WebUI Server

**WebUIManager** (`src/webui/server/WebUIManager.ts`):
- Express HTTP server
- Static file serving
- API route registration
- WebSocket integration
- Admin privilege enforcement (Windows)
- Per-context WebUI enablement

**AuthManager** (`src/webui/server/AuthManager.ts`):
- Password validation
- JWT-style token generation (HMAC-SHA256)
- Session management (24h persistent, 1h temporary)
- Token revocation on logout
- Multi-tab support

**WebSocketManager** (`src/webui/server/WebSocketManager.ts`):
- Real-time bidirectional communication
- Token-based authentication
- Ping/pong keep-alive (30s)
- Message types: STATUS_UPDATE, SPOOLMAN_UPDATE, COMMAND_RESULT
- Broadcasting to all clients or per-token

### 9.3 API Routes

**Route Modules** (`src/webui/server/routes/`):
- printer-status-routes.ts: GET /api/status
- printer-control-routes.ts: POST /api/control/*
- temperature-routes.ts: POST /api/temperature/*
- filtration-routes.ts: POST /api/filtration/*
- job-routes.ts: Jobs (recent, local, start, control)
- camera-routes.ts: GET /api/camera/url/:contextId
- context-routes.ts: Contexts (list, switch)
- theme-routes.ts: Theme defaults
- spoolman-routes.ts: Spoolman operations

### 9.4 WebUI Static Client

**AppState** (`src/webui/static/core/AppState.ts`):
```typescript
class AppState {
  isAuthenticated: boolean;
  authToken: string | null;
  websocket: WebSocket | null;
  printerStatus: PrinterStatus | null;
  printerFeatures: PrinterFeatures | null;
  spoolmanConfig: SpoolmanConfigResponse | null;
  activeSpool: ActiveSpoolData | null;
  // ... managers
  gridManager: WebUIGridManager;
  mobileLayoutManager: WebUIMobileLayoutManager;
  layoutPersistence: WebUILayoutPersistence;
}
```

**Transport** (`src/webui/static/core/Transport.ts`):
- `apiRequest<T>()`: REST with auth headers
- `connectWebSocket()`: WS with reconnection (exponential backoff)
- `sendCommand()`: WebSocket commands
- Event callbacks: onStatusUpdate, onSpoolmanUpdate, onConnectionChange

**Feature Modules** (`src/webui/static/features/`):
- authentication.ts: Login, token persistence, session restoration
- context-switching.ts: Fetch/switch contexts, layout per-printer
- job-control.ts: Feature detection, controls, job start
- material-matching.ts: AD5X multi-color mapping
- spoolman.ts: Config, search, selection, updates
- camera.ts: MJPEG/RTSP stream initialization
- layout-theme.ts: Theme, visibility, edit mode, responsive

**Grid System** (`src/webui/static/grid/`):
- WebUIComponentRegistry: Component definitions
- WebUIGridManager: GridStack desktop layout
- WebUIMobileLayoutManager: Vertical mobile layout
- WebUILayoutPersistence: Per-printer localStorage

---

## 10. External Integrations

### 10.1 Spoolman

**SpoolmanService** (`src/services/SpoolmanService.ts`):
- REST API client (10s timeout)
- Operations: ping, getSpool, searchSpools, useFilament

**SpoolmanIntegrationService** (`src/services/SpoolmanIntegrationService.ts`):
- Single source of truth for active spool selections
- Per-printer persistence in printer_details.json
- AD5X/material-station blocking
- Event broadcasting: 'spoolman-changed'

**SpoolmanUsageTracker** / **MultiContextSpoolmanTracker**:
- Listen to 'cooling-complete' events
- Calculate usage from job metadata
- Submit to Spoolman API
- Per-context tracker instances

### 10.2 Discord Notifications

**DiscordNotificationService** (`src/services/discord/DiscordNotificationService.ts`):
- Webhook integration
- Timer-based updates (configurable interval, default 5min)
- Event-driven: Print complete, printer cooled, idle transition
- Per-context tracking with state caching
- Rich embeds with temperatures, progress, material usage
- Rate limiting (1s delay between messages)

### 10.3 Camera Services

**CameraProxyService** (`src/services/CameraProxyService.ts`):
- Multi-context MJPEG proxies
- Unique ports (8181-8191 via PortAllocator)
- Keep-alive with 5s idle timeout
- Automatic reconnection (exponential backoff)
- Per-context Express servers

**RtspStreamService** (`src/services/RtspStreamService.ts`):
- RTSP-to-WebSocket via ffmpeg
- node-rtsp-stream library
- Cross-platform ffmpeg detection
- Unique WebSocket ports (9000+)
- JSMpeg player support
- Max 10 concurrent streams

### 10.4 Notification System

**NotificationService** (`src/services/notifications/NotificationService.ts`):
- Desktop notification wrapper
- Platform compatibility detection
- Lifecycle events (sent, clicked, closed)
- 24-hour retention
- Silent notification support

**MultiContextNotificationCoordinator**:
- Per-printer notification coordinators
- Shared NotificationService
- Independent state per context
- Notification types: completion, cooling, errors, material station

---

## 11. Type System

### 11.1 Core Types (`src/types/`)

**config.ts**:
- AppConfig (readonly), MutableAppConfig
- ThemeColors, ThemeProfile
- DEFAULT_CONFIG (WebUI port 3000, etc.)

**printer.ts**:
- PrinterDetails (per-printer overrides)
- MultiPrinterConfig
- DiscoveredPrinter, ConnectionResult
- PrinterClientType: 'legacy' | 'new'

**PrinterContext.ts**:
- PrinterContextInfo (serializable)
- ContextConnectionState
- ContextSwitchEvent, ContextCreatedEvent, ContextRemovedEvent

**polling.ts**:
- PrinterState enum
- TemperatureData, PrinterTemperatures
- JobProgress, CurrentJobInfo
- PrinterStatus (master interface)
- MaterialSlot, MaterialStationStatus
- PollingData (aggregates all)
- Utility functions: isActiveState, canControlPrint

### 11.2 Backend Types

**backend-operations.ts**:
- PrinterModelType: 'generic-legacy' | 'adventurer-5m' | 'adventurer-5m-pro' | 'ad5x'
- BackendInitOptions
- JobStartParams, JobStartResult
- AD5XJobInfo, BasicJobInfo
- BackendCapabilities

**printer-features.ts**:
- PrinterFeatureType (8 types)
- Individual feature interfaces
- PrinterFeatureSet
- FeatureAvailabilityResult
- FeatureDisableReason

### 11.3 Integration Types

**camera/camera.types.ts**:
- CameraSourceType: 'builtin' | 'custom' | 'none'
- CameraStreamType: 'mjpeg' | 'rtsp'
- CameraProxyConfig, CameraProxyStatus
- Type guards: isCameraAvailable, isCustomCamera

**spoolman.ts**:
- SpoolResponse, FilamentObject, VendorObject
- SpoolSearchQuery, SpoolUsageUpdate
- ActiveSpoolData

**discord.ts**:
- DiscordEmbedField, DiscordEmbed
- DiscordWebhookPayload
- DiscordServiceConfig

**notification.ts**:
- Branded types: NotificationId, NotificationTemperature
- Notification types: PrintComplete, PrinterCooled, Upload, Connection
- Factory functions: createPrintCompleteNotification, etc.

### 11.4 Global Definitions

**global.d.ts**:
- Window API surface (typed preload bridge)
- API namespaces: LoadingAPI, CameraAPI, PrinterContextsAPI, etc.
- DialogNamespace (unified dialog access)
- WindowControls (title bar operations)
- IPC infrastructure: IPCListener, EventDisposer

---

## 12. Utilities and Helpers

### 12.1 Event System (`EventEmitter.ts`)

- Browser-compatible EventEmitter
- Full TypeScript generic type safety
- API: on, once, off, emit, removeAllListeners
- Copy-on-iterate pattern (prevents modification-during-iteration)

### 12.2 Port Management (`PortAllocator.ts`)

- Sequential allocation (8181-8191)
- Tracking, release, reuse
- Exhaustion detection
- Used by CameraProxyService

### 12.3 Error Handling (`error.utils.ts`)

- AppError custom class with error codes
- Factory functions: networkError, timeoutError, printerError
- Conversion: toAppError, createErrorResult
- Type guards: isAppError
- Logging: logError with context

### 12.4 Data Extraction (`extraction.utils.ts`)

- Type-safe extraction from unknown objects
- Functions: safeExtractString, safeExtractNumber, safeExtractBoolean, safeExtractArray
- Advanced: safeExtractNested (dot-notation), safeExtractMultiple (schema)
- Used in API response parsing, IPC handling

### 12.5 Validation (`validation.utils.ts`)

- Zod-based schema validation
- Result types: ValidationSuccess<T>, ValidationFailure, ValidationResult<T>
- Functions: validate, parseWithDefault, validatePartial
- Common schemas: URLSchema, PortSchema, IPAddressSchema
- Type guards: createTypeGuard, createAsyncTypeGuard
- Utilities: validateArray, filterValid, pickFields, omitFields

### 12.6 Time Utilities (`time.utils.ts`)

- Conversion: secondsToMinutes, formatDuration, formatJobTime
- Date/Time: formatTime (HH:MM:SS), formatDateTime, formatETA
- Calculations: calculateElapsed, calculateRemaining
- Used in print job displays, ETA calculations

---

## 13. Build System

### 13.1 TypeScript Configuration

**Main Process** (`tsconfig.json`):
- Target: ES2020
- Module: nodenext (ESM)
- Output: ./lib
- Strict mode enabled

**Renderer** (`tsconfig.renderer.json`):
- Extends tsconfig.json
- Module: ESNext with bundler resolution
- Libs: ES2020, DOM, DOM.Iterable
- Output: ./dist/renderer
- Includes: renderer.ts, services, types, UI, utils
- Excludes: Main process files

### 13.2 Webpack Configuration

**Entry Points** (24 bundles):
- renderer.ts (main renderer)
- 20+ dialog renderers
- palette, shortcut-config-dialog, lucide

**Configuration**:
- Target: electron-renderer
- Output: dist/renderer/[name].bundle.js
- Loaders: ts-loader, style-loader, css-loader, asset/resource
- Plugins: HtmlWebpackPlugin per template

### 13.3 Build Scripts

**Development**:
- `npm run dev`: Build WebUI + watch + launch
- `npm run dev:clean`: Clean + dev

**Build**:
- `npm run build`: Main + renderer + WebUI
- `npm run build:main`: TypeScript compilation
- `npm run build:renderer`: Webpack bundle
- `npm run build:webui`: Compile + copy assets

**Platform Packaging**:
- `npm run build:linux/win/mac`: electron-builder
- CI variants: build:ci:linux/win/mac

---

## 14. Quality Assurance

### 14.1 ESLint (`eslint.config.cjs`)

**Modern ESLint 9+ with TypeScript**:
- Parser: @typescript-eslint/parser
- Plugins: @typescript-eslint/eslint-plugin
- Rules: TypeScript-specific, code quality, style
- Renderer-specific globals (window, document)
- Test file relaxed rules (allow any)

### 14.2 Testing Infrastructure

**Jest** (`jest.config.cjs`):
- Environment: jsdom
- Preset: ts-jest
- Module name mapper (CSS mocks)
- Coverage: src/**/*.{js,jsx,ts,tsx}

**Current Coverage**: Limited (PortAllocator only)

### 14.3 Documentation Tooling

**Fileoverview Management**:
- `npm run docs:check`: Scan for missing @fileoverview
- `npm run docs:combine`: Extract all @fileoverview → report
- Output: fileoverview-report.md (~230 entries)

**Usage Analysis**:
- `npm run find:console`: Surface console calls
- `npm run find:lucide`: Lucide icon usage
- `npm run find:window`: Window usage analysis

### 14.4 Code Quality Tools

**Knip** (dead code analysis):
- Configuration: knip.json
- Commands: knip, knip:fix, knip:production, knip:exports
- Expect intentional false positives (Electron patterns)

**Line Counting**:
- `npm run linecount`: TypeScript LOC summary
- Options: `-- --min-lines=N`

### 14.5 Quality Workflow

**Completion Checklist**:
1. `npm run type-check`: Fix all errors
2. `npm run build:renderer`: Webpack compiles
3. `npm run lint`: Fix all errors

**Additional**:
- `npm run docs:check`: Verify @fileoverview
- `npm run knip`: Dead code (when refactoring)

---

## 15. Development Workflow

### 15.1 Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development mode with watch |
| `npm run type-check` | TypeScript validation |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run build` | Build all components |
| `npm run build:win/linux/mac` | Platform packages |
| `npm run docs:check` | @fileoverview validation |
| `npm run knip` | Dead code analysis |

### 15.2 Development Patterns

**Read References First**:
- ai_reference/typescript-best-practices.md
- ai_reference/electron-typescript-best-practices.md
- fileoverview-report.md for module overview

**Gather Context**:
- Use rg/rg --files for fast searching
- Read ARCHITECTURE.md sections relevant to task

**Plan Before Coding**:
- Multi-step plans for non-trivial changes
- Update plan as steps complete

**Validation**:
- Run smallest meaningful checks first
- type-check → build:renderer → lint sequence

### 15.3 Testing Constraints

**Claude Agents Can**:
- Static inspection and reasoning
- npm run type-check, lint, docs:check, knip
- Targeted node scripts (no GUI)

**Cannot**:
- Launch Electron UI or WebUI
- Connect to physical printers
- Validate RTSP/MJPEG streams
- Visual/UI regression testing

**Call Out**: Unverified runtime assumptions explicitly

---

## Key File Locations

### Bootstrap & Entry
- `src/bootstrap.ts` - App name setup
- `src/index.ts` - Main orchestrator
- `src/preload.ts` - Main preload bridge
- `src/renderer.ts` - Renderer entry

### Managers
- `src/managers/ConfigManager.ts`
- `src/managers/PrinterContextManager.ts`
- `src/managers/PrinterBackendManager.ts`
- `src/managers/ConnectionFlowManager.ts`
- `src/managers/PrinterDetailsManager.ts`
- `src/managers/HeadlessManager.ts`
- `src/managers/LoadingManager.ts`
- `src/windows/WindowManager.ts`

### Multi-Context Services
- `src/services/MultiContextPollingCoordinator.ts`
- `src/services/MultiContextPrintStateMonitor.ts`
- `src/services/MultiContextTemperatureMonitor.ts`
- `src/services/MultiContextSpoolmanTracker.ts`
- `src/services/MultiContextNotificationCoordinator.ts`

### Backends
- `src/printer-backends/BasePrinterBackend.ts`
- `src/printer-backends/GenericLegacyBackend.ts`
- `src/printer-backends/DualAPIBackend.ts`
- `src/printer-backends/Adventurer5MBackend.ts`
- `src/printer-backends/Adventurer5MProBackend.ts`
- `src/printer-backends/AD5XBackend.ts`

### IPC
- `src/ipc/handlers/index.ts` - Central registry
- `src/ipc/handlers/*.ts` - Domain handlers
- `src/ipc/printer-context-handlers.ts`
- `src/ipc/WindowControlHandlers.ts`
- `src/ipc/DialogHandlers.ts`

### Renderer & UI
- `src/renderer.ts` - Bootstrap
- `src/ui/components/ComponentManager.ts`
- `src/ui/components/printer-tabs/`
- `src/ui/gridstack/*`
- `src/ui/settings/settings-renderer.ts`
- `src/ui/settings/sections/*`

### Windows
- `src/windows/WindowFactory.ts`
- `src/windows/factories/*`
- `src/windows/dialogs/*`

### WebUI
- `src/webui/server/WebUIManager.ts`
- `src/webui/server/AuthManager.ts`
- `src/webui/server/WebSocketManager.ts`
- `src/webui/server/routes/*`
- `src/webui/static/core/AppState.ts`
- `src/webui/static/core/Transport.ts`
- `src/webui/static/features/*`
- `src/webui/static/grid/*`

### Integrations
- `src/services/SpoolmanIntegrationService.ts`
- `src/services/discord/DiscordNotificationService.ts`
- `src/services/CameraProxyService.ts`
- `src/services/RtspStreamService.ts`
- `src/services/notifications/NotificationService.ts`

### Types & Utils
- `src/types/*` - All type definitions
- `src/utils/*` - Utility modules

---

This architecture enables FlashForgeUI-Electron to support complex multi-printer workflows with robust error handling, real-time updates, remote access, and extensive external integrations while maintaining strict type safety and security boundaries.
