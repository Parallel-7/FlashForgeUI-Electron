# LED Control Specification

**Date:** 2025-01-22
**Status:** Implementation Required
**Priority:** High

## Overview

This document defines the correct behavior for LED control across all interfaces (Main UI, WebUI) and execution modes (normal, headless) in FlashForgeUI.

## Problem Statement

LED control behavior is currently fragmented between Main UI and WebUI:
- **Main UI:** Always shows LED buttons, allows fallback to TCP/Legacy API regardless of printer capabilities
- **WebUI:** Strictly checks feature availability, hides LED controls when not supported
- **Result:** Inconsistent user experience and confusion about LED support

**Goal:** After these changes, Main UI and WebUI will behave **identically** - LED buttons always visible, enabled/disabled based on the same feature detection logic, using the same API routing.

## Correct LED Control Logic

### LED Control Auto-Detection Logic

LED control availability is determined by printer model type:

#### Adventurer 5M Pro
- **Factory LEDs**: Yes - detects via `/product` endpoint (`lightCtrlState === 1`)
- **Auto-Enable**: Yes
- **API Used**: **HTTP API** (FiveMClient.control.setLedOn/Off)
- **User Action**: None required

#### Adventurer 5M
- **Factory LEDs**: No (`lightCtrlState === 0` from `/product` endpoint)
- **Auto-Enable**: **Yes** - LED control automatically enabled on connection
- **API Used**: **TCP/Legacy API** (FlashForgeClient.ledOn/Off)
- **User Action**: None required

#### AD5X
- **Factory LEDs**: No (`lightCtrlState === 0` from `/product` endpoint)
- **Auto-Enable**: **Yes** - LED control automatically enabled on connection
- **API Used**: **TCP/Legacy API** (FlashForgeClient.ledOn/Off)
- **User Action**: None required

#### Generic Legacy
- **Factory LEDs**: No (no HTTP API to detect)
- **Auto-Enable**: No
- **API Used**: **TCP/Legacy API** (FlashForgeClient.ledOn/Off)
- **User Action**: **Must enable "Custom LEDs" in settings**

### LED Control Availability States

| Printer | Auto-Enable LED Control | Custom LEDs Setting | Result |
|---------|------------------------|---------------------|--------|
| **Adventurer 5M Pro** | Yes (builtin) | N/A | Buttons **ENABLED**, use **HTTP API** |
| **Adventurer 5M** | Yes (auto-enable TCP) | N/A | Buttons **ENABLED**, use **TCP API** |
| **AD5X** | Yes (auto-enable TCP) | N/A | Buttons **ENABLED**, use **TCP API** |
| **Generic Legacy** | No | Enabled | Buttons **ENABLED**, use **TCP API** |
| **Generic Legacy** | No | Disabled | Buttons **DISABLED** (visible but grayed out) |

### Desired Behavior

**LED buttons should:**
1. **Always be visible** in the UI (never hidden)
2. **Be enabled** based on printer model:
   - **5M Pro**: Enabled if `builtin === true` (HTTP API detected)
   - **5M/AD5X**: **Always enabled** (auto-enabled TCP API)
   - **Generic Legacy**: Enabled only if user enabled "Custom LEDs" setting
3. **Be disabled/grayed out** only for Generic Legacy printers when Custom LEDs setting is off
4. **Route to correct API**:
   - **5M Pro with `builtin === true`** → Use HTTP API (FiveMClient.control.setLedOn/setLedOff)
   - **5M/AD5X** → Always use TCP API (FlashForgeClient.ledOn/ledOff)
   - **Generic Legacy with Custom LEDs enabled** → Use TCP API (FlashForgeClient.ledOn/ledOff)

## API Routing Logic

### HTTP API (New API) - FiveMClient
**When:** Adventurer 5M Pro with `builtin === true` (detected via `lightCtrlState === 1`)

```typescript
// Use FiveMClient control methods
await primaryClient.control.setLedOn();
await primaryClient.control.setLedOff();
```

### TCP/Legacy API - FlashForgeClient
**When:**
- **Adventurer 5M**: Always (auto-enabled)
- **AD5X**: Always (auto-enabled)
- **Generic Legacy**: Only when user enables "Custom LEDs" setting

```typescript
// Use FlashForgeClient legacy methods
await legacyClient.ledOn();
await legacyClient.ledOff();
```

## Current Implementation Issues

### Issue 1: Main UI Always Enables LED Buttons
**File:** `src/ui/components/controls-grid/controls-grid.ts`
**Lines:** 124, 142

```typescript
{
  id: 'btn-led-on',
  action: 'invoke',
  channel: 'led-on',
  requiresConnection: true,
  disableDuringPrint: false,
  legacySupported: true  // ❌ WRONG: Makes buttons always available
}
```

**Problem:** `legacySupported: true` makes LED buttons always enabled when connected, bypassing feature detection.

**Fix:** Change to `legacySupported: false` and implement proper feature-based enabling.

### Issue 2: Control Handlers Allow Incorrect Fallback
**File:** `src/ipc/handlers/control-handlers.ts`
**Lines:** 250, 302

```typescript
else if (features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI) {
  // ❌ WRONG: usesLegacyAPI is always true, allows control without user enabling it
  const legacyClient = getLegacyClient(backend);
  // ...
}
```

**Problem:** `usesLegacyAPI` is `true` for ALL backends, so this fallback always triggers even when it shouldn't (e.g., Generic Legacy without Custom LEDs enabled).

**Fix:** Update logic to:
- 5M Pro → HTTP API if `builtin === true`
- 5M/AD5X → Always use TCP API (auto-enabled)
- Generic Legacy → Use TCP API only if `customControlEnabled === true`

### Issue 3: Backend Feature Detection
**File:** `src/printer-backends/BasePrinterBackend.ts`
**Line:** 325

```typescript
case 'led-control':
  return this.features.ledControl.builtin || this.features.ledControl.customControlEnabled;
```

**Status:** Needs update to handle auto-enable for 5M/AD5X

**Fix:** Update to return `true` for 5M/AD5X models automatically:
```typescript
case 'led-control':
  // 5M Pro has builtin LEDs detected via HTTP API
  if (this.features.ledControl.builtin) return true;

  // 5M and AD5X auto-enable LED control (always available via TCP API)
  if (this.printerModel === 'adventurer-5m' || this.printerModel === 'ad5x') return true;

  // Generic Legacy requires manual Custom LEDs enablement
  return this.features.ledControl.customControlEnabled;
```

### Issue 4: WebUI Feature Check
**File:** `src/webui/server/api-routes.ts`
**Line:** 123

```typescript
if (!backendManager.isFeatureAvailable(contextId, 'led-control')) {
  return { success: false, error: 'LED control not available on this printer' };
}
```

**Status:** Already correct - properly uses `isFeatureAvailable()`.

## Implementation Plan

### 1. Fix Main UI LED Button Configuration

**File:** `src/ui/components/controls-grid/controls-grid.ts`

**Change lines 119-125 and 137-143:**

```typescript
// Before:
{
  id: 'btn-led-on',
  action: 'invoke',
  channel: 'led-on',
  requiresConnection: true,
  disableDuringPrint: false,
  legacySupported: true  // ❌ Remove this
}

// After:
{
  id: 'btn-led-on',
  action: 'invoke',
  channel: 'led-on',
  requiresConnection: true,
  disableDuringPrint: false,
  legacySupported: false,  // ✅ Only enable via feature detection
  requiresFeature: 'led-control'  // ✅ New: Require feature check
}
```

**Also update button state logic** to check feature availability before enabling.

### 2. Fix IPC Control Handlers

**File:** `src/ipc/handlers/control-handlers.ts`

**Change lines 240-262 (led-on handler):**

```typescript
// Before:
if (features.ledControl.builtin) {
  // Use new API
} else if (features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI) {
  // ❌ WRONG: usesLegacyAPI always true
}

// After:
if (features.ledControl.builtin) {
  // Use HTTP API for 5M Pro with factory LEDs
  const primaryClient = backend.getPrimaryClient();
  if (!(primaryClient instanceof FiveMClient)) {
    return { success: false, error: 'Built-in LED requires new API client' };
  }
  const result = await primaryClient.control.setLedOn();
  return { success: result, data: result };
} else if (modelType === 'adventurer-5m' || modelType === 'ad5x') {
  // 5M and AD5X: Always use TCP API (auto-enabled)
  const legacyClient = getLegacyClient(backend);
  if (!legacyClient) {
    return { success: false, error: 'LED control not available' };
  }
  const result = await legacyClient.ledOn();
  return { success: result, data: result };
} else if (features.ledControl.customControlEnabled) {
  // Generic Legacy: Use TCP API only if user enabled Custom LEDs
  const legacyClient = getLegacyClient(backend);
  if (!legacyClient) {
    return { success: false, error: 'LED control not available' };
  }
  const result = await legacyClient.ledOn();
  return { success: result, data: result };
} else {
  // Generic Legacy without Custom LEDs enabled
  return { success: false, error: 'LED control not available on this printer' };
}
```

**Same changes for lines 292-314 (led-off handler).**

### 3. Verify Backend Feature Building

**File:** `src/printer-backends/BasePrinterBackend.ts`

**Line 261-264 - Update feature building:**

```typescript
ledControl: {
  builtin: baseFeatures.ledControl.builtin,
  // Auto-enable for 5M/AD5X, otherwise check custom setting
  customControlEnabled: (this.printerModel === 'adventurer-5m' || this.printerModel === 'ad5x')
    ? true  // Auto-enable for these models
    : (Boolean(settingsOverrides.customLEDControl) && this.supportsCustomLEDControl()),
  usesLegacyAPI: baseFeatures.ledControl.usesLegacyAPI
}
```

**Line 325 - Update isFeatureAvailable:**

```typescript
case 'led-control':
  // 5M Pro has builtin LEDs
  if (this.features.ledControl.builtin) return true;

  // 5M and AD5X auto-enable (customControlEnabled set to true above)
  // Generic Legacy requires manual Custom LEDs setting
  return this.features.ledControl.customControlEnabled;
```

### 4. Verify DualAPIBackend LED Detection

**File:** `src/printer-backends/DualAPIBackend.ts`

**Lines 166-178 should remain as-is:**

```typescript
// For AD5X, respect the child's LED settings (don't auto-detect)
// AD5X requires CustomLeds to be enabled for any LED control
const ledBuiltin = this.modelType === 'ad5x'
  ? childFeatures.ledControl.builtin  // Always false for AD5X
  : this.productInfo.lightCtrlState !== 0;  // Check API for others

// ✅ CORRECT: Uses lightCtrlState from /product endpoint
```

### 5. WebUI - Verify Consistent Behavior

**File:** `src/webui/server/api-routes.ts`

WebUI already uses `isFeatureAvailable('led-control')` which properly checks `builtin || customControlEnabled`.

**Status:** ✅ Already correct - will match Main UI behavior after Main UI fixes are applied

**Note:** After implementing changes 1-4, the WebUI will automatically behave identically to the Main UI because:
- Both use `isFeatureAvailable('led-control')` for feature detection
- Both route through the same backend LED control methods
- Both get the same feature flags from backend (`builtin`, `customControlEnabled`)
- Both will show LED buttons as visible but disabled when features are not available

## Testing Checklist

After implementation, verify the following scenarios:

### Main UI Testing

- [ ] **Adventurer 5M Pro (builtin LEDs)**
  - [ ] LED buttons visible and enabled immediately on connect
  - [ ] LED On/Off commands use HTTP API
  - [ ] Works in both normal and headless modes

- [ ] **Adventurer 5M (auto-enabled)**
  - [ ] LED buttons visible and enabled on connect (no setting required)
  - [ ] LED On/Off commands use TCP/Legacy API
  - [ ] Works in both normal and headless modes
  - [ ] Custom LEDs setting has no effect (always enabled)

- [ ] **AD5X (auto-enabled)**
  - [ ] LED buttons visible and enabled on connect (no setting required)
  - [ ] LED On/Off commands use TCP/Legacy API
  - [ ] Works in both normal and headless modes
  - [ ] Custom LEDs setting has no effect (always enabled)

- [ ] **Generic Legacy with Custom LEDs Enabled**
  - [ ] LED buttons visible and enabled
  - [ ] LED On/Off commands use TCP/Legacy API
  - [ ] Works in both normal and headless modes

- [ ] **Generic Legacy with Custom LEDs Disabled**
  - [ ] LED buttons visible but DISABLED/grayed out
  - [ ] Attempting to click shows "LED control not available" message
  - [ ] Works in both normal and headless modes

### WebUI Testing

- [ ] **Adventurer 5M Pro (builtin LEDs)**
  - [ ] LED buttons visible and enabled
  - [ ] LED On/Off commands work via HTTP API
  - [ ] Works in both normal and headless modes

- [ ] **Adventurer 5M (auto-enabled)**
  - [ ] LED buttons visible and enabled (no setting required)
  - [ ] LED On/Off commands work via TCP API
  - [ ] Works in both normal and headless modes
  - [ ] Custom LEDs setting has no effect (always enabled)

- [ ] **AD5X (auto-enabled)**
  - [ ] LED buttons visible and enabled (no setting required)
  - [ ] LED On/Off commands work via TCP API
  - [ ] Works in both normal and headless modes
  - [ ] Custom LEDs setting has no effect (always enabled)

- [ ] **Generic Legacy with Custom LEDs Enabled**
  - [ ] LED buttons visible and enabled
  - [ ] LED On/Off commands work via TCP API
  - [ ] Works in both normal and headless modes

- [ ] **Generic Legacy with Custom LEDs Disabled**
  - [ ] LED buttons visible but DISABLED
  - [ ] Clicking shows error message
  - [ ] Works in both normal and headless modes

### Feature Detection Testing

- [ ] `isFeatureAvailable('led-control')` returns correct values:
  - [ ] `true` for Adventurer 5M Pro (builtin)
  - [ ] `true` for Adventurer 5M (always - auto-enabled)
  - [ ] `true` for AD5X (always - auto-enabled)
  - [ ] `true` for Generic Legacy with Custom LEDs enabled
  - [ ] `false` for Generic Legacy with Custom LEDs disabled

## Success Criteria

1. ✅ LED buttons **always visible** in both Main UI and WebUI (never hidden)
2. ✅ LED buttons **enabled/disabled based on identical feature detection logic** in both UIs
3. ✅ Correct API routing (HTTP for builtin, TCP for custom) - **same logic in both UIs**
4. ✅ **Main UI and WebUI behave identically** - same buttons, same enabled/disabled states, same error messages
5. ✅ **Identical behavior** between normal and headless modes for both UIs
6. ✅ Clear, consistent error messages when LED control unavailable across both UIs

## Related Files

- `src/ui/components/controls-grid/controls-grid.ts` - Main UI LED buttons
- `src/ipc/handlers/control-handlers.ts` - IPC LED control handlers
- `src/webui/server/api-routes.ts` - WebUI LED control endpoints
- `src/printer-backends/BasePrinterBackend.ts` - Feature detection logic
- `src/printer-backends/DualAPIBackend.ts` - Factory LED detection
- `ff-5mp-api-ts/src/FiveMClient.ts` - Product info parsing

## Notes

### General
- **Main UI and WebUI Synchronization**: After these changes, both UIs will have **identical** LED control behavior - same visibility, same enable/disable logic, same API routing, same error messages
- **`usesLegacyAPI`** flag should remain in backend features for informational purposes, but is not used for availability detection
- All printers support the TCP/Legacy LED API

### Printer-Specific Behavior

#### Adventurer 5M Pro
- **Factory LEDs**: Yes (`lightCtrlState === 1` from `/product` endpoint)
- **LED Control**: Auto-enabled, uses HTTP API
- **Custom LEDs Setting**: Not applicable (uses builtin)

#### Adventurer 5M
- **Factory LEDs**: No (`lightCtrlState === 0` from `/product` endpoint)
- **LED Control**: **Auto-enabled** on connection, always uses TCP/Legacy API
- **Custom LEDs Setting**: Ignored (LED control always enabled for this model)
- **Reasoning**: Known hardware that supports TCP LED commands

#### AD5X
- **Factory LEDs**: No (`lightCtrlState === 0` from `/product` endpoint)
- **LED Control**: **Auto-enabled** on connection, always uses TCP/Legacy API
- **Custom LEDs Setting**: Ignored (LED control always enabled for this model)
- **Reasoning**: Known hardware that supports TCP LED commands

#### Generic Legacy
- **Factory LEDs**: No (no HTTP API to detect)
- **LED Control**: Disabled by default, requires manual enablement
- **Custom LEDs Setting**: **Required** - user must enable in settings to use TCP/Legacy API
- **Reasoning**: Unknown/older hardware, requires user opt-in for safety
