# Multi-Printer Tabbed Support Implementation Plan

## Overview
Implement multi-printer support using the "context switching" pattern - converting singleton managers to hold multiple contexts while maintaining existing API compatibility.

## Phase 1: Core Context Management System

### 1.1 Create PrinterContextManager (`src/managers/PrinterContextManager.ts`)

```typescript
export interface PrinterContext {
  id: string;                    // Unique context identifier
  name: string;                  // Display name for tab
  printerDetails: PrinterDetails;
  backend: PrinterBackend | null;
  connectionState: ConnectionState;
  pollingService: PrinterPollingService | null;
  cameraProxyPort: number | null;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export class PrinterContextManager extends EventEmitter {
  private static instance: PrinterContextManager;
  private contexts = new Map<string, PrinterContext>();
  private activeContextId: string | null = null;

  // Core context management
  createContext(printerDetails: PrinterDetails): string
  removeContext(contextId: string): void
  switchContext(contextId: string): void
  getActiveContext(): PrinterContext | null
  getAllContexts(): PrinterContext[]

  // Event emissions
  emit('context-created', contextId: string)
  emit('context-removed', contextId: string)
  emit('context-switched', contextId: string, previousId: string | null)
}
```

### 1.2 Context State Types (`src/types/PrinterContext.ts`)

```typescript
export interface PrinterContextInfo {
  id: string;
  name: string;
  ip: string;
  model: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  isActive: boolean;
  hasCamera: boolean;
  cameraUrl?: string;
}

export interface ContextSwitchEvent {
  contextId: string;
  previousContextId: string | null;
  context: PrinterContext;
}
```

## Phase 2: Convert Managers to Context-Aware

### 2.1 Update PrinterBackendManager (`src/managers/PrinterBackendManager.ts`)

**Current Key Methods:**
```typescript
// Existing methods to modify:
initializeBackend(options) → initializeBackend(contextId: string, options)
getCurrentBackend() → getCurrentBackend() // unchanged API, context-aware internally
getBackend() → getBackend() // unchanged API
dispose() → disposeContext(contextId: string)
```

**Implementation:**
```typescript
class PrinterBackendManager {
  private contextBackends = new Map<string, PrinterBackend>();

  async initializeBackend(contextId: string, options: any): Promise<void> {
    const context = PrinterContextManager.getInstance().getContext(contextId);
    const backend = await this.createBackendForPrinter(context.printerDetails, options);
    this.contextBackends.set(contextId, backend);

    // Update context
    context.backend = backend;
  }

  getCurrentBackend(): PrinterBackend | null {
    const activeContextId = PrinterContextManager.getInstance().getActiveContextId();
    return activeContextId ? this.contextBackends.get(activeContextId) || null : null;
  }
}
```

### 2.2 Update ConnectionStateManager (`src/managers/ConnectionStateManager.ts`)

**Current Key Methods:**
```typescript
// Existing methods to modify:
setConnected(details, clients) → setConnected(contextId: string, details, clients)
setDisconnected() → setDisconnected(contextId: string)
isConnected() → isConnected(contextId?: string) // optional contextId, defaults to active
getConnectionState() → getConnectionState(contextId?: string)
```

### 2.3 Update PrinterDetailsManager (`src/managers/PrinterDetailsManager.ts`)

**Current Key Methods:**
```typescript
// Context-aware saved printer management
getSavedPrinters() // returns all saved printers across contexts
getLastUsedPrinter() → getLastUsedPrinter(contextId?: string)
savePrinterDetails(details) → savePrinterDetails(contextId: string, details)
```

## Phase 3: UI Tab Bar Component

### 3.1 Create PrinterTabsComponent (`src/ui/components/printer-tabs/`)

**File Structure:**
```
src/ui/components/printer-tabs/
├── PrinterTabsComponent.ts     // Main component logic
├── printer-tabs.css           // Tab bar styling
└── index.ts                   // Export
```

**Component Interface:**
```typescript
export class PrinterTabsComponent extends EventEmitter {
  private tabsContainer: HTMLElement;
  private addTabButton: HTMLElement;

  // Tab management
  addTab(context: PrinterContext): void
  removeTab(contextId: string): void
  updateTab(contextId: string, updates: Partial<PrinterContextInfo>): void
  setActiveTab(contextId: string): void

  // UI events
  emit('tab-clicked', contextId: string)
  emit('tab-closed', contextId: string)
  emit('add-printer-clicked')
}
```

### 3.2 Update Main Window UI (`src/ui/index.html`)

**Add tab bar above main content:**
```html
<body>
  <!-- New tab bar section -->
  <div id="printer-tabs-container" class="printer-tabs-bar">
    <!-- PrinterTabsComponent will be mounted here -->
  </div>

  <!-- Existing main content -->
  <div id="main-content" class="main-layout">
    <!-- existing content unchanged -->
  </div>
</body>
```

### 3.3 Tab Bar Styling (`src/ui/components/printer-tabs/printer-tabs.css`)

**Key Features:**
- Tab appearance matching Orca-FlashForge style
- Active/inactive states
- Close buttons on tabs
- Add printer button
- Status indicators (connected/disconnected/error)
- Responsive layout

## Phase 4: Multi-Context Services

### 4.1 Update PrinterPollingService (`src/services/PrinterPollingService.ts`)

**Current Structure Analysis:**
- Currently polls single backend from PrinterBackendManager
- Needs to become context-aware with priority polling

**New Architecture:**
```typescript
class MultiContextPollingCoordinator {
  private pollingServices = new Map<string, PrinterPollingService>();

  startPollingForContext(contextId: string): void {
    const context = PrinterContextManager.getInstance().getContext(contextId);
    const poller = new PrinterPollingService(context.backend);
    this.pollingServices.set(contextId, poller);

    // Active context: poll every 3s, inactive: every 30s
    const interval = context.isActive ? 3000 : 30000;
    poller.setPollingInterval(interval);
  }

  onContextSwitch(newContextId: string): void {
    // Update polling frequencies
    this.pollingServices.forEach((poller, contextId) => {
      const interval = contextId === newContextId ? 3000 : 30000;
      poller.setPollingInterval(interval);
    });
  }
}
```

### 4.2 Update CameraProxyService (`src/services/CameraProxyService.ts`)

**Current Implementation:**
- Single stream URL on port 8181
- `setStreamUrl()` method replaces current stream

**New Context-Aware Implementation:**
```typescript
class CameraProxyService {
  private contextStreams = new Map<string, { port: number, server: http.Server, url: string }>();
  private portAllocator = new PortAllocator(8181, 8191);

  async setStreamUrl(contextId: string, url: string): Promise<string> {
    if (this.contextStreams.has(contextId)) {
      this.contextStreams.get(contextId)?.server.close();
    }

    const port = this.portAllocator.allocatePort();
    const server = this.createProxyServer(url, port);
    const localUrl = `http://localhost:${port}/stream`;

    this.contextStreams.set(contextId, { port, server, url: localUrl });
    return localUrl;
  }

  getCurrentStreamUrl(): string | null {
    const activeContextId = PrinterContextManager.getInstance().getActiveContextId();
    return activeContextId ? this.contextStreams.get(activeContextId)?.url || null : null;
  }
}
```

### 4.3 Create PortAllocator Utility (`src/utils/PortAllocator.ts`)

```typescript
export class PortAllocator {
  private allocatedPorts = new Set<number>();
  private currentPort: number;

  constructor(private startPort: number, private endPort: number) {
    this.currentPort = startPort;
  }

  allocatePort(): number {
    while (this.currentPort <= this.endPort && this.allocatedPorts.has(this.currentPort)) {
      this.currentPort++;
    }

    if (this.currentPort > this.endPort) {
      throw new Error('No available ports in range');
    }

    this.allocatedPorts.add(this.currentPort);
    return this.currentPort++;
  }

  releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }
}
```

## Phase 5: IPC Integration

### 5.1 Update IPC Handlers (`src/preload.ts`)

**Add new context-aware IPC methods:**
```typescript
// New IPC methods for multi-printer
'printer-contexts:get-all': () => PrinterContextInfo[]
'printer-contexts:get-active': () => PrinterContextInfo | null
'printer-contexts:switch': (contextId: string) => void
'printer-contexts:remove': (contextId: string) => void
'printer-contexts:create': (printerDetails: PrinterDetails) => string

// Extend existing methods with optional contextId
'connection-state:is-connected': (contextId?: string) => boolean
'camera:get-stream-url': (contextId?: string) => string | null
```

### 5.2 Update Main Process IPC (`src/index.ts`)

**Add context event forwarding:**
```typescript
// Forward context manager events to renderer
PrinterContextManager.getInstance().on('context-created', (contextId) => {
  mainWindow?.webContents.send('printer-context-created', contextId);
});

PrinterContextManager.getInstance().on('context-switched', (contextId, previousId) => {
  mainWindow?.webContents.send('printer-context-switched', contextId, previousId);
});
```

## Phase 6: Connection Flow Integration

### 6.1 Update ConnectionFlowManager (`src/managers/ConnectionFlowManager.ts`)

**Key Changes:**
- Allow multiple concurrent connection flows
- Create new context on successful connection
- Switch to new context automatically

```typescript
class ConnectionFlowManager {
  private activeFlows = new Map<string, ConnectionFlowState>();

  async startConnectionFlow(): Promise<string> {
    const flowId = generateUniqueId();

    // Run existing connection logic
    const result = await this.runConnectionProcess();

    if (result.success) {
      // Create new printer context
      const contextId = PrinterContextManager.getInstance().createContext(result.printerDetails);

      // Switch to new context
      PrinterContextManager.getInstance().switchContext(contextId);

      return contextId;
    }

    throw new Error(result.error);
  }
}
```

## Phase 7: WebUI Multi-Printer Support

### 7.1 Update WebUI API Routes (`src/webui/api-routes.ts`)

**New Multi-Printer Endpoints:**
```typescript
// New routes
GET    /api/printers                    // List all contexts
GET    /api/printers/:contextId/status  // Context-specific status
GET    /api/printers/:contextId/camera  // Context-specific camera
POST   /api/printers/:contextId/connect // Context-specific connection
DELETE /api/printers/:contextId         // Remove context

// Existing routes (backward compatible)
GET    /api/status    // Active context status
GET    /api/camera    // Active context camera
```

### 7.2 Update WebSocket Manager (`src/webui/WebSocketManager.ts`)

**Multi-Context WebSocket Events:**
```typescript
// Extended WebSocket messages
{
  type: 'printer-status',
  contextId: string,
  data: PrinterStatus
}

{
  type: 'context-list',
  contexts: PrinterContextInfo[]
}

{
  type: 'context-switched',
  activeContextId: string,
  previousContextId: string | null
}
```

## Implementation Phases Overview

### Phase 1: Foundation
- Create `PrinterContextManager`
- Create context types
- Basic context creation/switching

### Phase 2: Manager Updates
- Update `PrinterBackendManager`
- Update `ConnectionStateManager`
- Update `PrinterDetailsManager`

### Phase 3: UI Implementation
- Create `PrinterTabsComponent`
- Update main window layout
- Add tab styling

### Phase 4: Services
- Multi-context polling coordinator
- Context-aware camera proxy
- Port allocation system

### Phase 5: Integration & Testing
- IPC integration
- Connection flow updates
- End-to-end testing

### Phase 6: WebUI Enhancement
- Multi-printer API routes
- WebSocket updates
- Web interface testing

## Testing Strategy

1. **Single Printer Mode**: Verify existing functionality unchanged
2. **Multi-Printer Scenarios**: Connect 2-3 printers simultaneously
3. **Context Switching**: Test tab switching performance and data integrity
4. **Resource Management**: Verify proper cleanup of disconnected contexts
5. **WebUI Compatibility**: Test both single and multi-printer web access

## Key Benefits

- **95% of existing code unchanged** - We're extending behavior, not rewriting
- **Zero UI component changes** - They just render different data when context switches
- **Familiar UX** - Matches Orca-FlashForge's tabbed interface exactly
- **Backward compatible** - Single printer mode works identically
- **Resource efficient** - Background contexts use reduced polling frequency