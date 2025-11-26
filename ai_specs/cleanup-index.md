# Refactoring Plan: Reduce `src/index.ts` from 1,098 Lines 💡

## Overview

The `src/index.ts` file has grown to **1,098 lines** by accumulating responsibilities beyond its core purpose as the **Electron app orchestrator**. This plan outlines a refactoring strategy to reduce its size by extracting well-defined concerns into dedicated modules while preserving all functionality.

---

## Current State Analysis

The file's responsibilities can be broken down into five main areas:

1.  **Event Forwarding Functions** (~370 lines, 388-753). These are GUI-specific event forwarders (renderer windows only).
    * `setupSpoolmanEventForwarding()` (24 lines)
    * `setupPrinterContextEventForwarding()` (216 lines)
    * `setupConnectionEventForwarding()` (91 lines)
2.  **Window Creation & UI Setup** (~240 lines, 107-377).
    * `initializeCameraService()` (5 lines - no-op stub)
    * `validateWebUIAssets()` (28 lines)
    * `handleWebUILoadError()` (34 lines)
    * `handleRoundedUICompatibilityIssues()` (45 lines)
    * `createMainWindow()` (140 lines)
3.  **Duplicated Service Initialization** (~60 lines across `initializeApp`/`initializeHeadless`).
    * RTSP stream service
    * Spoolman integration + health monitoring
    * Multi-context temperature monitor
    * Multi-context Spoolman tracker
    * Notification system + coordinator
    * Discord notification service
4.  **App Lifecycle & Orchestration** (~120 lines).
    * Single instance lock (20 lines)
    * Auto-connect logic (20 lines)
    * Config forwarding (20 lines)
    * Event-driven services setup (30 lines)
    * App lifecycle handlers (30 lines)
5.  **Spoolman Health Monitoring Setup** (~30 lines, 414-441).

---

## Proposed Refactoring Strategy

This refactoring will be executed in four sequential phases to minimize risk.

### Phase 1: Extract Event Forwarding (Highest Impact)

* **Target Reduction:** ~350 lines
* **Goal:** Move all GUI-specific event forwarding logic into a new, dedicated IPC structure.
* **New Module Structure:**
    ```
    src/ipc/event-forwarding/
    ├── index.ts                 # setupEventForwarding() - single entry point
    ├── base-forwarder.ts        # Abstract EventForwarder class
    ├── printer-context-forwarder.ts # Context lifecycle + monitor creation
    ├── connection-forwarder.ts  # Backend events + WebUI lifecycle
    └── spoolman-forwarder.ts    # Spoolman events + health monitoring
    ```
* **Key Design Decisions:**
    * An **Abstract `EventForwarder` base class** will handle generic concerns:
        * Window existence checks
        * Multi-window forwarding (main + component dialog)
        * Event listener cleanup
        * Logging patterns
    * Each concrete forwarder encapsulates a single domain (printer context, connection, spoolman).
    * The **exact initialization sequence** for the monitor creation chain must be preserved.
    * All **IPC channel names** will remain unchanged for renderer compatibility.
* **Benefits:**
    * Removes the largest block of code from `index.ts` (~32%).
    * Improves **testability** (each forwarder can be unit tested).
    * Clear separation: orchestration vs. event routing.

### Phase 2: Extract Main Window Creation (High Impact)

* **Target Reduction:** ~140 lines
* **Goal:** Encapsulate the complex logic for creating, setting up, and validating the main window.
* **New Module Structure:**
    ```
    src/windows/
    ├── factories/
    │   └── MainWindowFactory.ts   # createMainWindow() + preflight checks
    └── setup/
        └── MainWindowSetup.ts     # Validation, error handling, compatibility
    ```
* **Functions to Move:**
    * `validateWebUIAssets()` → `MainWindowSetup.ts`
    * `handleWebUILoadError()` → `MainWindowSetup.ts`
    * `handleRoundedUICompatibilityIssues()` → `MainWindowSetup.ts`
    * `createMainWindow()` → `MainWindowFactory.ts` (calls setup utilities)
* **Benefits:**
    * Follows existing factory patterns (`CoreWindowFactory`, `DialogWindowFactory`).
    * `index.ts` becomes a single line: `await createMainWindow()`.

### Phase 3: Consolidate Shared Initialization (Medium Impact)

* **Target Reduction:** ~60 lines
* **Goal:** Eliminate duplicated service initialization between GUI and headless modes.
* **New Module:** `src/core/SharedInitialization.ts`
* **Shared Services to Extract:**
    * RTSP stream service
    * Spoolman integration + health monitoring
    * Multi-context temperature monitor/Spoolman tracker
    * Notification system + coordinator (including Discord)
* **Module Structure:**
    ```typescript
    // src/core/SharedInitialization.ts
    export async function initializeSharedServices(): Promise<void> {
      // Services common to both GUI and headless (RTSP, Spoolman, etc.)
    }

    export async function initializeGUIOnlyServices(): Promise<void> {
      // GUI-specific: auto-update, thumbnail cache
    }
    ```
* **Note on Headless:** The `HeadlessManager`'s event forwarding is independent and will not be modified. This phase only addresses shared service initialization overlap.

### Phase 4: Extract Helper Functions (Low Impact)

* **Target Reduction:** ~50 lines
* **Goal:** Move small utility and setup functions closer to the managers/services they control.
* **Functions to Extract:**
    * `performAutoConnect()` → `src/managers/AutoConnectManager.ts` (or enhance existing `AutoConnectService`)
    * `broadcastConfigLoadedEvent()` → `src/managers/ConfigManager.ts` (add method)
    * `setupConfigLoadedForwarding()` → `src/managers/ConfigManager.ts` (internal)
    * `setupEventDrivenServices()` → `src/ipc/handlers/renderer-ready-handler.ts`
* **Benefits:** Reduces utility function clutter in `index.ts`.

---

## Expected Results 📈

| Phase | Lines Reduced | % of Total |
| :--- | :--- | :--- |
| **Event Forwarding** | ~350 | 32% |
| **Window Creation** | ~140 | 13% |
| **Shared Initialization** | ~60 | 5% |
| **Helper Functions** | ~50 | 5% |
| **Total** | **~600** | **55%** |

* **Final Size:** **~500 lines** (from 1,098)

---

## Implementation Details

### Files to Create

* `src/ipc/event-forwarding/index.ts`
* `src/ipc/event-forwarding/base-forwarder.ts`
* `src/ipc/event-forwarding/printer-context-forwarder.ts`
* `src/ipc/event-forwarding/connection-forwarder.ts`
* `src/ipc/event-forwarding/spoolman-forwarder.ts`
* `src/windows/factories/MainWindowFactory.ts`
* `src/windows/setup/MainWindowSetup.ts`
* `src/core/SharedInitialization.ts`

### Files to Modify

* `src/index.ts` (remove ~600 lines, add imports to new modules)
* `src/managers/ConfigManager.ts` (add `broadcastConfigLoaded` method)
* `src/managers/AutoConnectService.ts` (enhance with `performAutoConnect` if needed)

### Risks & Mitigation

| Risk | Mitigation Strategy |
| :--- | :--- |
| **Event Ordering Dependencies** | Preserve exact monitor creation sequence (`PrintStateMonitor` → `TemperatureMonitor` → `SpoolmanTracker` → `NotificationCoordinator`) in forwarder, add inline documentation. |
| **IPC Channel Name Changes** | **Keep all IPC channel names identical** during refactoring to maintain renderer compatibility. |
| **Circular Dependencies** | Use **dependency injection** via constructor parameters instead of direct imports for inter-module communication. |
| **Headless Mode Behavior** | GUI event forwarders are **renderer-specific**. Confirm `HeadlessManager`'s existing event forwarding logic is untouched. |

---

## Success Criteria ✅

* `src/index.ts` is reduced to **~500 lines**.
* All existing functionality is preserved (**no regressions**).
* Both **GUI** and **headless modes** work identically.
* Type checking (`npm run type-check`) and linting (`npm run lint`) pass.
* All IPC channels maintain **backward compatibility**.
* Event ordering (especially monitor creation chain) is preserved.
* Code is more maintainable and testable.