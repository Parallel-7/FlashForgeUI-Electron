# Electron + TypeScript Best Practices for FlashForgeUI-Electron

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Main Process vs Renderer Process Development](#main-process-vs-renderer-process-development)
3. [IPC Communication Patterns and Type Safety](#ipc-communication-patterns-and-type-safety)
4. [Preload Script Security and TypeScript Integration](#preload-script-security-and-typescript-integration)
5. [Context Isolation and Secure Communication](#context-isolation-and-secure-communication)
6. [Window Management and Dialog Handling](#window-management-and-dialog-handling)
7. [File System Access Patterns](#file-system-access-patterns)
8. [Native Module Integration](#native-module-integration)
9. [Performance Optimization for Electron Apps](#performance-optimization-for-electron-apps)
10. [Security Best Practices](#security-best-practices)
11. [Build and Packaging Considerations](#build-and-packaging-considerations)
12. [Testing Electron Applications](#testing-electron-applications)
13. [Debugging Techniques](#debugging-techniques)
14. [Auto-updater Implementation](#auto-updater-implementation)
15. [Platform-specific Considerations](#platform-specific-considerations)

## Architecture Overview

### Project Structure

FlashForgeUI-Electron uses a sophisticated multi-process architecture with TypeScript throughout:

```
src/
├── index.ts              # Main process entry point
├── preload.ts            # Secure IPC bridge
├── renderer.ts           # Main UI renderer
├── managers/             # Singleton pattern managers
├── services/             # Business logic services
├── printer-backends/     # Hardware communication backends
├── ui/                   # Dialog windows with separate renderers
├── webui/               # Express web server in main process
├── windows/             # Window factory and management
├── ipc/                 # Type-safe IPC handlers
├── types/               # TypeScript definitions
└── validation/          # Zod schemas for runtime validation
```

### TypeScript Configuration Strategy

The project uses separate TypeScript configurations for different target environments:

#### Main Process (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020", "DOM"],
    "outDir": "./lib",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### Renderer Process (`tsconfig.renderer.json`)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false
  }
}
```

**Best Practice**: Use separate TypeScript configurations to optimize for each environment while maintaining shared type definitions.

## Main Process vs Renderer Process Development

### Main Process Responsibilities

The main process handles system-level operations and serves as the application coordinator:

```typescript
// src/index.ts - Main process entry point
import { app, BrowserWindow, dialog, powerSaveBlocker } from 'electron';
import { getConfigManager } from './managers/ConfigManager';
import { registerAllIpcHandlers } from './ipc/handlers';

/**
 * Initialize the application with proper service coordination
 */
const initializeApp = async (): Promise<void> => {
  // CRITICAL: Set up IPC handlers BEFORE creating window
  console.log('Setting up IPC handlers before window creation...');
  
  const managers = {
    configManager: getConfigManager(),
    connectionManager: getPrinterConnectionManager(),
    backendManager: getPrinterBackendManager(),
    windowManager: getWindowManager()
  };
  
  registerAllIpcHandlers(managers);
  
  // Create window after handlers are ready
  await createMainWindow();
  
  // Initialize services
  setupConnectionEventForwarding();
  await initializeCameraService();
  initializeNotificationSystem();
};
```

**Best Practices for Main Process**:
- Initialize IPC handlers before creating any windows
- Use singleton pattern for managers to ensure single source of truth
- Implement proper cleanup in `before-quit` event
- Use environment-aware path resolution for assets
- Implement power save blocking for background operations

### Renderer Process Architecture

Renderer processes are isolated and communicate only through IPC:

```typescript
// src/renderer.ts - Main UI renderer
import './index.css';

declare global {
  interface Window {
    api: ElectronAPI;
    CAMERA_URL: string;
  }
}

/**
 * Initialize the renderer process with proper IPC setup
 */
const initializeRenderer = async (): Promise<void> => {
  // Signal main process that renderer is ready
  await window.api.invoke('renderer-ready');
  
  // Set up event listeners for backend events
  window.api.receive('backend-initialized', (data) => {
    console.log('Backend initialized:', data);
    updateUIForConnectedPrinter(data);
  });
  
  window.api.receive('polling-update', (data) => {
    updatePrinterStatus(data);
  });
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeRenderer);
```

**Best Practices for Renderer Process**:
- Signal main process when renderer is ready for operations
- Use type-safe IPC communication only
- Implement proper event listener cleanup
- Handle connection state changes gracefully
- Use environment-aware asset loading

### Separate Dialog Renderers

Each dialog window has its own renderer process for security and performance:

```typescript
// src/ui/settings/settings-renderer.ts
interface SettingsAPI {
  saveSettings: (settings: ConfigData) => Promise<void>;
  getSettings: () => Promise<ConfigData>;
  closeDialog: () => void;
}

declare global {
  interface Window {
    settingsAPI: SettingsAPI;
  }
}

const initializeSettingsDialog = async (): Promise<void> => {
  const settings = await window.settingsAPI.getSettings();
  populateSettingsForm(settings);
  
  document.getElementById('save-btn')?.addEventListener('click', async () => {
    const formData = getFormData();
    await window.settingsAPI.saveSettings(formData);
    window.settingsAPI.closeDialog();
  });
};
```

## IPC Communication Patterns and Type Safety

### Type-Safe IPC Handler Registration

Use a modular approach with centralized handler registration:

```typescript
// src/ipc/handlers/index.ts
export interface AppManagers {
  configManager: ConfigManager;
  connectionManager: ConnectionFlowManager;
  backendManager: PrinterBackendManager;
  windowManager: WindowManager;
}

export function registerAllIpcHandlers(managers: AppManagers): void {
  const { configManager, connectionManager, backendManager, windowManager } = managers;

  registerConnectionHandlers(connectionManager, windowManager);
  registerBackendHandlers(backendManager, windowManager);
  registerJobHandlers(backendManager, windowManager);
  registerDialogHandlers(configManager, windowManager);
  registerMaterialHandlers(backendManager);
  registerControlHandlers(backendManager);
  registerWebUIHandlers();
}
```

### Type-Safe Handler Implementation

Use Zod schemas for runtime validation:

```typescript
// src/ipc/handlers/connection-handlers.ts
import { ipcMain } from 'electron';
import { z } from 'zod';

const ConnectPayloadSchema = z.object({
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  timeout: z.number().int().min(1000).max(30000).optional()
});

export function registerConnectionHandlers(
  connectionManager: ConnectionFlowManager,
  windowManager: WindowManager
): void {
  ipcMain.handle('connect-to-printer', async (event, payload: unknown) => {
    try {
      // Runtime validation
      const validatedPayload = ConnectPayloadSchema.parse(payload);
      
      const result = await connectionManager.connectToPrinter(validatedPayload);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });
}
```

### Shared Type Definitions

Define shared types for IPC communication:

```typescript
// src/types/ipc.ts
export interface UploadJobPayload {
  readonly filePath: string;
  readonly startNow: boolean;
  readonly autoLevel: boolean;
}

export interface AD5XUploadParams {
  readonly filePath: string;
  readonly startPrint: boolean;
  readonly levelingBeforePrint: boolean;
  readonly materialMappings?: readonly AD5XMaterialMapping[];
}

// Response envelope pattern for consistent error handling
export interface IPCResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp?: string;
}
```

## Preload Script Security and TypeScript Integration

### Secure API Exposure

The preload script creates a secure bridge between main and renderer:

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

interface ElectronAPI {
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: IPCListener) => void;
  removeListener: (channel: string) => void;
  removeAllListeners: () => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  loading: LoadingAPI;
  camera: CameraAPI;
}

// Channel validation for security
const validSendChannels = [
  'request-printer-data',
  'request-printer-status',
  'home-axes',
  'pause-print',
  'resume-print',
  'cancel-print',
  // ... other validated channels
];

const validReceiveChannels = [
  'printer-data',
  'backend-initialized',
  'backend-initialization-failed',
  'backend-disposed',
  // ... other validated channels
];

// Secure API implementation with channel validation
contextBridge.exposeInMainWorld('api', {
  send: (channel: string, data?: unknown) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },

  receive: (channel: string, func: IPCListener) => {
    if (validReceiveChannels.includes(channel)) {
      const wrappedFunc: IPCListener = (event: unknown, ...args: unknown[]) => func(...args);
      listeners.set(channel, { original: func, wrapped: wrappedFunc });
      ipcRenderer.on(channel, wrappedFunc);
    } else {
      console.warn(`Invalid receive channel: ${channel}`);
    }
  },

  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
    const validInvokeChannels = [
      'renderer-ready',
      'set-bed-temp',
      'request-printer-status',
      // ... other validated channels
    ];
    
    if (validInvokeChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      console.warn(`Invalid invoke channel: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
  }
} as ElectronAPI);
```

### Listener Management

Implement proper listener cleanup to prevent memory leaks:

```typescript
// Listener tracking for proper cleanup
const listeners = new Map<string, { original: IPCListener; wrapped: IPCListener }>();

const api = {
  removeListener: (channel: string) => {
    if (validReceiveChannels.includes(channel)) {
      const listener = listeners.get(channel);
      if (listener && listener.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
        listeners.delete(channel);
      } else {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  },

  removeAllListeners: () => {
    listeners.forEach((listener, channel) => {
      if (listener && listener.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
      }
    });
    listeners.clear();
  }
};
```

### Type Declaration for Renderer

Provide global type declarations for the renderer process:

```typescript
// src/types/global.d.ts
declare global {
  interface Window {
    api: ElectronAPI;
    CAMERA_URL: string;
  }
}
```

## Context Isolation and Secure Communication

### Context Isolation Configuration

Enable context isolation for security:

```typescript
// Main window creation with security settings
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: preloadPath,
    nodeIntegration: false,        // Disable Node.js in renderer
    contextIsolation: true,        // Enable context isolation
    webSecurity: true,             // Enable web security
    allowRunningInsecureContent: false,
    backgroundThrottling: false,   // Prevent app freezing
    offscreen: false              // Prevent offscreen throttling
  },
  frame: false,                   // Custom title bar
  titleBarStyle: 'hidden',
  show: false                     // Don't show until ready
});
```

### Secure Data Transfer

Never expose sensitive objects directly:

```typescript
// BAD: Don't expose raw backend instances
contextBridge.exposeInMainWorld('backend', printerBackend); // ❌

// GOOD: Expose controlled API functions
contextBridge.exposeInMainWorld('api', {
  requestPrinterStatus: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('request-printer-status');
  },
  
  controlPrinter: async (action: string, params?: unknown): Promise<unknown> => {
    // Validate action before sending
    const validActions = ['pause', 'resume', 'cancel', 'home'];
    if (validActions.includes(action)) {
      return await ipcRenderer.invoke('control-printer', { action, params });
    }
    throw new Error(`Invalid action: ${action}`);
  }
});
```

### Event-Driven Architecture

Use EventEmitter pattern for loose coupling:

```typescript
// Service with event-driven architecture
class ConnectionEstablishmentService extends EventEmitter {
  async connectToPrinter(connectionData: ConnectionData): Promise<ConnectionResult> {
    try {
      // Emit events for different stages
      this.emit('connection-started', { address: connectionData.ipAddress });
      
      const result = await this.performConnection(connectionData);
      
      this.emit('connection-established', result);
      return result;
    } catch (error) {
      this.emit('connection-failed', { error: error.message });
      throw error;
    }
  }
}

// Manager coordinates events between services
class ConnectionFlowManager extends EventEmitter {
  constructor() {
    super();
    this.connectionService.on('connection-established', (data) => {
      this.emit('backend-initialized', data);
    });
  }
}
```

## Window Management and Dialog Handling

### Window Factory Pattern

Use factory pattern for consistent window creation:

```typescript
// src/windows/factories/DialogWindowFactory.ts
export class DialogWindowFactory {
  static createSettingsWindow(): BrowserWindow {
    return new BrowserWindow({
      width: 600,
      height: 500,
      parent: getWindowManager().getMainWindow() || undefined,
      modal: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, '../../lib/ui/settings/settings-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      show: false
    });
  }

  static createJobPickerWindow(): BrowserWindow {
    return new BrowserWindow({
      width: 800,
      height: 600,
      parent: getWindowManager().getMainWindow() || undefined,
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, '../../lib/ui/job-picker/job-picker-preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      },
      show: false
    });
  }
}
```

### Window Manager

Centralize window lifecycle management:

```typescript
// src/windows/WindowManager.ts
class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private dialogWindows: Map<string, BrowserWindow> = new Map();

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    
    // Handle window lifecycle
    window.on('closed', () => {
      this.mainWindow = null;
      this.closeAllDialogs();
    });
  }

  async openDialog(type: DialogType, options?: DialogOptions): Promise<BrowserWindow> {
    // Close existing dialog of same type
    this.closeDialog(type);
    
    const window = this.createDialogWindow(type, options);
    this.dialogWindows.set(type, window);
    
    // Handle dialog lifecycle
    window.on('closed', () => {
      this.dialogWindows.delete(type);
    });
    
    await this.loadDialogContent(window, type);
    window.show();
    
    return window;
  }

  closeDialog(type: DialogType): void {
    const window = this.dialogWindows.get(type);
    if (window && !window.isDestroyed()) {
      window.close();
    }
    this.dialogWindows.delete(type);
  }
}
```

### Modal Dialog Patterns

Implement modal dialogs with proper parent-child relationships:

```typescript
// Input dialog with return value
ipcMain.handle('show-input-dialog', async (event, options: InputDialogOptions): Promise<string | null> => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  
  const inputWindow = new BrowserWindow({
    width: 400,
    height: 200,
    parent: parentWindow || undefined,
    modal: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../lib/ui/input-dialog/input-dialog-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  // Load dialog content
  await inputWindow.loadFile(path.join(__dirname, '../lib/ui/input-dialog/input-dialog.html'));
  
  // Send options to dialog
  inputWindow.webContents.send('set-dialog-options', options);
  
  inputWindow.show();

  // Wait for result
  return new Promise((resolve) => {
    ipcMain.once('input-dialog-result', (event, result: string | null) => {
      if (!inputWindow.isDestroyed()) {
        inputWindow.close();
      }
      resolve(result);
    });
    
    inputWindow.on('closed', () => {
      resolve(null);
    });
  });
});
```

## File System Access Patterns

### Environment-Aware Path Resolution

Handle different environments (development, production, packaged):

```typescript
// src/services/StaticFileManager.ts
class StaticFileManager {
  private readonly environmentService = getEnvironmentDetectionService();

  getMainHTMLPath(): string {
    if (this.environmentService.isDevelopment()) {
      // Development: Use webpack dev server or local files
      return path.join(__dirname, '../../dist/renderer/index.html');
    } else if (this.environmentService.isPackaged()) {
      // Production: Use asar-packaged files
      return path.join(process.resourcesPath, 'app.asar/dist/renderer/index.html');
    } else {
      // Test or other environments
      return path.join(__dirname, '../../dist/renderer/index.html');
    }
  }

  getPreloadScriptPath(): string {
    const preloadBaseName = 'preload.js';
    
    if (this.environmentService.isPackaged()) {
      return path.join(__dirname, preloadBaseName);
    } else {
      return path.join(__dirname, '../lib', preloadBaseName);
    }
  }

  async validateCriticalAssets(): Promise<ValidationResult> {
    const criticalPaths = [
      this.getMainHTMLPath(),
      this.getPreloadScriptPath(),
      // ... other critical assets
    ];

    const results = await Promise.allSettled(
      criticalPaths.map(async (filePath) => {
        try {
          await fs.access(filePath, fs.constants.F_OK);
          return { path: filePath, accessible: true };
        } catch {
          return { path: filePath, accessible: false };
        }
      })
    );

    // Process results and return validation status
    return this.processValidationResults(results);
  }
}
```

### Secure File Operations

Always validate file paths and use proper security checks:

```typescript
// File upload with validation
async function handleFileUpload(filePath: string): Promise<UploadResult> {
  // Validate file path
  if (!path.isAbsolute(filePath)) {
    throw new Error('File path must be absolute');
  }

  // Check file exists and is readable
  try {
    await fs.access(filePath, fs.constants.R_OK);
  } catch {
    throw new Error('File is not accessible');
  }

  // Validate file extension
  const allowedExtensions = ['.gcode', '.g', '.3mf'];
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  // Check file size
  const stats = await fs.stat(filePath);
  const maxSizeBytes = 100 * 1024 * 1024; // 100MB
  if (stats.size > maxSizeBytes) {
    throw new Error('File too large');
  }

  // Proceed with upload
  return await performFileUpload(filePath);
}
```

### User Data Management

Use Electron's userData directory for persistent storage:

```typescript
// Configuration management with proper paths
class ConfigManager {
  private readonly configDir: string;
  private readonly configPath: string;

  constructor() {
    this.configDir = app.getPath('userData');
    this.configPath = path.join(this.configDir, 'config.json');
    
    // Ensure config directory exists
    this.ensureConfigDirectory();
  }

  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create config directory:', error);
    }
  }

  async loadConfig(): Promise<ConfigData> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configContent);
      
      // Validate with Zod schema
      return ConfigSchema.parse(parsedConfig);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, return defaults
        return this.getDefaultConfig();
      }
      throw error;
    }
  }

  async saveConfig(config: ConfigData): Promise<void> {
    // Validate before saving
    const validatedConfig = ConfigSchema.parse(config);
    
    // Atomic write with temporary file
    const tempPath = this.configPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(validatedConfig, null, 2));
    await fs.rename(tempPath, this.configPath);
  }
}
```

## Native Module Integration

### External Hardware Communication

The project integrates with external hardware through native modules:

```typescript
// Integration with ff-api for printer communication
import { FlashForgeAPI, PrinterConnection } from 'ff-api';

class PrinterBackend {
  private api: FlashForgeAPI | null = null;
  private connection: PrinterConnection | null = null;

  async initialize(connectionData: ConnectionData): Promise<void> {
    try {
      this.api = new FlashForgeAPI({
        host: connectionData.ipAddress,
        port: connectionData.port,
        timeout: connectionData.timeout || 10000
      });

      this.connection = await this.api.connect();
      
      // Set up event handlers for hardware events
      this.connection.on('status-update', this.handleStatusUpdate.bind(this));
      this.connection.on('error', this.handleConnectionError.bind(this));
      
    } catch (error) {
      console.error('Failed to initialize printer backend:', error);
      throw new AppError('Backend initialization failed', ErrorCode.BACKEND_INIT_FAILED);
    }
  }

  async sendCommand(command: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.connection) {
      throw new AppError('No active connection', ErrorCode.NO_CONNECTION);
    }

    try {
      return await this.connection.sendCommand(command, params);
    } catch (error) {
      console.error('Command failed:', error);
      throw new AppError('Command execution failed', ErrorCode.COMMAND_FAILED);
    }
  }
}
```

### Graceful Native Module Error Handling

```typescript
// Graceful handling of native module failures
class NativeModuleWrapper {
  private module: any = null;
  private isAvailable = false;

  async initialize(): Promise<void> {
    try {
      // Try to load native module
      this.module = require('native-module');
      this.isAvailable = true;
      console.log('Native module loaded successfully');
    } catch (error) {
      console.warn('Native module not available, using fallback:', error.message);
      this.isAvailable = false;
      this.initializeFallback();
    }
  }

  private initializeFallback(): void {
    // Provide fallback implementation
    this.module = {
      someMethod: () => {
        console.warn('Using fallback implementation');
        return null;
      }
    };
  }

  isNativeModuleAvailable(): boolean {
    return this.isAvailable;
  }
}
```

## Performance Optimization for Electron Apps

### Prevent Background Throttling

Configure Electron to maintain performance when not focused:

```typescript
// Main process configuration for performance
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Browser window configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    backgroundThrottling: false,  // Prevent app freezing when not focused
    offscreen: false            // Prevent offscreen rendering throttling
  }
});

// Power save blocker to prevent OS throttling
let powerSaveBlockerId: number | null = null;

const startPowerSaveBlocker = (): void => {
  if (powerSaveBlockerId === null) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('Power save blocker started');
  }
};

const stopPowerSaveBlocker = (): void => {
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
    console.log('Power save blocker stopped');
  }
};
```

### Efficient Polling and Data Updates

Implement smart polling with coordinated updates:

```typescript
// Coordinated polling service
class MainProcessPollingCoordinator {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_RATE = 2000; // 2 seconds

  startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.performPollingCycle();
      } catch (error) {
        console.error('Polling cycle failed:', error);
      }
    }, this.POLLING_RATE);
  }

  private async performPollingCycle(): Promise<void> {
    const backendManager = getPrinterBackendManager();
    const windowManager = getWindowManager();
    
    if (!backendManager.hasActiveBackend()) {
      return;
    }

    // Get fresh data from printer
    const [printerData, materialData] = await Promise.all([
      backendManager.requestPrinterStatus(),
      backendManager.requestMaterialStationStatus()
    ]);

    // Send updates to all interested parties
    const pollingData: PollingData = {
      printer: printerData,
      material: materialData,
      timestamp: new Date().toISOString()
    };

    // Update main window
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('polling-update', pollingData);
    }

    // Update WebUI clients
    const webUIManager = getWebUIManager();
    await webUIManager.broadcastStatusUpdate(pollingData);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
```

### Memory Management

Implement proper cleanup and memory management:

```typescript
// Service with proper cleanup
class CameraProxyService extends EventEmitter {
  private server: http.Server | null = null;
  private connections: Set<WebSocket> = new Set();

  async initialize(config: CameraConfig): Promise<void> {
    // ... initialization code
  }

  async shutdown(): Promise<void> {
    // Close all WebSocket connections
    for (const connection of this.connections) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    }
    this.connections.clear();

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.log('Camera proxy server closed');
          resolve();
        });
      });
      this.server = null;
    }

    // Remove all event listeners
    this.removeAllListeners();
  }

  dispose(): void {
    // Synchronous cleanup for app shutdown
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.connections.clear();
    this.removeAllListeners();
  }
}
```

### Webpack Optimization

Configure webpack for optimal bundle size and performance:

```javascript
// webpack.config.js optimization
module.exports = {
  target: 'electron-renderer',
  
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    splitChunks: process.env.NODE_ENV === 'production' ? {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        }
      }
    } : false
  },
  
  // Externals to reduce bundle size
  externals: {
    electron: 'commonjs electron'
  },
  
  // Performance hints
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
```

## Security Best Practices

### Secure Defaults

Always use secure configurations:

```typescript
// Secure BrowserWindow configuration
const createSecureWindow = (): BrowserWindow => {
  return new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,              // ✅ Disable Node.js in renderer
      contextIsolation: true,              // ✅ Enable context isolation
      webSecurity: true,                   // ✅ Enable web security
      allowRunningInsecureContent: false, // ✅ Block insecure content
      experimentalFeatures: false,         // ✅ Disable experimental features
      enableBlinkFeatures: undefined,      // ✅ Don't enable additional features
      disableBlinkFeatures: undefined,     // ✅ Don't disable security features
      preload: path.join(__dirname, 'preload.js') // ✅ Use preload for API
    }
  });
};
```

### Input Validation and Sanitization

Use Zod schemas for all input validation:

```typescript
// Schema definitions for validation
const PrinterConnectionSchema = z.object({
  ipAddress: z.string().ip('Invalid IP address'),
  port: z.number().int().min(1).max(65535),
  timeout: z.number().int().min(1000).max(30000).optional(),
  authToken: z.string().min(1).optional()
});

const FileUploadSchema = z.object({
  filePath: z.string().min(1, 'File path required'),
  filename: z.string().min(1, 'Filename required'),
  startNow: z.boolean(),
  autoLevel: z.boolean()
});

// Handler with validation
ipcMain.handle('connect-printer', async (event, payload: unknown) => {
  try {
    // Validate input
    const validatedData = PrinterConnectionSchema.parse(payload);
    
    // Additional security checks
    if (!path.isAbsolute(validatedData.filePath || '')) {
      throw new Error('File path must be absolute');
    }
    
    // Process request
    const result = await connectionManager.connect(validatedData);
    return { success: true, data: result };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: error.errors 
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});
```

### WebUI Security

Implement proper authentication and rate limiting for the web interface:

```typescript
// WebUI authentication middleware
import rateLimit from 'express-rate-limit';

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const createAuthMiddleware = (authManager: AuthManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const isValid = await authManager.validateToken(token);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  };
};

// Secure route setup
app.post('/api/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = WebUILoginRequestSchema.parse(req.body);
    
    const authResult = await authManager.authenticate(username, password);
    if (authResult.success) {
      res.json({ token: authResult.token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});
```

### Content Security Policy

Implement CSP for renderer processes:

```html
<!-- In renderer HTML files -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' ws: wss:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

## Build and Packaging Considerations

### Multi-Target TypeScript Compilation

Use separate build processes for different targets:

```json
{
  "scripts": {
    "build": "npm run build:main && npm run build:renderer && npm run build:webui",
    "build:main": "tsc",
    "build:renderer": "webpack --config webpack.config.js",
    "build:webui": "tsc --project src/webui/static/tsconfig.json && npm run build:webui:copy",
    "dev": "concurrently \"npm run build:main:watch\" \"npm run build:renderer:watch\"",
    "build:main:watch": "tsc --watch",
    "build:renderer:watch": "webpack --config webpack.config.js --watch"
  }
}
```

### Electron Builder Configuration

Configure electron-builder for cross-platform builds:

```javascript
// electron-builder-config.js
module.exports = {
  appId: 'com.ghosttypes.flashforgeui',
  productName: 'FlashForgeUI',
  directories: {
    output: 'dist',
    buildResources: 'assets'
  },
  files: [
    'lib/**/*',
    'dist/renderer/**/*',
    'src/webui/static/**/*',
    'node_modules/**/*',
    'package.json'
  ],
  extraFiles: [
    {
      from: 'assets',
      to: 'assets',
      filter: ['**/*']
    }
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'src/icons/icon.ico'
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      }
    ],
    icon: 'src/icons/icon.png',
    category: 'Utility'
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'src/icons/icon.icns'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  }
};
```

### Asset Management

Handle assets properly across environments:

```typescript
// Asset copying script
const fs = require('fs').promises;
const path = require('path');

async function copyWebUIAssets() {
  const sourceDir = path.join(__dirname, '../src/webui/static');
  const targetDir = path.join(__dirname, '../lib/webui/static');
  
  await fs.mkdir(targetDir, { recursive: true });
  
  const files = ['index.html', 'webui.css', 'app.js'];
  
  for (const file of files) {
    const source = path.join(sourceDir, file);
    const target = path.join(targetDir, file);
    
    try {
      await fs.copyFile(source, target);
      console.log(`Copied ${file}`);
    } catch (error) {
      console.error(`Failed to copy ${file}:`, error);
    }
  }
}

copyWebUIAssets().catch(console.error);
```

## Testing Electron Applications

### Unit Testing with Jest

Configure Jest for TypeScript and Electron:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/types/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/services/__tests__/setup.ts']
};
```

### Service Testing

Test services with proper mocking:

```typescript
// src/services/__tests__/StaticFileManager.test.ts
import { StaticFileManager } from '../StaticFileManager';
import { EnvironmentDetectionService } from '../EnvironmentDetectionService';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('../EnvironmentDetectionService');

describe('StaticFileManager', () => {
  let staticFileManager: StaticFileManager;
  let mockEnvironmentService: jest.Mocked<EnvironmentDetectionService>;

  beforeEach(() => {
    mockEnvironmentService = new EnvironmentDetectionService() as jest.Mocked<EnvironmentDetectionService>;
    staticFileManager = new StaticFileManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCriticalAssets', () => {
    it('should return valid result when all assets exist', async () => {
      // Mock fs.access to succeed
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockEnvironmentService.isPackaged.mockReturnValue(false);

      const result = await staticFileManager.validateCriticalAssets();

      expect(result.isValid).toBe(true);
      expect(result.missingAssets).toHaveLength(0);
    });

    it('should return invalid result when assets are missing', async () => {
      // Mock fs.access to fail
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      mockEnvironmentService.isPackaged.mockReturnValue(false);

      const result = await staticFileManager.validateCriticalAssets();

      expect(result.isValid).toBe(false);
      expect(result.missingAssets.length).toBeGreaterThan(0);
    });
  });
});
```

### IPC Testing

Test IPC handlers in isolation:

```typescript
// src/ipc/handlers/__tests__/connection-handlers.test.ts
import { ipcMain } from 'electron';
import { registerConnectionHandlers } from '../connection-handlers';
import { ConnectionFlowManager } from '../../../managers/ConnectionFlowManager';
import { WindowManager } from '../../../windows/WindowManager';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

describe('Connection Handlers', () => {
  let mockConnectionManager: jest.Mocked<ConnectionFlowManager>;
  let mockWindowManager: jest.Mocked<WindowManager>;

  beforeEach(() => {
    mockConnectionManager = {} as jest.Mocked<ConnectionFlowManager>;
    mockWindowManager = {} as jest.Mocked<WindowManager>;
    
    registerConnectionHandlers(mockConnectionManager, mockWindowManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register connect-to-printer handler', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'connect-to-printer',
      expect.any(Function)
    );
  });

  // Test handler implementation
  it('should handle valid connection request', async () => {
    const mockHandler = (ipcMain.handle as jest.Mock).mock.calls
      .find(call => call[0] === 'connect-to-printer')[1];

    mockConnectionManager.connectToPrinter = jest.fn().mockResolvedValue({
      success: true,
      printerDetails: { Name: 'Test Printer' }
    });

    const result = await mockHandler(null, {
      ipAddress: '192.168.1.100',
      port: 8899,
      timeout: 10000
    });

    expect(result.success).toBe(true);
    expect(mockConnectionManager.connectToPrinter).toHaveBeenCalled();
  });
});
```

## Debugging Techniques

### Development Tools

Enable debugging tools for development:

```typescript
// Development debugging configuration
if (environmentService.isDevelopment()) {
  // Open DevTools automatically
  mainWindow.webContents.openDevTools();
  
  // Enable Electron DevTools
  const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
  
  app.whenReady().then(() => {
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name: string) => console.log(`Added Extension: ${name}`))
      .catch((err: Error) => console.log('An error occurred: ', err));
  });
}
```

### Logging and Error Handling

Implement comprehensive logging:

```typescript
// Logging utility
class Logger {
  private static logToFile(level: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      process: process.type || 'main'
    };
    
    // Write to log file
    const logPath = path.join(app.getPath('userData'), 'app.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFile(logPath, logLine).catch(console.error);
  }

  static info(message: string, data?: unknown): void {
    console.log(`[INFO] ${message}`, data || '');
    this.logToFile('INFO', message, data);
  }

  static error(message: string, error?: Error | unknown): void {
    console.error(`[ERROR] ${message}`, error || '');
    this.logToFile('ERROR', message, error);
  }

  static debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data || '');
      this.logToFile('DEBUG', message, data);
    }
  }
}
```

### Remote Debugging

Enable remote debugging for renderer processes:

```typescript
// Enable remote debugging
if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('log-level', '0');
}

// In main window creation
const mainWindow = new BrowserWindow({
  webPreferences: {
    // Enable Node.js debugging (only in development)
    nodeIntegrationInWorker: false,
    webSecurity: !environmentService.isDevelopment()
  }
});

// Debug information
if (environmentService.isDevelopment()) {
  console.log('Remote debugging available at: http://localhost:9222');
  console.log('Main process PID:', process.pid);
  console.log('App version:', app.getVersion());
  console.log('Electron version:', process.versions.electron);
  console.log('Chrome version:', process.versions.chrome);
}
```

### Error Boundaries and Crash Handling

Handle crashes gracefully:

```typescript
// Main process crash handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Show error dialog
  dialog.showErrorBox(
    'Application Error', 
    `An unexpected error occurred: ${error.message}\n\nThe application will now exit.`
  );
  
  // Clean shutdown
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log but don't crash
  Logger.error('Unhandled promise rejection', { reason, promise });
});

// Renderer crash handling
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Renderer process crashed:', details);
  
  // Restart renderer if main window crashed
  const windowManager = getWindowManager();
  const mainWindow = windowManager.getMainWindow();
  
  if (mainWindow && webContents === mainWindow.webContents) {
    console.log('Main window crashed, attempting to recreate...');
    
    setTimeout(async () => {
      try {
        await createMainWindow();
      } catch (error) {
        console.error('Failed to recreate main window:', error);
        app.quit();
      }
    }, 1000);
  }
});
```

## Auto-updater Implementation

### Update Configuration

Configure auto-updater for different platforms:

```typescript
// Auto-updater setup
import { autoUpdater } from 'electron-updater';

class UpdateManager {
  private updateCheckInterval: NodeJS.Timeout | null = null;

  initialize(): void {
    // Configure auto-updater
    autoUpdater.checkForUpdatesAndNotify();
    
    // Set up event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
      log_message += ` - Downloaded ${progressObj.percent}%`;
      log_message += ` (${progressObj.transferred}/${progressObj.total})`;
      console.log(log_message);
      
      this.updateProgressDialog(progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      this.showRestartDialog(info);
    });

    // Check for updates periodically (every 2 hours)
    this.updateCheckInterval = setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 2 * 60 * 60 * 1000);
  }

  private showUpdateAvailableDialog(info: any): void {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    }
  }

  private showRestartDialog(info: any): void {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Update ${info.version} has been downloaded. Restart the application to apply the update.`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  }

  dispose(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }
}
```

### Update Server Configuration

Configure update server for electron-updater:

```json
{
  "publish": [
    {
      "provider": "github",
      "owner": "your-username",
      "repo": "flashforgeui-electron"
    }
  ]
}
```

## Platform-specific Considerations

### Windows-specific Features

```typescript
// Windows-specific configuration
if (process.platform === 'win32') {
  // Set app user model ID for proper taskbar grouping
  app.setAppUserModelId('com.ghosttypes.flashforgeui');
  
  // Handle installer events (NSIS)
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
  
  // Windows-specific file associations
  app.setAsDefaultProtocolClient('flashforgeui');
  
  // Handle protocol activation
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Handle custom protocol URLs
    const url = commandLine.find(arg => arg.startsWith('flashforgeui://'));
    if (url) {
      handleProtocolUrl(url);
    }
  });
}
```

### macOS-specific Features

```typescript
// macOS-specific configuration
if (process.platform === 'darwin') {
  // Handle app activation (dock icon click)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  
  // macOS menu bar
  const { Menu } = require('electron');
  const template = [
    {
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // Handle dock bounce
  app.dock.setBadge('1'); // Show notification count
}
```

### Linux-specific Features

```typescript
// Linux-specific configuration
if (process.platform === 'linux') {
  // Set desktop entry
  app.setDesktopName('FlashForgeUI');
  
  // Handle system theme changes
  nativeTheme.on('updated', () => {
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();
    
    if (mainWindow) {
      mainWindow.webContents.send('theme-changed', {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors
      });
    }
  });
}
```

### Network Interface Discovery

Handle platform-specific network interfaces:

```typescript
// Cross-platform network interface discovery
function getLocalIPAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  
  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    
    for (const net of nets) {
      // Skip internal and IPv6 addresses
      if (net.internal || net.family !== 'IPv4') {
        continue;
      }
      
      // Platform-specific interface filtering
      if (process.platform === 'win32') {
        // Windows: Skip Hyper-V and VMware interfaces
        if (name.includes('Hyper-V') || name.includes('VMware')) {
          continue;
        }
      } else if (process.platform === 'linux') {
        // Linux: Skip docker and virtual interfaces
        if (name.startsWith('docker') || name.startsWith('veth') || name.startsWith('br-')) {
          continue;
        }
      }
      
      addresses.push(net.address);
    }
  }
  
  return addresses;
}
```

This comprehensive documentation covers all the essential Electron + TypeScript best practices specifically tailored for the FlashForgeUI-Electron project. The patterns and examples are drawn directly from the project's architecture and can be immediately applied to maintain consistency and quality across the codebase.