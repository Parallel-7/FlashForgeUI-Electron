# Multi-Context Architecture

**Last Updated:** 2026-03-11

This document explains the multi-printer context system that enables simultaneous connections to multiple printers.

---

## Multi-Printer & Polling Flow

1. **Context creation**: `PrinterContextManager` issues IDs like `context-1-<timestamp>` whenever `ConnectionFlowManager` completes a connect path. Tabs in `PrinterTabsComponent` drive the active context via IPC.

2. **Backend wiring**: `PrinterBackendManager` instantiates the correct backend (Legacy, Adventurer5M, Adventurer5M Pro, AD5X) per context, exposes capability flags, and registers printer-specific helpers (material station ops, gcode routing, etc.).

3. **Polling cadence**: `MultiContextPollingCoordinator` spins up a `PrinterPollingService` per context. All contexts (active and inactive) poll every 3 seconds to prevent TCP keep-alive failures; cached data is pushed instantly on tab switch. `MainProcessPollingCoordinator` remains for legacy single-printer paths.

4. **Derived monitors**: `MultiContextPrintStateMonitor`, `MultiContextTemperatureMonitor`, `MultiContextSpoolmanTracker`, and `MultiContextNotificationCoordinator` listen for new/remove events to wire per-context instances (print monitors, cooling monitors, spool usage trackers, notification coordinators). Services expect untouched `polling-update` payloads.

5. **Integrations**: `Go2rtcService` provides unified camera streaming (WebRTC/MSE/MJPEG) via the bundled go2rtc binary, with `Go2rtcBinaryManager` handling binary lifecycle. Ports 1984 (API) and 8555 (WebRTC) are hardcoded, not allocated per context. Discord + desktop notifications, Spoolman usage updates, and eventual web push flows (`ai_specs/webui-push-notifications.md`) hang off the same events.

6. **Cleanup**: When `PrinterContextManager` emits `context-removed`, every coordinator disposes listeners, closes sockets/servers, removes go2rtc streams, and removes spoolman usage trackers/Discord timers to prevent leaks.

---

## Context Lifecycle

### Creation Flow

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

### Removal Flow

```
PrinterContextManager.removeContext()
    ↓
emit('context-removed')
    ↓
All Coordinators Cleanup:
  - Stop polling
  - Dispose monitors
  - Remove go2rtc streams
  - Remove trackers
  - Cleanup notifications
```

---

## Coordinator Pattern

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
6. **ContextServiceInitializer**: Initializes the polling, monitor, and notification coordinator stack together for a connected context (used by both GUI and headless paths)

---

## Polling Architecture

### Frequency Strategy

- **Active Context**: 3 seconds
- **Inactive Contexts**: 3 seconds (prevents TCP keep-alive failures - connections drop if not polled regularly)
- **Instant Switch**: Cached data emitted immediately on context switch

### Data Distribution

- **Renderer**: Only receives active context data
- **Services**: All coordinators receive all context data
- **Discord**: Updates all printer statuses
- **Notifications**: Work for all contexts

### Event Chain

```
PrinterPollingService → data-updated
    ↓
MultiContextPollingCoordinator → polling-data (contextId, data)
    ↓
├── Renderer (if active) → polling-update
├── Discord → updatePrinterStatus(contextId)
└── Services → monitoring, tracking, notifications
```

---

## Service Dependencies

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

## Context Structure

```typescript
interface PrinterContext {
  id: string;                    // "context-{counter}-{timestamp}"
  name: string;
  printerDetails: PrinterDetails;
  backend: BasePrinterBackend | null;
  connectionState: ContextConnectionState;
  pollingService: PrinterPollingService | null;
  notificationCoordinator: PrinterNotificationCoordinator | null;
  cameraProxyPort: number | null; // Legacy/unused with Go2rtcService
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  activeSpoolId: number | null;
  activeSpoolData: ActiveSpoolData | null;
}
```

---

## Core Operations

**PrinterContextManager**:
- `createContext(printerDetails)`: Create with unique ID
- `removeContext(contextId)`: Cleanup and remove
- `switchContext(contextId)`: Change active context
- `getActiveContext()`: Get current active
- `updateContext(contextId, updates)`: Partial updates

**Events**:
- `context-created`: { contextId, contextInfo }
- `context-removed`: { contextId, contextInfo }
- `context-switched`: { fromId, toId, contextInfo }
- `context-updated`: { contextId } - Emitted when printer details are updated (used by PrinterBackendManager, camera-ipc-handler)

**Event Consumers**:
- MultiContextPollingCoordinator
- MultiContextPrintStateMonitor
- MultiContextTemperatureMonitor
- MultiContextSpoolmanTracker
- MultiContextNotificationCoordinator
- Go2rtcService (via camera-ipc-handler)
- WebUI
