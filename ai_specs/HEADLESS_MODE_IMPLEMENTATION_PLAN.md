# Headless Mode Implementation Plan

**Created:** 2025-10-02
**Updated:** 2025-10-03 - Multi-printer support integration
**Goal:** Run FlashForgeUI without UI, auto-connect to specified printer(s), serve WebUI with full multi-printer support and bi-directional control

## CLI Arguments

```bash
# Single printer (new)
FlashForgeUI.exe --headless --printer-type=new --ip=192.168.1.100 --check-code=12345678

# Single printer (legacy)
FlashForgeUI.exe --headless --printer-type=legacy --ip=192.168.1.100

# Multiple printers
FlashForgeUI.exe --headless --printers="192.168.1.100:new:12345678,192.168.1.101:legacy"

# Optional overrides
--webui-port=3001
--webui-password=mypassword
```

**Note on Multi-Printer:**
- In headless mode with multiple printers, all are connected simultaneously
- WebUI can switch between printers and control them independently
- First printer in the list becomes the initial active context

## Files to Create

### 1. `src/utils/HeadlessArguments.ts`
Parse and validate CLI arguments.

```typescript
export interface HeadlessConfig {
  enabled: boolean;
  printerType: 'new' | 'legacy';
  ipAddress: string;
  checkCode?: string;
  webUIPort?: number;
  webUIPassword?: string;
}

export function parseHeadlessArguments(): HeadlessConfig | null
export function validateHeadlessConfig(config: HeadlessConfig): { valid: boolean; errors: string[] }
```

### 2. `src/managers/HeadlessManager.ts`
Orchestrate headless mode - connection(s), WebUI, polling, lifecycle.

```typescript
export class HeadlessManager extends EventEmitter {
  async initialize(config: HeadlessConfig): Promise<void>
  async connectToPrinter(ip: string, type: PrinterClientType, checkCode?: string): Promise<string> // Returns contextId
  async connectMultiplePrinters(printers: PrinterSpec[]): Promise<string[]> // Returns contextIds
  async startWebUI(): Promise<void>
  async shutdown(): Promise<void>
  getHealthStatus(): object
}
```

**Multi-Printer Integration:**
- Uses PrinterContextManager to manage multiple contexts
- Each printer connection creates a new context
- MultiContextPollingCoordinator handles all polling
- WebUI can query all contexts via existing API routes

### 3. `src/utils/HeadlessDetection.ts`
Simple flag to check if running headless.

```typescript
let headlessMode = false;
export function setHeadlessMode(enabled: boolean): void
export function isHeadlessMode(): boolean
```

### 4. `src/utils/HeadlessLogger.ts`
Structured console logging for headless mode.

```typescript
export class HeadlessLogger {
  logInfo(message: string): void
  logError(message: string, error?: Error): void
  logConnectionStatus(status: PrinterConnectionState): void
  logWebUIStatus(status: WebUIServerStatus): void
}
```

## Files to Modify

### `src/index.ts`
Add headless mode entry point before standard initialization.

```typescript
// Early check for headless mode
const headlessConfig = parseHeadlessArguments();

if (headlessConfig) {
  // Headless path
  void app.whenReady().then(() => initializeHeadless(headlessConfig));
} else {
  // Standard path (existing code)
  void app.whenReady().then(async () => {
    await initializeApp();
    // ... existing code
  });
}

async function initializeHeadless(config: HeadlessConfig): Promise<void> {
  setHeadlessMode(true);

  const headlessManager = new HeadlessManager();
  await headlessManager.initialize(config);

  // Setup signal handlers
  process.on('SIGINT', () => headlessManager.shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => headlessManager.shutdown().then(() => process.exit(0)));
}
```

### `src/managers/ConnectionFlowManager.ts`
Add method for direct programmatic connection without UI prompts.

```typescript
/**
 * Connect directly to specified printer (headless mode)
 * Creates a new printer context and returns the context ID
 */
public async connectDirectly(
  ipAddress: string,
  clientType: PrinterClientType,
  checkCode?: string
): Promise<{ success: boolean; contextId?: string; error?: string }> {
  // Create mock discovered printer
  const mockPrinter: DiscoveredPrinter = {
    name: `Printer at ${ipAddress}`,
    ipAddress,
    serialNumber: '', // Will be determined during connection
    model: undefined
  };

  // Use existing connectToPrinter flow
  // Override check code if provided
  // Skip all UI dialogs
  // Return context ID on success
}
```

**Multi-Printer Changes:**
- ConnectionFlowManager already creates contexts via PrinterContextManager
- connectDirectly leverages existing context creation flow
- Returns contextId for tracking in headless mode

### `src/services/notifications/index.ts`
Skip desktop notifications in headless mode.

```typescript
export function initializeNotificationSystem(): void {
  if (isHeadlessMode()) {
    console.log('[Headless] Skipping notification system');
    return;
  }
  // ... existing code
}
```

## HeadlessManager Implementation Details

```typescript
class HeadlessManager {
  private config: HeadlessConfig;
  private logger: HeadlessLogger;
  private configManager: ConfigManager;
  private connectionManager: ConnectionFlowManager;
  private webUIManager: WebUIManager;
  private pollingCoordinator: MultiContextPollingCoordinator;
  private contextManager: PrinterContextManager;
  private connectedContexts: string[] = [];

  async initialize(config: HeadlessConfig): Promise<void> {
    this.logger.logInfo('Starting FlashForgeUI in headless mode');

    // Apply config overrides
    if (config.webUIPort) {
      this.configManager.set('WebUIPort', config.webUIPort);
    }
    if (config.webUIPassword) {
      this.configManager.set('WebUIPassword', config.webUIPassword);
    }

    // Force enable WebUI
    this.configManager.set('WebUIEnabled', true);

    // Connect to printer(s)
    if (config.printers && config.printers.length > 1) {
      this.logger.logInfo(`Connecting to ${config.printers.length} printers...`);
      this.connectedContexts = await this.connectMultiplePrinters(config.printers);
    } else {
      this.logger.logInfo(`Connecting to ${config.ipAddress}...`);
      const result = await this.connectToPrinter(
        config.ipAddress,
        config.printerType,
        config.checkCode
      );
      if (result) {
        this.connectedContexts.push(result);
      }
    }

    if (this.connectedContexts.length === 0) {
      this.logger.logError('No printers connected');
      process.exit(1);
    }

    this.logger.logInfo(`Connected to ${this.connectedContexts.length} printer(s)`);

    // WebUI starts automatically on backend-initialized event (existing flow)
    const status = this.webUIManager.getStatus();
    this.logger.logWebUIStatus(status);

    this.logger.logInfo('Headless mode ready!');
  }

  async connectToPrinter(
    ip: string,
    type: PrinterClientType,
    checkCode?: string
  ): Promise<string | null> {
    const result = await this.connectionManager.connectDirectly(ip, type, checkCode);
    if (!result.success) {
      this.logger.logError(`Connection to ${ip} failed: ${result.error}`);
      return null;
    }
    return result.contextId || null;
  }

  async connectMultiplePrinters(printers: PrinterSpec[]): Promise<string[]> {
    const contextIds: string[] = [];
    for (const printer of printers) {
      const contextId = await this.connectToPrinter(
        printer.ip,
        printer.type,
        printer.checkCode
      );
      if (contextId) {
        contextIds.push(contextId);
      }
    }
    return contextIds;
  }

  async shutdown(): Promise<void> {
    this.logger.logInfo('Shutting down gracefully...');

    // Stop all polling
    this.pollingCoordinator.stopAllPolling();

    // Disconnect all printers
    for (const contextId of this.connectedContexts) {
      await this.connectionManager.disconnectContext(contextId);
    }

    // Stop WebUI
    await this.webUIManager.stop();

    this.logger.logInfo('Shutdown complete');
  }
}
```

## What Gets Skipped in Headless Mode

- BrowserWindow creation
- IPC handler registration
- WindowManager
- Dialog services
- Desktop notifications
- DevTools
- UI logging/events

## What Runs in Headless Mode

- ConfigManager ✓
- ConnectionFlowManager ✓
- PrinterBackendManager ✓
- **PrinterContextManager** ✓ (new)
- **MultiContextPollingCoordinator** ✓ (replaces MainProcessPollingCoordinator)
- WebUIManager ✓
- CameraProxyService ✓ (per-context)
- All backend services ✓

## WebUI Bi-Directional Control

The WebUI in headless mode has **full control** over printer contexts, not just read-only access:

### WebUI Can Control:

1. **Context Switching**
   - `GET /api/contexts` - List all connected printers
   - `POST /api/contexts/switch` - Change active printer context
   - `GET /api/contexts/active` - Get currently active context

2. **Printer Management**
   - `POST /api/connect` - Connect to a new printer (creates new context)
   - `POST /api/disconnect` - Disconnect from a printer (removes context)
   - Context switching automatically updates polling focus

3. **Printer Operations**
   - All existing operations (`/api/control/*`, `/api/job/*`, etc.) accept optional `contextId` parameter
   - If no `contextId` provided, operates on active context
   - Explicit `contextId` operates on specific printer regardless of active state

4. **Data Retrieval**
   - `GET /api/status` - Get status for specific context or active
   - `GET /api/camera/stream` - Get camera stream URL for context
   - WebSocket events include `contextId` for routing updates to correct UI elements

### How WebUI Controls Active Context:

```javascript
// WebUI switches to a different printer
await fetch('/api/contexts/switch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contextId: 'context-2-1733357937001' })
});

// Main process receives request, calls:
printerContextManager.switchContext('context-2-1733357937001');

// MultiContextPollingCoordinator automatically adjusts polling
// WebSocket broadcasts context-switched event
// WebUI updates to show new active printer
```

### Existing API Routes Already Support This:

The `/api/contexts/*` routes in `src/webui/server/api-routes.ts` already implement:
- `GET /contexts` - Returns all contexts
- `GET /contexts/active` - Returns active context
- `POST /contexts/switch` - Switches active context
- `DELETE /contexts/:id` - Removes context (disconnect)

**No additional WebUI changes needed!** The multi-printer implementation already provides bi-directional control.

## Logging Output Example

**Single Printer:**
```
[2025-10-02 10:15:00] [Headless] Starting FlashForgeUI in headless mode
[2025-10-02 10:15:00] [Headless] Connecting to 192.168.1.100...
[2025-10-02 10:15:03] [Headless] Connected to 1 printer(s)
[2025-10-02 10:15:03] [Headless]   - context-1-1733357937000: Adventurer 5M Pro @ 192.168.1.100
[2025-10-02 10:15:03] [Headless] Active context: context-1-1733357937000
[2025-10-02 10:15:04] [Headless] WebUI running at http://192.168.1.50:3000
[2025-10-02 10:15:04] [Headless] Headless mode ready!
```

**Multiple Printers:**
```
[2025-10-02 10:15:00] [Headless] Starting FlashForgeUI in headless mode
[2025-10-02 10:15:00] [Headless] Connecting to 3 printers...
[2025-10-02 10:15:03] [Headless] Connected to 3 printer(s)
[2025-10-02 10:15:03] [Headless]   - context-1-1733357937000: Adventurer 5M Pro @ 192.168.1.100
[2025-10-02 10:15:03] [Headless]   - context-2-1733357937001: Adventurer 5M @ 192.168.1.101
[2025-10-02 10:15:03] [Headless]   - context-3-1733357937002: Adventurer 3 @ 192.168.1.102
[2025-10-02 10:15:03] [Headless] Active context: context-1-1733357937000
[2025-10-02 10:15:04] [Headless] WebUI running at http://192.168.1.50:3000
[2025-10-02 10:15:04] [Headless] All contexts polling (active: 3s, inactive: 3s)
[2025-10-02 10:15:04] [Headless] Headless mode ready!
```

## Error Handling

**Single Printer:**
- Connection fails → Log error, exit with code 1

**Multiple Printers:**
- Some connections fail → Log errors, continue with successful connections
- All connections fail → Log error, exit with code 1
- Connection drops → Auto-reconnect (existing logic), keep WebUI running
- Context removed via WebUI → Remove context, adjust active context if needed

**Graceful Shutdown:**
- SIGINT/SIGTERM → Stop all polling, disconnect all contexts, stop WebUI, exit

## Implementation Checklist

**Core Implementation:**
- [ ] Create HeadlessArguments.ts - argument parser (support multi-printer)
- [ ] Create HeadlessDetection.ts - mode flag
- [ ] Create HeadlessLogger.ts - structured logging
- [ ] Create HeadlessManager.ts - orchestrator (multi-printer aware)
- [ ] Modify index.ts - add headless entry point
- [ ] Modify ConnectionFlowManager.ts - add connectDirectly()
- [ ] Modify notifications/index.ts - skip in headless

**Multi-Printer Integration:**
- [x] PrinterContextManager - already implemented
- [x] MultiContextPollingCoordinator - already implemented
- [x] WebUI API routes for context management - already implemented
- [ ] Verify HeadlessManager uses PrinterContextManager correctly
- [ ] Verify WebUI context switching works in headless mode

**Testing:**
- [ ] Test: single new printer connection
- [ ] Test: single legacy printer connection
- [ ] Test: multiple printer connections
- [ ] Test: WebUI context switching (bi-directional control)
- [ ] Test: WebUI can add/remove printers dynamically
- [ ] Test: graceful shutdown with multiple contexts
- [ ] Update README.md

## README.md Addition

```markdown
## Headless Mode

Run without UI for dedicated server use with full multi-printer support:

```bash
# Single new printer (5M series)
FlashForgeUI.exe --headless --printer-type=new --ip=192.168.1.100 --check-code=12345678

# Single legacy printer
FlashForgeUI.exe --headless --printer-type=legacy --ip=192.168.1.100

# Multiple printers
FlashForgeUI.exe --headless --printers="192.168.1.100:new:12345678,192.168.1.101:legacy"
```

**WebUI Control:**
- Access at http://[server-ip]:3000
- Switch between connected printers via WebUI
- Add/remove printers dynamically through web interface
- Full bi-directional control (WebUI can control active context)
- All printer operations work per-context

**Features in Headless Mode:**
- ✓ Multi-printer support
- ✓ Per-printer camera streaming
- ✓ Independent polling per printer
- ✓ WebSocket real-time updates with context IDs
- ✓ Graceful shutdown with SIGINT/SIGTERM
```

---

## Summary of Changes from Original Plan

**What Changed:**
1. Multi-printer context system is now the foundation
2. HeadlessManager works with PrinterContextManager instead of single backend
3. MultiContextPollingCoordinator replaces MainProcessPollingCoordinator
4. WebUI already has bi-directional control via `/api/contexts/*` routes
5. Camera proxy uses PortAllocator for multi-context support

**What Stayed the Same:**
- Headless detection and argument parsing approach
- Skip UI components (BrowserWindow, dialogs, notifications)
- WebUI as primary interface
- Graceful shutdown handling

**Key Insight:**
Multi-printer support implementation already solved most headless mode requirements. The WebUI API routes provide full bi-directional control, so headless mode just needs to leverage the existing multi-context infrastructure.
