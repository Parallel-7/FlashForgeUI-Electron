# Implement PrintStateMonitor for Centralized State Detection

**Date:** 2025-01-06
**Status:** Ready for Implementation
**Estimated Complexity:** High (10 files, comprehensive refactor)

---

## Table of Contents

1. [Problem Summary](#problem-summary)
2. [Architectural Analysis](#architectural-analysis)
3. [Solution Overview](#solution-overview)
4. [Phase 1: Create Core Services](#phase-1-create-core-services)
5. [Phase 2: Migrate Core Services](#phase-2-migrate-core-services)
6. [Phase 3: Update Multi-Context Coordinators](#phase-3-update-multi-context-coordinators)
7. [Phase 4: Update Initialization Wiring](#phase-4-update-initialization-wiring)
8. [Phase 5: Verification & Testing](#phase-5-verification--testing)
9. [Phase 6: Documentation](#phase-6-documentation)
10. [Multi-Context Safety Guarantees](#multi-context-safety-guarantees)
11. [Files Modified Summary](#files-modified-summary)

---

## Problem Summary

### Current Issues

1. **Spoolman deduction happens too late**
   - Currently triggers on "printer-cooled" event (after bed cools)
   - Should trigger immediately when print state becomes "Completed"
   - User waits 10+ minutes for bed to cool before seeing Spoolman deduction

2. **Duplicate state detection logic**
   - PrinterNotificationCoordinator manually tracks state changes
   - TemperatureMonitoringService manually tracks state changes
   - Both listen directly to PrinterPollingService
   - Duplicate previousState tracking in multiple places

3. **Tight coupling to polling service**
   - Multiple services listen to raw polling updates
   - State transition logic scattered across codebase
   - Hard to add new state-driven features

### Desired Outcome

1. ✅ Centralized state change detection in one service
2. ✅ Spoolman deduction happens immediately on print completion
3. ✅ Cleaner architecture with single responsibility
4. ✅ Easier to add new state-driven features
5. ✅ Perfect multi-context isolation maintained
6. ✅ No duplicate state-tracking logic

---

## Architectural Analysis

### Current Architecture Philosophy

The codebase follows a **layered event-driven architecture**:

1. **Data Sources** (Polling Services) - Emit raw state changes
2. **Monitors** (Temperature, etc.) - Transform raw data into domain-specific events
3. **Coordinators** (Notification, Spoolman) - React to domain events and orchestrate business logic
4. **Multi-Context Managers** - Manage lifecycle of per-context instances

**Key Design Principle:** "Monitors Observe, Coordinators Act"

**Monitors:**
- Listen to raw polling data
- Detect domain-specific conditions
- Emit domain events
- Do NOT take actions (only observe and notify)

**Coordinators:**
- Listen to domain events from monitors
- Apply business logic
- Take actions based on configuration and state

### Current State Detection Locations

**Services that directly listen to polling:**
1. `PrinterNotificationCoordinator.ts` - Detects state changes, sends notifications
2. `TemperatureMonitoringService.ts` - Detects state changes, monitors temperature

**Services that depend on monitors:**
3. `SpoolmanUsageTracker.ts` - Listens to TemperatureMonitor's "printer-cooled" event

**UI Components (presentation only):**
- `renderer.ts` - Uses PrinterStateTracker abstraction
- Camera/Job Info components - Visual styling only

### Why This Architecture Is Excellent

**High Cohesion:**
- Each service has single, well-defined responsibility
- TemperatureMonitor only monitors temperature
- SpoolmanTracker only tracks Spoolman usage

**Low Coupling:**
- Services communicate via events, not direct method calls
- Can add new coordinators without modifying existing ones
- Can test services in isolation

**Multi-Context First:**
- Per-context instances for stateful services
- Multi-context coordinators manage lifecycle
- No shared state between contexts

---

## Solution Overview

### Create PrintStateMonitor

A new monitor service that:
- Centralizes all printer state change detection
- Emits typed domain events for state transitions
- Follows exact same pattern as TemperatureMonitoringService
- Maintains perfect per-context isolation
- Eliminates duplicate state-tracking logic

### Migration Strategy

1. Create PrintStateMonitor following existing patterns
2. Migrate TemperatureMonitoringService to use it
3. Migrate PrinterNotificationCoordinator to use it
4. Migrate SpoolmanUsageTracker to use it
5. Update initialization wiring in index.ts
6. Verify multi-context isolation maintained

### Benefits

- **Cleaner architecture** - Single source of truth for state
- **Easier extensibility** - New features just subscribe to events
- **Better testability** - State logic isolated and testable
- **Immediate Spoolman deduction** - Triggers on "Completed" not "cooled"
- **No breaking changes** - All existing functionality preserved
- **Multi-context safe** - Per-context instances prevent interference

---

## Phase 1: Create Core Services

### 1.1 Create PrintStateMonitor.ts

**File:** `src/services/PrintStateMonitor.ts`

**Architecture Pattern:** Exact mirror of TemperatureMonitoringService

#### Class Structure

```typescript
/**
 * @fileoverview Print state monitoring service for tracking printer state transitions.
 *
 * This service provides centralized state change detection that can be used by multiple
 * systems (notifications, Spoolman tracking, temperature monitoring, etc.) without
 * coupling them to the polling service or duplicating state-tracking logic.
 *
 * Key Features:
 * - Per-context state monitoring with centralized detection
 * - State transition tracking (previousState → currentState)
 * - Event emissions for all state changes
 * - Specialized events for print lifecycle (started, completed, cancelled, error)
 * - Integration with PrinterPollingService for real-time status data
 * - Multi-context safe (per-instance tracking)
 *
 * Core Responsibilities:
 * - Monitor printer status updates from polling service
 * - Detect state transitions and emit generic 'state-changed' events
 * - Detect print lifecycle events and emit specialized events
 * - Track current job name for print lifecycle detection
 * - Provide current state access for consumers
 *
 * @exports PrintStateMonitor - Main state monitoring class
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { PrinterPollingService } from './PrinterPollingService';
import type { PrinterStatus, PollingData } from '../types/polling';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event map for PrintStateMonitor
 */
interface PrintStateEventMap extends Record<string, unknown[]> {
  /**
   * Emitted on any state change
   */
  'state-changed': [{
    contextId: string;
    previousState: string;
    currentState: string;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job starts (transition TO Busy/Printing/Heating)
   */
  'print-started': [{
    contextId: string;
    jobName: string;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job completes successfully
   */
  'print-completed': [{
    contextId: string;
    jobName: string;
    status: PrinterStatus;
    completedAt: Date;
  }];

  /**
   * Emitted when a print job is cancelled
   */
  'print-cancelled': [{
    contextId: string;
    jobName: string | null;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job encounters an error
   */
  'print-error': [{
    contextId: string;
    jobName: string | null;
    status: PrinterStatus;
    timestamp: Date;
  }];
}

/**
 * Print state monitoring state for a context
 */
interface PrintStateMonitorState {
  currentState: string | null;
  previousState: string | null;
  currentJobName: string | null;
  lastStateChangeTime: Date | null;
}

// ============================================================================
// PRINT STATE MONITOR SERVICE
// ============================================================================

/**
 * Service for monitoring printer state transitions and emitting domain events
 */
export class PrintStateMonitor extends EventEmitter<PrintStateEventMap> {
  private readonly contextId: string;
  private pollingService: PrinterPollingService | null = null;

  private state: PrintStateMonitorState = {
    currentState: null,
    previousState: null,
    currentJobName: null,
    lastStateChangeTime: null
  };

  constructor(contextId: string) {
    super();
    this.contextId = contextId;
    console.log(`[PrintStateMonitor] Created for context ${contextId}`);
  }

  // ============================================================================
  // POLLING SERVICE INTEGRATION
  // ============================================================================

  /**
   * Set the printer polling service to monitor
   */
  public setPollingService(pollingService: PrinterPollingService): void {
    // Remove listeners from old service
    if (this.pollingService) {
      this.removePollingServiceListeners();
    }

    this.pollingService = pollingService;
    this.setupPollingServiceListeners();

    console.log(`[PrintStateMonitor] Polling service connected for context ${this.contextId}`);
  }

  /**
   * Setup polling service event listeners
   */
  private setupPollingServiceListeners(): void {
    if (!this.pollingService) return;

    // Listen for data updates
    this.pollingService.on('data-updated', (data: PollingData) => {
      void this.handlePollingDataUpdate(data);
    });

    // Listen for status updates
    this.pollingService.on('status-updated', (status: PrinterStatus) => {
      void this.handlePrinterStatusUpdate(status);
    });
  }

  /**
   * Remove polling service event listeners
   */
  private removePollingServiceListeners(): void {
    if (!this.pollingService) return;

    this.pollingService.removeAllListeners('data-updated');
    this.pollingService.removeAllListeners('status-updated');
  }

  // ============================================================================
  // STATUS HANDLING
  // ============================================================================

  /**
   * Handle polling data update
   */
  private async handlePollingDataUpdate(data: PollingData): Promise<void> {
    if (data.printerStatus) {
      await this.handlePrinterStatusUpdate(data.printerStatus);
    }
  }

  /**
   * Handle printer status update
   */
  private async handlePrinterStatusUpdate(status: PrinterStatus): Promise<void> {
    const previousState = this.state.currentState;
    const currentState = status.state;

    // Update current state
    this.state.currentState = currentState;

    // Update job name tracking
    const currentJobName = status.currentJob?.name || null;
    this.state.currentJobName = currentJobName;

    // Check for state transitions
    if (previousState !== currentState && previousState !== null) {
      await this.handleStateTransition(previousState, currentState, status);
    }

    // Update previous state for next iteration
    this.state.previousState = currentState;
  }

  /**
   * Handle state transition
   */
  private async handleStateTransition(
    previousState: string,
    currentState: string,
    status: PrinterStatus
  ): Promise<void> {
    const timestamp = new Date();
    this.state.lastStateChangeTime = timestamp;

    console.log(`[PrintStateMonitor] State change for ${this.contextId}: ${previousState} → ${currentState}`);

    // Emit generic state-changed event
    this.emit('state-changed', {
      contextId: this.contextId,
      previousState,
      currentState,
      status,
      timestamp
    });

    // Emit specialized lifecycle events
    await this.detectPrintLifecycleEvents(previousState, currentState, status, timestamp);
  }

  /**
   * Detect and emit print lifecycle events
   */
  private async detectPrintLifecycleEvents(
    previousState: string,
    currentState: string,
    status: PrinterStatus,
    timestamp: Date
  ): Promise<void> {
    // Print started: Transition TO an active printing state
    if (this.isActivePrintingState(currentState) && !this.isActivePrintingState(previousState)) {
      if (this.state.currentJobName) {
        this.emit('print-started', {
          contextId: this.contextId,
          jobName: this.state.currentJobName,
          status,
          timestamp
        });
        console.log(`[PrintStateMonitor] Print started: ${this.state.currentJobName}`);
      }
    }

    // Print completed: Transition TO "Completed" state
    if (currentState === 'Completed' && previousState !== 'Completed') {
      const jobName = this.state.currentJobName || 'Unknown';
      this.emit('print-completed', {
        contextId: this.contextId,
        jobName,
        status,
        completedAt: timestamp
      });
      console.log(`[PrintStateMonitor] Print completed: ${jobName}`);
    }

    // Print cancelled: Transition TO "Cancelled" state
    if (currentState === 'Cancelled' && previousState !== 'Cancelled') {
      this.emit('print-cancelled', {
        contextId: this.contextId,
        jobName: this.state.currentJobName,
        status,
        timestamp
      });
      console.log(`[PrintStateMonitor] Print cancelled: ${this.state.currentJobName || 'Unknown'}`);
    }

    // Print error: Transition TO "Error" state
    if (currentState === 'Error' && previousState !== 'Error') {
      this.emit('print-error', {
        contextId: this.contextId,
        jobName: this.state.currentJobName,
        status,
        timestamp
      });
      console.log(`[PrintStateMonitor] Print error: ${this.state.currentJobName || 'Unknown'}`);
    }
  }

  /**
   * Check if state represents active printing
   */
  private isActivePrintingState(state: string): boolean {
    return state === 'Busy' ||
           state === 'Printing' ||
           state === 'Heating' ||
           state === 'Calibrating' ||
           state === 'Paused' ||
           state === 'Pausing';
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

  /**
   * Get current state
   */
  public getCurrentState(): string | null {
    return this.state.currentState;
  }

  /**
   * Get current job name
   */
  public getCurrentJobName(): string | null {
    return this.state.currentJobName;
  }

  /**
   * Get context ID
   */
  public getContextId(): string {
    return this.contextId;
  }

  /**
   * Get full state snapshot
   */
  public getState(): Readonly<PrintStateMonitorState> {
    return { ...this.state };
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Dispose of the service and clean up resources
   */
  public dispose(): void {
    console.log(`[PrintStateMonitor] Disposing for context ${this.contextId}`);

    this.removePollingServiceListeners();
    this.removeAllListeners();

    this.pollingService = null;
    this.state = {
      currentState: null,
      previousState: null,
      currentJobName: null,
      lastStateChangeTime: null
    };
  }
}
```

---

### 1.2 Create MultiContextPrintStateMonitor.ts

**File:** `src/services/MultiContextPrintStateMonitor.ts`

**Architecture Pattern:** Exact mirror of MultiContextTemperatureMonitor

```typescript
/**
 * @fileoverview Multi-context coordinator for print state monitoring services.
 *
 * Manages PrintStateMonitor instances across multiple printer contexts, ensuring
 * each printer connection has its own isolated state monitoring instance.
 *
 * Key Responsibilities:
 * - Create PrintStateMonitor instances for new printer contexts
 * - Destroy monitors when contexts are removed
 * - Provide access to monitors by context ID
 * - Maintain lifecycle and cleanup for all monitors
 *
 * @exports MultiContextPrintStateMonitor - Multi-context state monitor coordinator
 */

import { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterPollingService } from './PrinterPollingService';

/**
 * Multi-context coordinator for print state monitoring
 * Manages per-context PrintStateMonitor instances
 */
export class MultiContextPrintStateMonitor {
  private monitors: Map<string, PrintStateMonitor> = new Map();

  /**
   * Create a print state monitor for a specific context
   */
  public createMonitorForContext(
    contextId: string,
    pollingService: PrinterPollingService
  ): void {
    // Check if monitor already exists
    if (this.monitors.has(contextId)) {
      console.warn(`[MultiContextPrintStateMonitor] Monitor already exists for context ${contextId}`);
      return;
    }

    // Create new monitor
    const monitor = new PrintStateMonitor(contextId);
    monitor.setPollingService(pollingService);

    // Store monitor
    this.monitors.set(contextId, monitor);

    console.log(`[MultiContextPrintStateMonitor] Created monitor for context ${contextId}`);
  }

  /**
   * Get print state monitor for a specific context
   */
  public getMonitor(contextId: string): PrintStateMonitor | undefined {
    return this.monitors.get(contextId);
  }

  /**
   * Check if monitor exists for context
   */
  public hasMonitor(contextId: string): boolean {
    return this.monitors.has(contextId);
  }

  /**
   * Destroy monitor for a specific context
   */
  public destroyMonitor(contextId: string): void {
    const monitor = this.monitors.get(contextId);

    if (monitor) {
      monitor.dispose();
      this.monitors.delete(contextId);
      console.log(`[MultiContextPrintStateMonitor] Destroyed monitor for context ${contextId}`);
    }
  }

  /**
   * Get all monitors (for debugging/testing)
   */
  public getAllMonitors(): Map<string, PrintStateMonitor> {
    return new Map(this.monitors);
  }

  /**
   * Get count of active monitors
   */
  public getMonitorCount(): number {
    return this.monitors.size;
  }

  /**
   * Dispose all monitors
   */
  public dispose(): void {
    console.log('[MultiContextPrintStateMonitor] Disposing all monitors');

    for (const [contextId, monitor] of this.monitors) {
      monitor.dispose();
      console.log(`[MultiContextPrintStateMonitor] Disposed monitor for context ${contextId}`);
    }

    this.monitors.clear();
  }
}

// Singleton instance
let instance: MultiContextPrintStateMonitor | null = null;

/**
 * Get singleton instance of MultiContextPrintStateMonitor
 */
export function getMultiContextPrintStateMonitor(): MultiContextPrintStateMonitor {
  if (!instance) {
    instance = new MultiContextPrintStateMonitor();
  }
  return instance;
}
```

---

### 1.3 Export from index

**File:** `src/services/index.ts`

Add exports:

```typescript
export { PrintStateMonitor } from './PrintStateMonitor';
export { MultiContextPrintStateMonitor, getMultiContextPrintStateMonitor } from './MultiContextPrintStateMonitor';
```

---

## Phase 2: Migrate Core Services

### 2.1 Migrate TemperatureMonitoringService

**File:** `src/services/TemperatureMonitoringService.ts`

#### Changes Required

**1. Remove direct polling service listeners** (lines 144-156)

Remove the entire `setupPollingServiceListeners()` method that listens to 'data-updated' and 'status-updated'.

**2. Add PrintStateMonitor dependency**

Add after line 102:

```typescript
private printStateMonitor: PrintStateMonitor | null = null;
```

**3. Add setPrintStateMonitor method**

Add after `setPollingService()`:

```typescript
/**
 * Set the print state monitor to listen to
 */
public setPrintStateMonitor(monitor: PrintStateMonitor): void {
  // Remove listeners from old monitor
  if (this.printStateMonitor) {
    this.removePrintStateMonitorListeners();
  }

  this.printStateMonitor = monitor;
  this.setupPrintStateMonitorListeners();

  console.log(`[TemperatureMonitor] Print state monitor connected for context ${this.contextId}`);
}
```

**4. Add state monitor listener setup**

```typescript
/**
 * Setup print state monitor event listeners
 */
private setupPrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  // Start monitoring when print completes
  this.printStateMonitor.on('print-completed', (event) => {
    if (event.contextId === this.contextId) {
      console.log(`[TemperatureMonitor] Print completed, starting temperature monitoring`);
      this.startMonitoring();
    }
  });

  // Reset state when print starts
  this.printStateMonitor.on('print-started', (event) => {
    if (event.contextId === this.contextId) {
      console.log(`[TemperatureMonitor] Print started, resetting state`);
      this.resetState();
    }
  });

  // Reset state when print cancelled
  this.printStateMonitor.on('print-cancelled', (event) => {
    if (event.contextId === this.contextId) {
      console.log(`[TemperatureMonitor] Print cancelled, resetting state`);
      this.resetState();
    }
  });

  // Reset state when print error
  this.printStateMonitor.on('print-error', (event) => {
    if (event.contextId === this.contextId) {
      console.log(`[TemperatureMonitor] Print error, resetting state`);
      this.resetState();
    }
  });
}

/**
 * Remove print state monitor event listeners
 */
private removePrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  this.printStateMonitor.removeAllListeners('print-completed');
  this.printStateMonitor.removeAllListeners('print-started');
  this.printStateMonitor.removeAllListeners('print-cancelled');
  this.printStateMonitor.removeAllListeners('print-error');
}
```

**5. Remove state change detection logic**

Remove `handlePrinterStateChange()` method entirely (lines 199-219).

The state change detection is now handled by PrintStateMonitor.

**6. Simplify handlePrinterStatusUpdate**

Update to only handle temperature checks:

```typescript
/**
 * Handle printer status update
 */
private async handlePrinterStatusUpdate(status: PrinterStatus): Promise<void> {
  this.lastPrinterStatus = status;

  // Update temperature monitoring if active
  if (this.state.monitoringActive) {
    await this.checkTemperature(status);
  }
}
```

**7. Keep polling service for temperature data**

Keep `setPollingService()` and listeners, but ONLY for reading temperature values during monitoring. Don't use it for state detection.

**8. Update dispose()**

```typescript
public dispose(): void {
  console.log(`[TemperatureMonitor] Disposing for context ${this.contextId}`);

  this.stopMonitoring();
  this.removePollingServiceListeners();
  this.removePrintStateMonitorListeners();
  this.removeAllListeners();

  this.pollingService = null;
  this.printStateMonitor = null;
  this.lastPrinterStatus = null;
}
```

**9. Update file header documentation**

Update the @fileoverview to mention dependency on PrintStateMonitor for state transitions.

---

### 2.2 Migrate PrinterNotificationCoordinator

**File:** `src/services/notifications/PrinterNotificationCoordinator.ts`

#### Changes Required

**1. Add PrintStateMonitor dependency**

Add to class properties:

```typescript
private printStateMonitor: PrintStateMonitor | null = null;
```

**2. Add setPrintStateMonitor method**

```typescript
/**
 * Set the print state monitor to listen to
 */
public setPrintStateMonitor(monitor: PrintStateMonitor): void {
  // Remove listeners from old monitor
  if (this.printStateMonitor) {
    this.removePrintStateMonitorListeners();
  }

  this.printStateMonitor = monitor;
  this.setupPrintStateMonitorListeners();

  console.log(`[NotificationCoordinator] Print state monitor connected for context ${this.contextId}`);
}
```

**3. Add state monitor listener setup**

```typescript
/**
 * Setup print state monitor event listeners
 */
private setupPrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  // Listen for print started to reset notification flags
  this.printStateMonitor.on('print-started', (event) => {
    if (event.contextId === this.contextId) {
      void this.handlePrintStarted(event);
    }
  });

  // Listen for print completed to send notification
  this.printStateMonitor.on('print-completed', (event) => {
    if (event.contextId === this.contextId) {
      void this.handlePrintCompleted(event);
    }
  });

  // Listen for print cancelled to send notification
  this.printStateMonitor.on('print-cancelled', (event) => {
    if (event.contextId === this.contextId) {
      void this.handlePrintCancelled(event);
    }
  });

  // Listen for print error to send notification
  this.printStateMonitor.on('print-error', (event) => {
    if (event.contextId === this.contextId) {
      void this.handlePrintError(event);
    }
  });

  // Listen for generic state changes for other notifications
  this.printStateMonitor.on('state-changed', (event) => {
    if (event.contextId === this.contextId) {
      void this.handleStateChanged(event);
    }
  });
}

/**
 * Remove print state monitor event listeners
 */
private removePrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  this.printStateMonitor.removeAllListeners('print-started');
  this.printStateMonitor.removeAllListeners('print-completed');
  this.printStateMonitor.removeAllListeners('print-cancelled');
  this.printStateMonitor.removeAllListeners('print-error');
  this.printStateMonitor.removeAllListeners('state-changed');
}
```

**4. Refactor event handlers**

Update existing handlers to use event data:

```typescript
/**
 * Handle print started event
 */
private async handlePrintStarted(event: PrintStartedEvent): Promise<void> {
  console.log(`[NotificationCoordinator] Print started: ${event.jobName}`);

  // Reset notification sent flags for active printing states
  this.resetNotificationFlags();
}

/**
 * Handle print completed event
 */
private async handlePrintCompleted(event: PrintCompletedEvent): Promise<void> {
  console.log(`[NotificationCoordinator] Print completed: ${event.jobName}`);

  // Check if notification should be sent
  if (await this.shouldSendNotification('complete')) {
    await this.sendPrintCompleteNotification(event.status);
  }
}

/**
 * Handle print cancelled event
 */
private async handlePrintCancelled(event: PrintCancelledEvent): Promise<void> {
  console.log(`[NotificationCoordinator] Print cancelled`);

  if (await this.shouldSendNotification('cancelled')) {
    await this.sendPrintCancelledNotification(event.status);
  }
}

/**
 * Handle print error event
 */
private async handlePrintError(event: PrintErrorEvent): Promise<void> {
  console.log(`[NotificationCoordinator] Print error`);

  if (await this.shouldSendNotification('error')) {
    await this.sendPrintErrorNotification(event.status);
  }
}

/**
 * Handle generic state change
 */
private async handleStateChanged(event: StateChangedEvent): Promise<void> {
  // Reset flags when returning to active states
  if (this.isActivePrintingState(event.currentState)) {
    this.resetNotificationFlags();
  }
}
```

**5. Remove polling service state detection**

Remove or simplify `handlePrinterStatusUpdate()` - it no longer needs to detect state changes.

Keep polling service connection for other data (temperatures, progress, etc.) that notifications might need.

**6. Update dispose()**

```typescript
public dispose(): void {
  console.log(`[NotificationCoordinator] Disposing for context ${this.contextId}`);

  this.stopAllTimers();
  this.removePollingServiceListeners();
  this.removePrintStateMonitorListeners();
  this.removeTemperatureMonitorListeners();
  this.removeAllListeners();

  this.pollingService = null;
  this.printStateMonitor = null;
  this.temperatureMonitor = null;
}
```

---

### 2.3 Migrate SpoolmanUsageTracker

**File:** `src/services/SpoolmanUsageTracker.ts`

#### Changes Required

**1. Replace TemperatureMonitor with PrintStateMonitor**

Change property:

```typescript
private printStateMonitor: PrintStateMonitor | null = null;
```

Remove `setTemperatureMonitor()`, add:

```typescript
/**
 * Set the print state monitor to listen to
 */
public setPrintStateMonitor(monitor: PrintStateMonitor): void {
  // Remove listeners from old monitor
  if (this.printStateMonitor) {
    this.removePrintStateMonitorListeners();
  }

  this.printStateMonitor = monitor;
  this.setupPrintStateMonitorListeners();

  console.log(`[SpoolmanTracker] Print state monitor connected for context ${this.contextId}`);
}
```

**2. Setup state monitor listeners**

```typescript
/**
 * Setup print state monitor event listeners
 */
private setupPrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  // Trigger Spoolman deduction immediately when print completes
  this.printStateMonitor.on('print-completed', (event) => {
    if (event.contextId === this.contextId) {
      void this.handlePrintCompleted(event);
    }
  });

  // Reset tracking when new print starts
  this.printStateMonitor.on('print-started', (event) => {
    if (event.contextId === this.contextId) {
      this.resetTracking();
    }
  });
}

/**
 * Remove print state monitor event listeners
 */
private removePrintStateMonitorListeners(): void {
  if (!this.printStateMonitor) return;

  this.printStateMonitor.removeAllListeners('print-completed');
  this.printStateMonitor.removeAllListeners('print-started');
}
```

**3. Create handlePrintCompleted**

```typescript
/**
 * Handle print completed event
 */
private async handlePrintCompleted(event: PrintCompletedEvent): Promise<void> {
  console.log(`[SpoolmanTracker] Print completed: ${event.jobName}`);

  // Validate context
  if (event.contextId !== this.contextId) {
    console.warn('[SpoolmanTracker] Context mismatch in print-completed event');
    return;
  }

  // Check if already recorded for this print
  if (this.usageRecordedForPrint === event.jobName) {
    console.log(`[SpoolmanTracker] Usage already recorded for: ${event.jobName}`);
    return;
  }

  // Update Spoolman with cached filament data from backend
  await this.updateSpoolmanUsage(event.status);
}

/**
 * Reset tracking state
 */
private resetTracking(): void {
  this.usageRecordedForPrint = null;
  console.log('[SpoolmanTracker] Tracking state reset');
}
```

**4. Remove handlePrinterCooled**

Delete the old `handlePrinterCooled()` method - no longer needed.

**5. Update dispose()**

```typescript
public dispose(): void {
  console.log(`[SpoolmanTracker] Disposing for context ${this.contextId}`);

  this.removePrintStateMonitorListeners();
  this.removeAllListeners();

  this.printStateMonitor = null;
}
```

**6. Update file header documentation**

Update @fileoverview to reflect dependency on PrintStateMonitor instead of TemperatureMonitoringService.

---

## Phase 3: Update Multi-Context Coordinators

### 3.1 Update MultiContextTemperatureMonitor

**File:** `src/services/MultiContextTemperatureMonitor.ts`

#### Changes Required

**Update createMonitorForContext signature:**

```typescript
/**
 * Create a temperature monitor for a specific context
 */
public createMonitorForContext(
  contextId: string,
  pollingService: PrinterPollingService,
  printStateMonitor: PrintStateMonitor  // NEW PARAMETER
): void {
  // Check if monitor already exists
  if (this.monitors.has(contextId)) {
    console.warn(`[MultiContextTemperatureMonitor] Monitor already exists for context ${contextId}`);
    return;
  }

  // Create new monitor
  const monitor = new TemperatureMonitoringService(contextId);

  // Wire dependencies
  monitor.setPollingService(pollingService);
  monitor.setPrintStateMonitor(printStateMonitor);  // NEW

  // Store monitor
  this.monitors.set(contextId, monitor);

  console.log(`[MultiContextTemperatureMonitor] Created monitor for context ${contextId}`);
}
```

---

### 3.2 Update MultiContextSpoolmanTracker

**File:** `src/services/MultiContextSpoolmanTracker.ts`

#### Changes Required

**Update createTrackerForContext signature:**

```typescript
/**
 * Create a Spoolman tracker for a specific context
 */
public createTrackerForContext(
  contextId: string,
  printStateMonitor: PrintStateMonitor  // CHANGED from temperatureMonitor
): void {
  // Check if tracker already exists
  if (this.trackers.has(contextId)) {
    console.warn(`[MultiContextSpoolmanTracker] Tracker already exists for context ${contextId}`);
    return;
  }

  // Create new tracker
  const tracker = new SpoolmanUsageTracker(contextId);

  // Wire print state monitor
  tracker.setPrintStateMonitor(printStateMonitor);  // CHANGED

  // Store tracker
  this.trackers.set(contextId, tracker);

  console.log(`[MultiContextSpoolmanTracker] Created tracker for context ${contextId}`);
}
```

---

### 3.3 Update MultiContextNotificationCoordinator

**File:** `src/services/MultiContextNotificationCoordinator.ts`

#### Changes Required

**Update createCoordinatorForContext signature:**

```typescript
/**
 * Create a notification coordinator for a specific context
 */
public createCoordinatorForContext(
  contextId: string,
  pollingService: PrinterPollingService,
  printStateMonitor: PrintStateMonitor  // NEW PARAMETER
): void {
  // Check if coordinator already exists
  if (this.coordinators.has(contextId)) {
    console.warn(`[MultiContextNotificationCoordinator] Coordinator already exists for context ${contextId}`);
    return;
  }

  // Create new coordinator
  const coordinator = new PrinterNotificationCoordinator(this.notificationService);

  // Wire dependencies
  coordinator.setPollingService(pollingService);
  coordinator.setPrintStateMonitor(printStateMonitor);  // NEW

  // Store coordinator
  this.coordinators.set(contextId, coordinator);

  console.log(`[MultiContextNotificationCoordinator] Created coordinator for context ${contextId}`);
}
```

---

## Phase 4: Update Initialization Wiring

### 4.1 Update index.ts

**File:** `src/index.ts`

#### Changes at lines 416-451

**Complete replacement of backend-initialized handler:**

```typescript
// ============================================================================
// CONTEXT INITIALIZATION - Backend Initialized
// ============================================================================

backendManager.on('backend-initialized', (event: unknown) => {
  const backendEvent = event as BackendEvent;
  const contextId = backendEvent.contextId;

  console.log(`[Main] Backend initialized for context ${contextId}`);

  // Get backend and polling service
  const backend = getPrinterBackendManager().getBackendForContext(contextId);
  const pollingService = multiContextPollingCoordinator.getPollingService(contextId);

  if (!backend || !pollingService) {
    console.error('[Main] Missing backend or polling service for context initialization');
    return;
  }

  try {
    // ====================================================================
    // STEP 1: Create PrintStateMonitor FIRST (foundation)
    // ====================================================================
    const printStateMonitor = getMultiContextPrintStateMonitor();
    printStateMonitor.createMonitorForContext(contextId, pollingService);
    const stateMonitor = printStateMonitor.getMonitor(contextId);

    if (!stateMonitor) {
      console.error('[Main] Failed to create print state monitor');
      return;
    }

    console.log(`[Main] Created PrintStateMonitor for context ${contextId}`);

    // ====================================================================
    // STEP 2: Create TemperatureMonitor (depends on PrintStateMonitor)
    // ====================================================================
    const tempMonitor = getMultiContextTemperatureMonitor();
    tempMonitor.createMonitorForContext(
      contextId,
      pollingService,
      stateMonitor  // Pass state monitor
    );
    const temperatureMonitor = tempMonitor.getMonitor(contextId);

    if (!temperatureMonitor) {
      console.error('[Main] Failed to create temperature monitor');
      return;
    }

    console.log(`[Main] Created TemperatureMonitor for context ${contextId}`);

    // ====================================================================
    // STEP 3: Create SpoolmanTracker (depends on PrintStateMonitor)
    // ====================================================================
    const spoolmanTracker = getMultiContextSpoolmanTracker();
    spoolmanTracker.createTrackerForContext(
      contextId,
      stateMonitor  // Pass state monitor (not temperature monitor)
    );

    console.log(`[Main] Created SpoolmanTracker for context ${contextId}`);

    // ====================================================================
    // STEP 4: Create NotificationCoordinator (depends on both monitors)
    // ====================================================================
    const notificationCoordinator = getMultiContextNotificationCoordinator();
    notificationCoordinator.createCoordinatorForContext(
      contextId,
      pollingService,
      stateMonitor  // Pass state monitor
    );

    const coordinator = notificationCoordinator.getCoordinator(contextId);
    if (coordinator) {
      // Wire temperature monitor for cooled notifications
      coordinator.setTemperatureMonitor(temperatureMonitor);
      console.log(`[Main] Wired TemperatureMonitor to NotificationCoordinator`);
    }

    console.log(`[Main] Created NotificationCoordinator for context ${contextId}`);

    // ====================================================================
    // INITIALIZATION COMPLETE
    // ====================================================================
    console.log(`[Main] Context ${contextId} fully initialized with all monitors and coordinators`);

  } catch (error) {
    console.error(`[Main] Error initializing context ${contextId}:`, error);
  }
});
```

**Add context cleanup handler:**

```typescript
// ============================================================================
// CONTEXT CLEANUP - Context Destroyed
// ============================================================================

backendManager.on('context-destroyed', (event: unknown) => {
  const contextEvent = event as { contextId: string };
  const contextId = contextEvent.contextId;

  console.log(`[Main] Cleaning up context ${contextId}`);

  try {
    // Destroy in reverse order of creation
    const notificationCoordinator = getMultiContextNotificationCoordinator();
    notificationCoordinator.destroyCoordinator(contextId);
    console.log(`[Main] Destroyed NotificationCoordinator for context ${contextId}`);

    const spoolmanTracker = getMultiContextSpoolmanTracker();
    spoolmanTracker.destroyTracker(contextId);
    console.log(`[Main] Destroyed SpoolmanTracker for context ${contextId}`);

    const tempMonitor = getMultiContextTemperatureMonitor();
    tempMonitor.destroyMonitor(contextId);
    console.log(`[Main] Destroyed TemperatureMonitor for context ${contextId}`);

    const printStateMonitor = getMultiContextPrintStateMonitor();
    printStateMonitor.destroyMonitor(contextId);
    console.log(`[Main] Destroyed PrintStateMonitor for context ${contextId}`);

    console.log(`[Main] Context ${contextId} cleanup complete`);

  } catch (error) {
    console.error(`[Main] Error cleaning up context ${contextId}:`, error);
  }
});
```

**Add import for PrintStateMonitor:**

```typescript
import { getMultiContextPrintStateMonitor } from './services/MultiContextPrintStateMonitor';
```

---

## Phase 5: Verification & Testing

### 5.1 Type Check

Run TypeScript compiler to verify no type errors:

```bash
npm run type-check
```

Expected result: No errors

---

### 5.2 Multi-Context Isolation Tests

#### Test Scenario 1: Single Printer Flow

**Steps:**
1. Connect to a printer
2. Verify PrintStateMonitor created in logs
3. Verify TemperatureMonitor, SpoolmanTracker, NotificationCoordinator created
4. Start a print job
5. Verify 'print-started' event fires
6. Wait for print to complete
7. Verify 'print-completed' event fires immediately
8. Verify Spoolman usage deducted immediately (check logs)
9. Wait for bed to cool
10. Verify 'printer-cooled' event fires later
11. Verify "Print cooled" notification sent

**Expected Results:**
- ✅ All monitors created successfully
- ✅ State transitions detected correctly
- ✅ Spoolman deduction happens at print completion (not cooling)
- ✅ Temperature monitoring starts after completion
- ✅ Notifications sent at appropriate times

---

#### Test Scenario 2: Two Printers Simultaneously

**Steps:**
1. Connect to Printer A
2. Verify context-a monitors created
3. Connect to Printer B
4. Verify context-b monitors created independently
5. Start print on Printer A
6. Verify only context-a 'print-started' event fires
7. Start print on Printer B
8. Verify only context-b 'print-started' event fires
9. Complete print on Printer A
10. Verify only context-a 'print-completed' fires
11. Verify only context-a Spoolman deducts
12. Complete print on Printer B
13. Verify only context-b 'print-completed' fires
14. Verify only context-b Spoolman deducts
15. Verify no cross-contamination of events or data

**Expected Results:**
- ✅ Each printer gets independent monitors
- ✅ Events include correct contextId
- ✅ Event handlers filter by contextId correctly
- ✅ No cross-context interference
- ✅ Each printer's Spoolman usage tracked independently

---

#### Test Scenario 3: Rapid Context Switching

**Steps:**
1. Connect Printer A
2. Start print on Printer A
3. Switch active context to Printer B (connect)
4. Start print on Printer B
5. Complete print on A while viewing B's UI
6. Verify A's state events still fire
7. Verify A's Spoolman still deducts
8. Switch back to A
9. Verify UI reflects completed state
10. Complete print on B
11. Verify B's state events fire correctly

**Expected Results:**
- ✅ Active context switching doesn't affect state monitoring
- ✅ Background contexts continue monitoring
- ✅ Events processed correctly regardless of active context
- ✅ UI updates reflect correct context when switched

---

#### Test Scenario 4: Context Cleanup

**Steps:**
1. Connect printer
2. Verify monitors created
3. Start print
4. Disconnect printer mid-print
5. Verify 'context-destroyed' event fires
6. Verify all monitors disposed in correct order
7. Check logs for cleanup messages
8. Reconnect printer
9. Verify fresh monitors created
10. Verify no stale state from previous connection
11. Start new print
12. Verify state tracking works correctly

**Expected Results:**
- ✅ All monitors disposed on disconnect
- ✅ No memory leaks (listeners removed)
- ✅ Cleanup in reverse dependency order
- ✅ Fresh state on reconnect
- ✅ No interference from previous connection

---

#### Test Scenario 5: Edge Cases

**Test 5A: Print Cancelled**
1. Start print
2. Cancel mid-print
3. Verify 'print-cancelled' event fires
4. Verify no Spoolman deduction
5. Verify temperature monitoring doesn't start

**Test 5B: Print Error**
1. Start print
2. Trigger error (filament runout simulation)
3. Verify 'print-error' event fires
4. Verify no Spoolman deduction
5. Verify appropriate notification sent

**Test 5C: Multiple State Transitions**
1. Start print
2. Pause print
3. Resume print
4. Complete print
5. Verify all state transitions detected
6. Verify Spoolman only deducts once at completion

---

### 5.3 Console Log Verification

**Expected Log Patterns:**

**On context creation:**
```
[PrintStateMonitor] Created for context context-1-xxx
[PrintStateMonitor] Polling service connected for context context-1-xxx
[TemperatureMonitor] Print state monitor connected for context context-1-xxx
[SpoolmanTracker] Print state monitor connected for context context-1-xxx
[NotificationCoordinator] Print state monitor connected for context context-1-xxx
```

**On print start:**
```
[PrintStateMonitor] State change for context-1-xxx: Ready → Busy
[PrintStateMonitor] Print started: JobName.gcode
[SpoolmanTracker] Tracking state reset
[NotificationCoordinator] Print started: JobName.gcode
```

**On print complete:**
```
[PrintStateMonitor] State change for context-1-xxx: Busy → Completed
[PrintStateMonitor] Print completed: JobName.gcode
[SpoolmanTracker] Print completed: JobName.gcode
[SpoolmanTracker] Updating Spoolman usage: 50g, 15000mm
[TemperatureMonitor] Print completed, starting temperature monitoring
[NotificationCoordinator] Print completed: JobName.gcode
```

**On bed cooled:**
```
[TemperatureMonitor] Printer cooled for context-1-xxx: 32°C
[NotificationCoordinator] Bed has cooled, sending notification
```

---

## Phase 6: Documentation

### 6.1 Update ARCHITECTURE.md

**Add new section after Multi-Printer Architecture:**

```markdown
## Print State Monitoring

The application uses a centralized **PrintStateMonitor** service to detect and broadcast printer state changes. This eliminates duplicate state-tracking logic and provides a single source of truth for state transitions.

### Architecture

**Component Structure:**
- **PrintStateMonitor**: Per-context monitor that listens to polling service and emits domain events
- **MultiContextPrintStateMonitor**: Manages per-context monitor instances across multiple printer connections
- All state-dependent services subscribe to PrintStateMonitor events instead of directly listening to polling service

**Benefits:**
- Eliminates duplicate state detection logic across services
- Provides single source of truth for printer state transitions
- Makes it easy to add new state-driven features
- Maintains perfect multi-context isolation
- Enables immediate reaction to state changes (e.g., Spoolman deduction on completion)

### Event Flow

```
PrinterPollingService (raw status data)
    ↓
PrintStateMonitor (state transition detection)
    ↓ emits: state-changed, print-started, print-completed, etc.
    ↓
    ├─→ TemperatureMonitoringService (starts monitoring on completion)
    ├─→ SpoolmanUsageTracker (deducts usage on completion)
    └─→ PrinterNotificationCoordinator (sends notifications)
```

### Integration Pattern

When adding new state-dependent features:

1. Get PrintStateMonitor for context from MultiContextPrintStateMonitor
2. Subscribe to relevant events ('print-completed', 'state-changed', etc.)
3. Filter events by contextId in your handler
4. Implement your business logic

Example:
```typescript
printStateMonitor.on('print-completed', (event) => {
  if (event.contextId === this.contextId) {
    // Your logic here
  }
});
```

### Multi-Context Safety

Each printer context gets its own PrintStateMonitor instance:
- Stored in `Map<contextId, monitor>` for perfect isolation
- All events include contextId for filtering
- No shared state between contexts
- Proper lifecycle management (create on connect, dispose on disconnect)
```

---

### 6.2 Update File Headers

**Add comprehensive @fileoverview to new files:**

Already included in Phase 1 code above.

**Update existing files:**

Update @fileoverview comments in:
- `TemperatureMonitoringService.ts` - Mention dependency on PrintStateMonitor
- `SpoolmanUsageTracker.ts` - Update to reflect PrintStateMonitor dependency
- `PrinterNotificationCoordinator.ts` - Mention PrintStateMonitor integration

---

### 6.3 Create Migration Notes

**File:** `migration-notes-print-state-monitor.md` (optional internal doc)

Document:
- What changed and why
- Breaking changes (none for external consumers)
- New event patterns
- How to add new state-driven features
- Testing procedures for multi-context scenarios

---

## Multi-Context Safety Guarantees

### ✅ Per-Context Instance Isolation

**Implementation:**
- Every printer context gets its own PrintStateMonitor instance
- Stored in `Map<contextId, monitor>` in MultiContextPrintStateMonitor
- No shared state between monitors
- Each monitor tracks only its own printer's state

**Verification:**
```typescript
// Each context gets independent instance
const monitorA = printStateMonitor.getMonitor('context-a');
const monitorB = printStateMonitor.getMonitor('context-b');
// monitorA and monitorB are completely independent
```

---

### ✅ Event Filtering

**Implementation:**
- All events include `contextId` in payload
- Event handlers must filter: `if (event.contextId !== this.contextId) return;`
- Prevents cross-context event handling

**Example:**
```typescript
this.printStateMonitor.on('print-completed', (event) => {
  // CRITICAL: Filter by context
  if (event.contextId !== this.contextId) {
    return; // Ignore events from other contexts
  }

  // Safe to process - this is our context's event
  await this.handlePrintCompleted(event);
});
```

---

### ✅ Proper Lifecycle Management

**Creation Order:**
1. PrintStateMonitor (foundation)
2. TemperatureMonitor (depends on state)
3. SpoolmanTracker (depends on state)
4. NotificationCoordinator (depends on both)

**Destruction Order (reverse):**
1. NotificationCoordinator
2. SpoolmanTracker
3. TemperatureMonitor
4. PrintStateMonitor

**Why This Matters:**
- Prevents dangling references
- Ensures all listeners cleaned up
- No memory leaks
- Clean shutdown for each context

---

### ✅ Dependency Ordering

**Enforced in index.ts:**

```typescript
// STEP 1: Foundation
printStateMonitor.createMonitorForContext(contextId, pollingService);
const stateMonitor = printStateMonitor.getMonitor(contextId);

// STEP 2: Dependent services (require stateMonitor)
tempMonitor.createMonitorForContext(contextId, pollingService, stateMonitor);
spoolmanTracker.createTrackerForContext(contextId, stateMonitor);
notificationCoordinator.createCoordinatorForContext(contextId, pollingService, stateMonitor);
```

**Why This Matters:**
- All dependencies available when needed
- No race conditions
- Deterministic initialization
- Clear dependency graph

---

### ✅ No Global State

**Architecture Principle:**
- No static properties in monitors
- No shared singletons (except multi-context coordinators, which are just factories)
- Each monitor completely independent
- State stored per-instance only

**Benefits:**
- Perfect isolation between contexts
- No unexpected side effects
- Easy to test in isolation
- Predictable behavior

---

### ✅ Event Routing

**Pattern:**

All events flow through EventEmitter:
```typescript
// Emit with contextId
this.emit('print-completed', {
  contextId: this.contextId,  // Always include context
  jobName: 'job.gcode',
  status: printerStatus,
  completedAt: new Date()
});

// Subscribe with filter
monitor.on('print-completed', (event) => {
  if (event.contextId !== this.contextId) return;  // Filter
  // Handle event
});
```

**Why This Works:**
- Events are synchronous (no race conditions)
- Filtering prevents cross-context handling
- Type-safe event payloads
- Easy to debug (console logs show contextId)

---

## Files Modified Summary

### New Files (2)

1. **`src/services/PrintStateMonitor.ts`**
   - Core state monitoring service
   - ~400 lines
   - Listens to polling service
   - Emits state transition events

2. **`src/services/MultiContextPrintStateMonitor.ts`**
   - Multi-context coordinator
   - ~100 lines
   - Manages per-context monitor instances
   - Lifecycle management

---

### Modified Services (3)

3. **`src/services/TemperatureMonitoringService.ts`**
   - Add PrintStateMonitor dependency
   - Remove direct polling state listeners
   - Listen to 'print-completed', 'print-started' events
   - Keep polling for temperature data only

4. **`src/services/SpoolmanUsageTracker.ts`**
   - Replace TemperatureMonitor with PrintStateMonitor
   - Listen to 'print-completed' event
   - Deduct usage immediately on completion
   - No longer wait for cooling

5. **`src/services/notifications/PrinterNotificationCoordinator.ts`**
   - Add PrintStateMonitor dependency
   - Listen to state events instead of polling directly
   - Simplify state detection logic
   - Keep polling for other notification data

---

### Modified Coordinators (3)

6. **`src/services/MultiContextTemperatureMonitor.ts`**
   - Update `createMonitorForContext()` signature
   - Pass PrintStateMonitor to temperature monitors
   - Wire dependency correctly

7. **`src/services/MultiContextSpoolmanTracker.ts`**
   - Update `createTrackerForContext()` signature
   - Pass PrintStateMonitor instead of TemperatureMonitor
   - Update wiring

8. **`src/services/MultiContextNotificationCoordinator.ts`**
   - Update `createCoordinatorForContext()` signature
   - Pass PrintStateMonitor to coordinators
   - Wire dependency correctly

---

### Integration (2)

9. **`src/index.ts`**
   - Import MultiContextPrintStateMonitor
   - Update backend-initialized handler
   - Create PrintStateMonitor first
   - Wire to all dependent services
   - Add context-destroyed handler for cleanup

10. **`src/services/index.ts`**
    - Export PrintStateMonitor
    - Export MultiContextPrintStateMonitor
    - Export getMultiContextPrintStateMonitor

---

### Documentation Updates

- Update `ARCHITECTURE.md` with Print State Monitoring section
- Update file headers (@fileoverview) in all modified files
- Add comprehensive inline documentation

---

## Implementation Checklist

### Phase 1: Core Services
- [ ] Create `PrintStateMonitor.ts`
- [ ] Create `MultiContextPrintStateMonitor.ts`
- [ ] Add exports to `services/index.ts`
- [ ] Run type check

### Phase 2: Service Migration
- [ ] Migrate `TemperatureMonitoringService.ts`
- [ ] Migrate `PrinterNotificationCoordinator.ts`
- [ ] Migrate `SpoolmanUsageTracker.ts`
- [ ] Run type check after each migration

### Phase 3: Coordinator Updates
- [ ] Update `MultiContextTemperatureMonitor.ts`
- [ ] Update `MultiContextSpoolmanTracker.ts`
- [ ] Update `MultiContextNotificationCoordinator.ts`
- [ ] Run type check

### Phase 4: Integration
- [ ] Update `index.ts` backend-initialized handler
- [ ] Add context-destroyed handler
- [ ] Add import for PrintStateMonitor
- [ ] Run type check

### Phase 5: Testing
- [ ] Test single printer flow
- [ ] Test two printers simultaneously
- [ ] Test rapid context switching
- [ ] Test context cleanup
- [ ] Test edge cases (cancel, error, etc.)
- [ ] Verify console logs match expected patterns
- [ ] Verify Spoolman deduction timing

### Phase 6: Documentation
- [ ] Update `ARCHITECTURE.md`
- [ ] Update file headers
- [ ] Add inline documentation
- [ ] Create migration notes (optional)

---

## Success Criteria

### Functional Requirements
- ✅ Spoolman deduction happens immediately on print completion (not on cooling)
- ✅ Temperature monitoring still works correctly
- ✅ Notifications still sent at appropriate times
- ✅ All state transitions detected correctly
- ✅ Multi-printer support maintained

### Technical Requirements
- ✅ No TypeScript errors
- ✅ No runtime errors
- ✅ No memory leaks
- ✅ Clean console logs
- ✅ Per-context isolation maintained

### Architecture Requirements
- ✅ Single source of truth for state
- ✅ No duplicate state detection logic
- ✅ Clean event-driven architecture
- ✅ Easy to extend with new features
- ✅ Follows existing patterns

---

## Rollback Plan

If issues arise during implementation:

1. **Immediate Rollback:**
   - Revert all changes
   - Use git to restore previous working state

2. **Partial Rollback:**
   - Keep PrintStateMonitor created
   - Don't migrate existing services yet
   - Test PrintStateMonitor in isolation first

3. **Staged Migration:**
   - Migrate one service at a time
   - Test thoroughly after each migration
   - Only proceed if previous migration successful

---

## Notes

- This is a comprehensive refactor touching 10 files
- Multi-context isolation is critical - test thoroughly
- All changes maintain backwards compatibility
- No breaking changes to external APIs
- Implementation should take 2-3 hours for careful, thorough work
- Testing should take 1-2 hours for comprehensive coverage

---

**End of Specification**
