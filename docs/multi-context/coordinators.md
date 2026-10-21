# Multi-Context: Coordinators and Lifecycle

The multi-printer system: one `PrinterContext` per connected printer, singleton
coordinators fanning services across all of them. Located in
`src/main/managers/PrinterContextManager.ts` + `src/main/services/MultiContext*`.

## Context lifecycle

```
User Connect → Connection → PrinterContextManager.createContext()
    ↓ emit('context-created')
PrinterBackendManager.initializeBackend()
    ↓ emit('backend-initialized')
Service cascade via ContextServiceInitializer (polling + monitors + notifications;
shared by GUI and headless paths)
```

Removal: `removeContext()` → `context-removed` → every coordinator stops polling,
disposes monitors, removes go2rtc streams, removes Spoolman trackers and Discord
timers. Missing cleanup = leaks.

## Coordinator pattern

```
MultiContextPollingCoordinator (singleton)
├── PrinterPollingService (context-1)
├── PrinterPollingService (context-2)
└── ...
```

Per-context service initialization order (dependencies matter):

1. `PrintStateMonitor` (foundation)
2. `TemperatureMonitoringService` (needs PrintStateMonitor)
3. `SpoolmanUsageTracker` (needs PrintStateMonitor)
4. `NotificationCoordinator` (needs both)

## `PrinterContext` shape (`src/shared/types/`)

`id` (`context-{counter}-{timestamp}`), `name`, `printerDetails`, `backend`,
`connectionState`, `pollingService`, `notificationCoordinator`, `isActive`,
`createdAt/lastActivity`, `activeSpoolId`, `activeSpoolData`.

Key operations: `createContext`, `removeContext`, `switchContext`, `getActiveContext`,
`updateContext`.

Events: `context-created`, `context-removed`, `context-switched`, `context-updated`
(consumed by all MultiContext* coordinators, `Go2rtcService` via camera-ipc-handler,
and the WebUI).

Renderer tabs (`PrinterTabsComponent`) drive the active context via IPC; the renderer
only ever receives the ACTIVE context's data — services receive all contexts'.
