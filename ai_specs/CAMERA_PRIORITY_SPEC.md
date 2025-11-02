# Desktop Camera Priority Implementation Specification

**Created:** 2025-10-28
**Status:** Planning
**Goal:** Ensure desktop app maintains primary camera connection for active context, preventing WebUI from becoming "primary" and breaking other clients.

---

## Table of Contents
1. [Background & Problem Statement](#background--problem-statement)
2. [Design Principles](#design-principles)
3. [Current Architecture Analysis](#current-architecture-analysis)
4. [Proposed Solution](#proposed-solution)
5. [Implementation Details](#implementation-details)
6. [Testing Requirements](#testing-requirements)
7. [Success Criteria](#success-criteria)

---

## Background & Problem Statement

### Current Behavior (Lazy Streaming)

The camera proxy architecture implements **lazy streaming** where:
- Camera streams only start when a client connects
- Streams stop when the last client disconnects
- All clients (desktop, WebUI) are treated equally - no priority system

**Root Cause of Issue** (`src/services/CameraProxyService.ts:359-362`):
```typescript
if (streamInfo.activeClients.size === 0) {
  this.stopStreamingForContext(contextId, streamInfo);
}
```

### The Race Condition

**Problematic scenario**:
1. Desktop connects to printer → Camera proxy created (no stream yet)
2. Desktop enables preview → Stream starts (desktop is first client)
3. WebUI connects → Shares existing stream
4. Desktop disables preview → Desktop disconnects from `/stream` endpoint
5. **If WebUI also disconnects**: Stream stops completely
6. Desktop re-enables preview → Must reconnect camera (delay, possible failure)
7. WebUI alone → Must trigger new upstream connection

**Problem**: No client is guaranteed to be "primary" - whoever disconnects last stops the stream.

### Multi-Printer Context

From CLAUDE.md:
- Multiple printer connections supported via `PrinterContextManager`
- Each context has unique camera proxy server (ports 8181-8191)
- One context is "active" at any time for UI display
- **WebUI in desktop mode only shows active context** (see `src/index.ts:396-409`)

**Implication**: Only need ONE active camera stream at a time (the active context).

---

## Design Principles

### User Requirements (Confirmed)

1. **Single active stream**: Only active context maintains keep-alive (resource efficient)
2. **Preview toggle behavior**: Desktop maintains hidden priority connection even when preview OFF
3. **No grace period**: Immediate stop when no priority clients remain
4. **RTSP unchanged**: Leave RTSP streams as-is (already work correctly)
5. **Headless mode**: No desktop priority (WebUI controls streams naturally)

### Architecture Goals

- Desktop app is always "primary" connection source in non-headless mode
- WebUI clients fan out from desktop's proxy connection
- Only active printer context maintains camera stream
- Context switching transfers priority (old stops, new starts)
- Zero resource leaks or orphaned connections

---

## Current Architecture Analysis

### Camera Proxy Service Flow

**File**: `src/services/CameraProxyService.ts`

#### Context Management
- Each printer context gets unique Express HTTP server (ports 8181-8191)
- `contextStreams` Map stores `ContextStreamInfo` per context ID
- Port allocation via `PortAllocator` utility

#### Current Stream Lifecycle (Lazy)

**Creation** (lines 170-249):
```typescript
public async setStreamUrl(contextId: string, streamUrl: string): Promise<void> {
  // Creates Express server with /stream endpoint
  // Does NOT start upstream camera connection yet
}
```

**Start trigger** (lines 373-380):
```typescript
// Client connection triggers streaming
if (!streamInfo.isStreaming) {
  this.startStreamingForContext(contextId, streamInfo);
}
```

**Client tracking** (lines 341-371):
```typescript
private handleCameraRequest(contextId: string, req: express.Request, res: express.Response): void {
  const clientId = this.generateClientId(); // Random ID, no type tracking
  streamInfo.activeClients.set(clientId, { client, response: res });

  res.on('close', () => {
    streamInfo.activeClients.delete(clientId);
    if (streamInfo.activeClients.size === 0) {
      this.stopStreamingForContext(contextId, streamInfo); // PROBLEM: No priority check
    }
  });
}
```

**Stop trigger** (lines 358-362):
```typescript
if (streamInfo.activeClients.size === 0) {
  console.log(`No more clients for context ${contextId}, stopping stream`);
  this.stopStreamingForContext(contextId, streamInfo);
}
```

#### Missing Features

1. **No client type identification**: All clients anonymous (no desktop vs WebUI distinction)
2. **No priority system**: First-come-first-served, last-out stops stream
3. **No keep-alive mechanism**: Stream always stops when clients reach zero

### Connection Flow

**File**: `src/index.ts:377-393`

```typescript
backendManager.on('backend-initialized', (event: unknown) => {
  const backendEvent = event as { contextId: string; modelType: string };

  // Start polling
  multiContextPollingCoordinator.startPollingForContext(backendEvent.contextId);

  // Setup camera (creates proxy server, does NOT start stream)
  void cameraIPCHandler.handlePrinterConnected(backendEvent.contextId);
});
```

**Desktop vs Headless**: Both call same `handlePrinterConnected()` - no difference in camera initialization.

### Camera IPC Handlers

**File**: `src/ipc/camera-ipc-handler.ts`

#### Preview Toggle (lines 85-93)
```typescript
ipcMain.handle('camera:set-enabled', async (event, enabled: boolean): Promise<void> => {
  console.log(`Camera preview ${enabled ? 'enabled' : 'disabled'} by renderer`);

  // NOTE: We don't remove the camera proxy context here
  // The proxy stays running for the printer context until the printer disconnects
});
```

**Currently a NO-OP** - just logs, doesn't affect proxy state.

#### Printer Connected (lines 301-344)
```typescript
public async handlePrinterConnected(contextId: string): Promise<void> {
  const config = await this.getCurrentCameraConfigForContext(contextId);

  if (config && config.isAvailable && config.streamUrl) {
    if (config.streamType === 'rtsp') {
      await this.rtspStreamService.setupStream(contextId, config.streamUrl, {...});
    } else {
      // MJPEG: Use camera proxy service (creates server, no stream start)
      await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
    }
  }
}
```

### Headless Manager

**File**: `src/managers/HeadlessManager.ts:295-306`

```typescript
private async initializeCameraProxies(): Promise<void> {
  for (const contextId of this.connectedContexts) {
    try {
      await cameraIPCHandler.handlePrinterConnected(contextId);
      this.logger.logInfo(`Camera proxy initialized for context: ${contextId}`);
    } catch (error) {
      this.logger.logError(`Failed to initialize camera for context ${contextId}`, error);
    }
  }
}
```

**Same behavior as desktop**: Creates proxy servers, lazy streaming.

### WebUI Camera Consumption

**API Route**: `src/webui/server/api-routes.ts:1381-1419`

```typescript
router.get('/camera/proxy-config', async (req, res) => {
  const status = cameraProxyService.getStatusForContext(activeContext.id);

  // Lazily start the proxy if no status is registered for this context yet
  if (!status) {
    await cameraProxyService.setStreamUrl(activeContext.id, cameraConfig.streamUrl);
    status = cameraProxyService.getStatusForContext(activeContext.id);
  }

  // Return proxy URL
  return res.json({
    success: true,
    streamType: 'mjpeg',
    port: status.port,
    url: `http://${host}:${status.port}/stream`
  });
});
```

**Client**: `dist/webui/static/app.js:994-1052`
```javascript
async function loadCameraProxy() {
  const response = await fetch('/api/camera/proxy-config', {...});
  const config = await response.json();

  // MJPEG: Set img src to proxy URL
  cameraStream.src = config.url; // e.g., http://hostname:8181/stream
}
```

**Issue**: WebUI expects proxy to be ready, but doesn't guarantee upstream stream is running.

### RTSP Streams

**File**: `src/services/RtspStreamService.ts`

**Different behavior**:
- `setupStream()` immediately starts ffmpeg → WebSocket relay
- No client tracking (node-rtsp-stream library limitation)
- **Already "always-on" once created** - works as desired "primary" behavior

**Decision**: Leave RTSP unchanged (user confirmed "works fine afaik").

---

## Proposed Solution

### Keep-Alive Priority Client System

Add a **hidden priority client** that represents desktop's commitment to maintaining the camera stream:

1. **Desktop mode**: Active context gets priority client immediately after connection
2. **Priority client**: Counted in `activeClients` but has no actual HTTP response (hidden)
3. **Stream lifecycle**: Stream stays alive as long as priority client exists
4. **Context switching**: Priority transfers from old → new active context
5. **Headless mode**: No priority clients created (lazy behavior preserved)

### Behavioral Changes

#### Before (Current)
```
Desktop connects → Proxy created, NO stream
Desktop preview ON → Stream starts (first client)
WebUI connects → Shares stream
Desktop preview OFF → Disconnects
WebUI disconnects → Stream STOPS (last client)
Desktop preview ON → Must reconnect camera (delay)
```

#### After (With Keep-Alive)
```
Desktop connects → Proxy created + PRIORITY CLIENT + stream starts
Desktop preview ON → Adds visible client (2 clients total)
WebUI connects → Shares stream (3 clients total)
Desktop preview OFF → Removes visible client (2 clients: priority + WebUI)
WebUI disconnects → Stream ALIVE (1 client: priority)
Desktop preview ON → Instant (stream already running)
Stream stops ONLY when: printer disconnects OR context becomes inactive
```

#### Context Switching
```
Active: Context A (stream running)
User switches to Context B:
  1. Context A loses priority → stream A stops
  2. Context B gains priority → stream B starts
Result: Only ONE active stream at any time
```

---

## Implementation Details

### 1. Extend CameraProxyService Types

**File**: `src/services/CameraProxyService.ts`

#### Add to ContextStreamInfo Interface

```typescript
interface ContextStreamInfo {
  // ... existing fields ...

  keepaliveEnabled: boolean;           // Track if desktop priority active
  priorityClientId: string | null;     // ID of hidden desktop client
}
```

#### Add Client Type Enum

```typescript
enum ClientType {
  DESKTOP_PRIORITY = 'desktop-priority',  // Hidden keep-alive client
  DESKTOP_VISIBLE = 'desktop-visible',    // Actual preview when enabled
  WEBUI = 'webui',
  OTHER = 'other'
}
```

#### Modify CameraProxyClient Interface

```typescript
interface CameraProxyClient {
  id: string;
  clientType: ClientType;  // NEW: Identify client type
  connectedAt: Date;
  remoteAddress: string;
  isConnected: boolean;
}
```

#### Update ContextStreamInfo Initialization

```typescript
// In setStreamUrl() method, when creating new ContextStreamInfo:
const streamInfo: ContextStreamInfo = {
  // ... existing fields ...
  keepaliveEnabled: false,      // NEW
  priorityClientId: null        // NEW
};
```

---

### 2. Add Keep-Alive Management Methods

**File**: `src/services/CameraProxyService.ts`

#### Public API Method

```typescript
/**
 * Enable or disable keep-alive for a context.
 * When enabled, creates a hidden priority client to keep the stream alive.
 * When disabled, removes priority client and stops stream if no other clients.
 *
 * @param contextId - The context ID
 * @param enabled - Whether to enable keep-alive
 */
public setKeepalive(contextId: string, enabled: boolean): void {
  const streamInfo = this.contextStreams.get(contextId);
  if (!streamInfo) {
    console.log(`[CameraProxyService] Cannot set keepalive for unknown context: ${contextId}`);
    return;
  }

  if (enabled && !streamInfo.keepaliveEnabled) {
    // Enable: create priority client and start streaming
    console.log(`[CameraProxyService] Enabling keepalive for context: ${contextId}`);
    streamInfo.keepaliveEnabled = true;
    this.createPriorityClient(contextId, streamInfo);

    if (!streamInfo.isStreaming) {
      this.startStreamingForContext(contextId, streamInfo);
    }
  } else if (!enabled && streamInfo.keepaliveEnabled) {
    // Disable: remove priority client
    console.log(`[CameraProxyService] Disabling keepalive for context: ${contextId}`);
    streamInfo.keepaliveEnabled = false;
    this.removePriorityClient(contextId, streamInfo);
  }
}
```

#### Private Helper: Create Priority Client

```typescript
/**
 * Creates a hidden priority client for desktop keep-alive.
 * This client is added to activeClients without an HTTP response.
 *
 * @param contextId - The context ID
 * @param streamInfo - The stream info for this context
 */
private createPriorityClient(contextId: string, streamInfo: ContextStreamInfo): void {
  const clientId = `priority-${contextId}`;

  const client: CameraProxyClient = {
    id: clientId,
    clientType: ClientType.DESKTOP_PRIORITY,
    connectedAt: new Date(),
    remoteAddress: 'localhost',
    isConnected: true
  };

  // Add to activeClients WITHOUT response object (hidden client)
  streamInfo.activeClients.set(clientId, {
    client,
    response: null as any  // No actual HTTP response for priority client
  });

  streamInfo.priorityClientId = clientId;
  console.log(`[CameraProxyService] Created priority client for context: ${contextId}`);
}
```

#### Private Helper: Remove Priority Client

```typescript
/**
 * Removes the priority client from a context.
 * Triggers stream stop check if no other clients remain.
 *
 * @param contextId - The context ID
 * @param streamInfo - The stream info for this context
 */
private removePriorityClient(contextId: string, streamInfo: ContextStreamInfo): void {
  if (streamInfo.priorityClientId) {
    streamInfo.activeClients.delete(streamInfo.priorityClientId);
    streamInfo.priorityClientId = null;
    console.log(`[CameraProxyService] Removed priority client for context: ${contextId}`);

    // Check if should stop streaming (no clients left)
    if (streamInfo.activeClients.size === 0) {
      console.log(`[CameraProxyService] No clients remain, stopping stream for context: ${contextId}`);
      this.stopStreamingForContext(contextId, streamInfo);
    }
  }
}
```

#### Private Helper: Check Priority Client

```typescript
/**
 * Check if a context has a priority client.
 *
 * @param streamInfo - The stream info to check
 * @returns True if priority client exists and is active
 */
private hasPriorityClient(streamInfo: ContextStreamInfo): boolean {
  return streamInfo.keepaliveEnabled && streamInfo.priorityClientId !== null;
}
```

---

### 3. Modify Existing CameraProxyService Methods

**File**: `src/services/CameraProxyService.ts`

#### handleCameraRequest (lines 341-371)

**Add clientType parameter**:

```typescript
/**
 * Handle incoming camera stream requests from clients.
 *
 * @param contextId - The context ID
 * @param req - Express request object
 * @param res - Express response object
 * @param clientType - Type of client making the request (default: WEBUI)
 */
private handleCameraRequest(
  contextId: string,
  req: express.Request,
  res: express.Response,
  clientType: ClientType = ClientType.WEBUI  // NEW: Default for WebUI clients
): void {
  const streamInfo = this.contextStreams.get(contextId);
  if (!streamInfo) {
    res.status(404).send('Stream not found');
    return;
  }

  // Set headers
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'close'
  });

  const clientId = this.generateClientId();
  const client: CameraProxyClient = {
    id: clientId,
    clientType,  // NEW: Include client type
    connectedAt: new Date(),
    remoteAddress: req.socket.remoteAddress || 'unknown',
    isConnected: true
  };

  streamInfo.activeClients.set(clientId, { client, response: res });
  console.log(`[CameraProxyService] Client ${clientId} (${clientType}) connected to context ${contextId}. Total clients: ${streamInfo.activeClients.size}`);

  // Start streaming if not already started
  if (!streamInfo.isStreaming) {
    this.startStreamingForContext(contextId, streamInfo);
  }

  // Handle client disconnect
  res.on('close', () => {
    streamInfo.activeClients.delete(clientId);
    console.log(`[CameraProxyService] Client ${clientId} (${clientType}) disconnected from context ${contextId}. Remaining clients: ${streamInfo.activeClients.size}`);

    // Stop streaming if no more clients (unchanged - priority client prevents this)
    if (streamInfo.activeClients.size === 0) {
      console.log(`[CameraProxyService] No more clients for context ${contextId}, stopping stream`);
      this.stopStreamingForContext(contextId, streamInfo);
    }
  });
}
```

**Note**: The stop logic remains unchanged. Priority client being in `activeClients` prevents `size === 0`.

#### removeContext (lines 282-321)

**Disable keepalive before cleanup**:

```typescript
/**
 * Remove a context and clean up all associated resources.
 *
 * @param contextId - The context ID to remove
 */
public async removeContext(contextId: string): Promise<void> {
  const streamInfo = this.contextStreams.get(contextId);
  if (!streamInfo) {
    console.log(`[CameraProxyService] Context ${contextId} not found, nothing to remove`);
    return;
  }

  console.log(`[CameraProxyService] Removing context: ${contextId}`);

  // NEW: Disable keepalive FIRST to remove priority client cleanly
  this.setKeepalive(contextId, false);

  // Stop streaming
  this.stopStreamingForContext(contextId, streamInfo);

  // Close all client connections
  for (const [clientId, clientData] of streamInfo.activeClients) {
    if (clientData.response) {
      clientData.response.end();
    }
  }
  streamInfo.activeClients.clear();

  // Shutdown HTTP server
  if (streamInfo.server) {
    await new Promise<void>((resolve) => {
      streamInfo.server!.close(() => {
        console.log(`[CameraProxyService] HTTP server closed for context ${contextId}`);
        resolve();
      });
    });
  }

  // Release port
  if (streamInfo.port) {
    this.portAllocator.releasePort(streamInfo.port);
    console.log(`[CameraProxyService] Released port ${streamInfo.port} for context ${contextId}`);
  }

  // Remove from map
  this.contextStreams.delete(contextId);
  console.log(`[CameraProxyService] Context ${contextId} removed successfully`);
}
```

#### setStreamUrl (lines 170-249)

**Preserve keepalive across stream URL changes**:

```typescript
/**
 * Set the stream URL for a context. Creates or updates the proxy server.
 *
 * @param contextId - The context ID
 * @param streamUrl - The camera stream URL
 */
public async setStreamUrl(contextId: string, streamUrl: string): Promise<void> {
  console.log(`[CameraProxyService] Setting stream URL for context ${contextId}: ${streamUrl}`);

  // NEW: Remember if keepalive was enabled
  const existingStream = this.contextStreams.get(contextId);
  const wasKeepaliveEnabled = existingStream?.keepaliveEnabled || false;

  // Remove existing context if present
  if (existingStream) {
    await this.removeContext(contextId);
  }

  // Allocate port
  const port = this.portAllocator.allocatePort();
  if (!port) {
    throw new Error('No available ports for camera proxy');
  }

  // Create Express app
  const app = express();

  // Setup /stream endpoint
  app.get('/stream', (req, res) => {
    this.handleCameraRequest(contextId, req, res, ClientType.WEBUI);
  });

  // Start HTTP server
  const server = app.listen(port, () => {
    console.log(`[CameraProxyService] Camera proxy server started on port ${port} for context ${contextId}`);
  });

  // Create stream info
  const streamInfo: ContextStreamInfo = {
    contextId,
    streamUrl,
    port,
    server,
    app,
    isStreaming: false,
    activeClients: new Map(),
    retryCount: 0,
    lastError: null,
    keepaliveEnabled: false,      // NEW
    priorityClientId: null        // NEW
  };

  this.contextStreams.set(contextId, streamInfo);

  // NEW: Re-apply keepalive if it was enabled before
  if (wasKeepaliveEnabled) {
    console.log(`[CameraProxyService] Re-applying keepalive for context ${contextId} after stream URL change`);
    this.setKeepalive(contextId, true);
  }

  console.log(`[CameraProxyService] Stream URL set successfully for context ${contextId}`);
}
```

---

### 4. Desktop Active Context Keep-Alive

**File**: `src/index.ts`

#### Enable Keep-Alive on Connection (around line 392)

**Modify `backend-initialized` event handler**:

```typescript
backendManager.on('backend-initialized', (event: unknown) => {
  const backendEvent = event as { contextId: string; modelType: string };

  console.log(`[Main] Backend initialized for context: ${backendEvent.contextId}, model: ${backendEvent.modelType}`);

  // Start polling for this context
  multiContextPollingCoordinator.startPollingForContext(backendEvent.contextId);

  // Setup camera for this context
  void cameraIPCHandler.handlePrinterConnected(backendEvent.contextId);

  // NEW: DESKTOP ONLY - Enable keepalive for active context
  if (!isHeadlessMode()) {
    const contextManager = getPrinterContextManager();
    const activeContextId = contextManager.getActiveContextId();

    if (activeContextId === backendEvent.contextId) {
      console.log(`[Main] Enabling camera keepalive for active context: ${backendEvent.contextId}`);
      cameraProxyService.setKeepalive(backendEvent.contextId, true);
    } else {
      console.log(`[Main] Skipping keepalive for inactive context: ${backendEvent.contextId}`);
    }
  }
});
```

#### Handle Context Switching

**Add new event listener** (location: after other context manager event listeners):

```typescript
// NEW: Listen for active context changes to manage camera keepalive
const contextManager = getPrinterContextManager();
contextManager.on('active-context-changed', (event: { oldContextId: string | null; newContextId: string }) => {
  console.log(`[Main] Active context changed: ${event.oldContextId} -> ${event.newContextId}`);

  // Only manage keepalive in desktop mode
  if (!isHeadlessMode()) {
    // Disable keepalive for old context
    if (event.oldContextId) {
      console.log(`[Main] Disabling camera keepalive for old context: ${event.oldContextId}`);
      cameraProxyService.setKeepalive(event.oldContextId, false);
    }

    // Enable keepalive for new active context
    console.log(`[Main] Enabling camera keepalive for new context: ${event.newContextId}`);
    cameraProxyService.setKeepalive(event.newContextId, true);
  }
});
```

**Note**: Verify `PrinterContextManager` emits `active-context-changed` event. If not, this event needs to be added.

---

### 5. Handle "No Camera" Case

**File**: `src/ipc/camera-ipc-handler.ts`

**Modify `handlePrinterConnected()` method** (around line 301):

```typescript
/**
 * Handle printer connected event - setup camera for the context.
 *
 * @param contextId - The context ID of the connected printer
 */
public async handlePrinterConnected(contextId: string): Promise<void> {
  console.log(`[CameraIPCHandler] Setting up camera for context: ${contextId}`);

  const config = await this.getCurrentCameraConfigForContext(contextId);

  if (config && config.isAvailable && config.streamUrl) {
    console.log(`[CameraIPCHandler] Camera available for context ${contextId}: ${config.streamType}`);

    if (config.streamType === 'rtsp') {
      // Setup RTSP stream
      await this.rtspStreamService.setupStream(
        contextId,
        config.streamUrl,
        config.rtspTransport || 'tcp',
        config.rtspPort
      );
    } else {
      // Setup MJPEG proxy
      await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
    }
  } else {
    // NEW: No camera available - ensure keepalive is disabled
    console.log(`[CameraIPCHandler] No camera available for context ${contextId}, disabling keepalive`);
    this.cameraProxyService.setKeepalive(contextId, false);
  }
}
```

---

### 6. Files That Require NO Changes

#### Camera Preview Component
**File**: `src/ui/components/camera-preview/camera-preview.ts`

**Reason**:
- Existing context switch handler (lines 119-138) already disables/enables preview correctly
- Preview toggle handler is already a no-op (lines 85-93)
- Desktop visible clients connect/disconnect normally
- Priority client keeps stream alive independently

#### Headless Manager
**File**: `src/managers/HeadlessManager.ts`

**Reason**:
- All keep-alive logic wrapped in `!isHeadlessMode()` checks
- Headless continues calling `handlePrinterConnected()` which creates proxy servers
- No priority clients created in headless mode
- Lazy streaming behavior preserved

#### WebUI Backend
**File**: `src/webui/server/api-routes.ts`

**Reason**:
- `/api/camera/proxy-config` endpoint continues returning proxy URL
- Desktop priority client ensures stream already running when WebUI connects
- WebUI clients default to `ClientType.WEBUI` automatically

#### WebUI Frontend
**File**: `dist/webui/static/app.js`

**Reason**:
- Client-side code connects to proxy URL as usual
- No awareness needed of desktop priority system
- Stream "just works" because desktop maintains it

#### RTSP Stream Service
**File**: `src/services/RtspStreamService.ts`

**Reason**:
- User confirmed "works fine afaik"
- RTSP already behaves as "always-on" once started
- No client tracking needed
- Out of scope for this implementation

---

## Testing Requirements

### Manual Testing (Post-Implementation)

#### Test Suite 1: Single Printer (Active Context)

**Test 1.1: Basic Keep-Alive**
- [ ] Desktop connects to printer
- [ ] Verify camera stream starts immediately (check logs for priority client)
- [ ] Desktop preview toggle OFF
- [ ] Verify stream stays alive (priority client still present)
- [ ] Expected: Stream continues running, logs show priority client maintaining connection

**Test 1.2: WebUI with Preview Disabled**
- [ ] Desktop connected, preview OFF
- [ ] WebUI navigates to camera view
- [ ] Verify WebUI sees working camera stream immediately
- [ ] WebUI disconnects
- [ ] Verify stream stays alive (priority client remains)
- [ ] Expected: No delays, no reconnections, seamless experience

**Test 1.3: Disconnect Cleanup**
- [ ] Desktop connected with active camera stream
- [ ] Disconnect printer
- [ ] Verify stream stops cleanly
- [ ] Verify port released, no resource leaks
- [ ] Check logs for proper cleanup sequence
- [ ] Expected: Clean shutdown, no errors

#### Test Suite 2: Multiple Printers (Context Switching)

**Test 2.1: Multi-Printer Connection**
- [ ] Connect Printer A (becomes active)
- [ ] Verify stream A starts (priority client created)
- [ ] Connect Printer B (A remains active)
- [ ] Verify stream A still running, stream B NOT started
- [ ] Expected: Only active context streams

**Test 2.2: Context Switching**
- [ ] Both printers connected, Printer A active
- [ ] Switch to Printer B tab
- [ ] Verify stream A stops, stream B starts
- [ ] Check logs for keepalive transfer
- [ ] Switch back to Printer A
- [ ] Verify stream B stops, stream A starts
- [ ] Expected: Clean priority transfer, only ONE stream active at any time

**Test 2.3: Resource Efficiency**
- [ ] Connect 3 printers
- [ ] Switch between printer tabs rapidly
- [ ] Monitor system resources (bandwidth, CPU)
- [ ] Verify only ONE camera stream active throughout
- [ ] Expected: Resource usage equivalent to single camera stream

#### Test Suite 3: Edge Cases

**Test 3.1: Camera Config Changes**
- [ ] Desktop connected with active stream
- [ ] Change camera URL in printer settings
- [ ] Verify stream reconnects with new URL
- [ ] Verify priority client re-established
- [ ] Expected: Keep-alive survives configuration changes

**Test 3.2: Printer with No Camera**
- [ ] Connect printer without camera configured
- [ ] Verify no keepalive created
- [ ] Verify no errors or resource leaks
- [ ] Expected: Graceful handling of no-camera scenario

**Test 3.3: Rapid Context Switching**
- [ ] Connect 2 printers
- [ ] Rapidly switch between tabs (10+ times)
- [ ] Monitor for stuck streams or orphaned clients
- [ ] Verify clean state after switching stops
- [ ] Expected: No race conditions, no resource leaks

**Test 3.4: WebUI Reconnection**
- [ ] Desktop connected, preview OFF
- [ ] WebUI connects to camera
- [ ] Refresh WebUI page (disconnect/reconnect)
- [ ] Verify no interruption to stream
- [ ] Expected: Priority client keeps stream alive through WebUI reconnects

#### Test Suite 4: Headless Mode

**Test 4.1: Headless Startup**
- [ ] Start application in headless mode
- [ ] Connect to printer
- [ ] Verify NO priority client created (check logs)
- [ ] Expected: Lazy streaming behavior preserved

**Test 4.2: Headless WebUI Control**
- [ ] Headless mode with printer connected
- [ ] WebUI connects to camera
- [ ] Verify stream starts (WebUI triggers)
- [ ] WebUI disconnects
- [ ] Verify stream stops (lazy behavior)
- [ ] Expected: WebUI controls stream lifecycle in headless mode

**Test 4.3: Desktop Keepalive Logic Bypassed**
- [ ] Headless mode running
- [ ] Review logs during printer connection
- [ ] Verify no keepalive-related log messages
- [ ] Expected: Desktop-specific logic completely bypassed

#### Test Suite 5: Preview Toggle Behavior

**Test 5.1: Toggle While WebUI Connected**
- [ ] Desktop preview ON, WebUI connected
- [ ] Toggle preview OFF
- [ ] Verify WebUI stream unaffected
- [ ] Verify logs show priority + WebUI clients
- [ ] Toggle preview ON
- [ ] Verify seamless re-enable
- [ ] Expected: Preview toggle doesn't affect WebUI

**Test 5.2: Toggle Before WebUI Connects**
- [ ] Desktop preview OFF (priority client only)
- [ ] WebUI connects
- [ ] Verify instant camera view (no delay)
- [ ] Expected: Priority client ensures stream ready for WebUI

### Automated Testing (Future)

**Unit Tests** (recommended, not in initial scope):
- `CameraProxyService.setKeepalive()` behavior
- `createPriorityClient()` / `removePriorityClient()` logic
- `hasPriorityClient()` checks
- Context switching priority transfer

**Integration Tests** (recommended, not in initial scope):
- End-to-end desktop connection → keepalive → WebUI flow
- Multi-context switching with camera streams
- Headless mode vs desktop mode behavior differences

---

## Success Criteria

### Functional Requirements

✅ **Desktop Priority Established**
- Desktop app maintains primary camera connection for active context
- Priority client created immediately after printer connection (desktop mode)
- Stream starts automatically without manual preview enable

✅ **WebUI Fan-Out Working**
- WebUI clients always connect to desktop's upstream stream
- No scenarios where WebUI becomes "primary" connection
- WebUI works correctly whether desktop preview ON or OFF

✅ **Resource Efficiency**
- Only ONE camera stream active at any time (active context only)
- Inactive contexts have NO camera streams running
- Context switching cleanly transfers priority (old stops, new starts)

✅ **Headless Mode Preserved**
- No desktop priority logic active in headless mode
- WebUI controls stream lifecycle naturally (lazy streaming)
- No behavioral regressions in headless deployments

✅ **RTSP Unchanged**
- RTSP streams continue working as before
- No modifications to RTSP handling code
- RTSP already behaves correctly (always-on once started)

✅ **Preview Toggle Correct**
- Desktop preview toggle doesn't stop camera stream
- Priority client maintains connection when preview OFF
- WebUI unaffected by desktop preview state

✅ **Context Switching Smooth**
- Switching printer tabs transfers priority cleanly
- Old context stream stops, new context stream starts
- Existing smooth transition logic preserved

### Non-Functional Requirements

✅ **No Resource Leaks**
- All contexts cleaned up properly on disconnect
- Ports released, HTTP servers closed
- Priority clients removed during cleanup

✅ **Proper Error Handling**
- No-camera scenario handled gracefully
- Configuration changes preserve keepalive
- Stream errors don't orphan priority clients

✅ **Clear Logging**
- Keepalive enable/disable events logged
- Priority client creation/removal logged
- Context switching keepalive transfer logged

✅ **Code Maintainability**
- Clear separation between desktop and headless logic
- Type-safe client type tracking
- Well-documented methods and behavior

---

## Rollback Plan

If issues are discovered post-implementation:

### Immediate Rollback (Critical Issues)

**Symptoms**:
- Camera streams not stopping (resource leak)
- Headless mode broken
- Multiple streams running simultaneously

**Action**:
1. Revert changes to `CameraProxyService.ts`
2. Revert changes to `src/index.ts` event handlers
3. Revert changes to `camera-ipc-handler.ts`
4. Test that lazy streaming behavior is restored

### Partial Rollback (Desktop Issues Only)

**Symptoms**:
- Desktop preview broken
- Context switching problems
- Keep-alive not working as expected

**Action**:
1. Disable keepalive initialization in `src/index.ts` (`setKeepalive` calls)
2. Keep type system changes (harmless)
3. Keep methods in `CameraProxyService.ts` (unused but safe)
4. System reverts to lazy streaming for desktop

### Debug Mode

If issues are unclear, add debug flag:

```typescript
// In src/index.ts
const ENABLE_CAMERA_KEEPALIVE = false; // Set to false to disable feature

if (!isHeadlessMode() && ENABLE_CAMERA_KEEPALIVE) {
  cameraProxyService.setKeepalive(backendEvent.contextId, true);
}
```

Allows easy feature toggle without code changes.

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Add `keepaliveEnabled` and `priorityClientId` to `ContextStreamInfo`
- [ ] Add `ClientType` enum
- [ ] Add `clientType` to `CameraProxyClient` interface
- [ ] Implement `setKeepalive()` public method
- [ ] Implement `createPriorityClient()` private method
- [ ] Implement `removePriorityClient()` private method
- [ ] Implement `hasPriorityClient()` private method

### Phase 2: Modify Existing Methods
- [ ] Update `handleCameraRequest()` to accept `clientType` parameter
- [ ] Update `removeContext()` to disable keepalive first
- [ ] Update `setStreamUrl()` to preserve keepalive across changes
- [ ] Update `ContextStreamInfo` initialization in `setStreamUrl()`

### Phase 3: Desktop Integration
- [ ] Add keepalive enable in `backend-initialized` event handler
- [ ] Add `active-context-changed` event listener for keepalive transfer
- [ ] Verify `PrinterContextManager` emits required events (or add them)
- [ ] Update `handlePrinterConnected()` to handle no-camera case

### Phase 4: Testing
- [ ] Run type checking (`npm run type-check`)
- [ ] Run linting (`npm run lint`)
- [ ] Manual Test Suite 1 (Single Printer)
- [ ] Manual Test Suite 2 (Multiple Printers)
- [ ] Manual Test Suite 3 (Edge Cases)
- [ ] Manual Test Suite 4 (Headless Mode)
- [ ] Manual Test Suite 5 (Preview Toggle)

### Phase 5: Documentation
- [ ] Add comments to new methods
- [ ] Update ARCHITECTURE.md if needed
- [ ] Add implementation notes to CLAUDE.md
- [ ] Document any discovered edge cases

---

## Open Questions / Decisions Needed

### 1. Active Context Changed Event

**Question**: Does `PrinterContextManager` emit an `active-context-changed` event?

**Investigation needed**:
- Check `src/managers/PrinterContextManager.ts` for existing events
- If not present, need to add event emission when `setActiveContext()` is called

**Impact**: Required for context switching keepalive transfer

---

### 2. Priority Client HTTP Response

**Question**: Should priority client have a null response or a mock response object?

**Current approach**: `response: null as any`

**Consideration**:
- Null response means priority client won't receive data chunks
- Mock response could avoid `null` checks in streaming code
- Current streaming code checks `if (clientData.response)` before writing

**Decision**: Keep `null` - streaming code already has safety checks

---

### 3. Logging Verbosity

**Question**: Should keepalive operations be logged at `console.log` level or use a dedicated logger?

**Current approach**: `console.log` for consistency with existing `CameraProxyService` logging

**Consideration**:
- Existing service uses `console.log` throughout
- May want structured logging in future
- Keep consistent for now, refactor later if needed

**Decision**: Use `console.log` for consistency

---

### 4. Keepalive Re-Application Timing

**Question**: When camera config changes (new URL), should keepalive wait for new stream to be ready?

**Current approach**: Immediately call `setKeepalive(contextId, true)` after `setStreamUrl()`

**Consideration**:
- `setStreamUrl()` creates proxy server synchronously
- Priority client triggers `startStreamingForContext()`
- If camera unavailable, connection will retry automatically
- Early keepalive enable is safe

**Decision**: Immediate re-application is correct

---

## Timeline Estimate

**Preparation**: 30 minutes
- Review current code paths
- Verify event emission points
- Confirm headless detection logic

**Implementation**: 2-3 hours
- Phase 1: 45 minutes (core infrastructure)
- Phase 2: 30 minutes (modify existing methods)
- Phase 3: 45 minutes (desktop integration + event handling)
- Phase 4: 30 minutes (static analysis, type checking)

**Testing**: 1-2 hours
- Manual test suites execution
- Edge case validation
- Headless mode verification

**Documentation**: 30 minutes
- Code comments
- Update project docs

**Total**: 4-6 hours

---

## References

### Key Files
- `src/services/CameraProxyService.ts` - Core camera proxy implementation
- `src/index.ts` - Main process, event handling
- `src/ipc/camera-ipc-handler.ts` - Camera IPC handlers
- `src/managers/PrinterContextManager.ts` - Context management
- `src/managers/HeadlessManager.ts` - Headless mode logic
- `src/webui/server/api-routes.ts` - WebUI API endpoints
- `ARCHITECTURE.md` - System architecture documentation
- `CLAUDE.md` - Development guidance

### Related Concepts
- Multi-printer context architecture
- Active vs inactive contexts
- Lazy vs eager streaming
- Client tracking and lifecycle
- Port allocation (8181-8191 range)

---

**End of Specification**
