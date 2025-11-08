# Fix Temperature Monitoring & Spoolman Integration

**Date:** 2025-11-06
**Status:** Ready for Implementation
**Estimated Complexity:** Medium

## Problem Summary

Two related issues were identified during testing:

1. **"Print Cooled" Notifications Not Firing**
   - User gets "print complete" notification ✅
   - User does NOT get "print cooled" notification ❌
   - Root cause: 2-minute minimum cool time delay in temperature monitoring
   - The monitor waits 2 minutes after print completion before even starting to check temperature

2. **Spoolman Integration Not Deducting Filament Usage**
   - Active spool ID is saved/restored correctly ✅
   - Print completes and bed cools ✅
   - Spoolman does NOT deduct weight/length ❌
   - Root cause: Backend clears EstLength/EstWeight data when state becomes "Completed"
   - By the time "printer-cooled" event fires, usage data is zero
   - SpoolmanUsageTracker receives zero values and skips the update

## Root Cause Analysis

### Temperature Monitoring Issue

**Current Flow:**
1. Print completes → state becomes "Completed"
2. TemperatureMonitoringService.startMonitoring() is called
3. Timer starts checking temperature every 30 seconds
4. **BUT** the check is skipped for 2 minutes due to `minimumCoolTime` check (lines 287-291)
5. User's bed cooled in less than 2 minutes, so notification never fired

**Code Location:**
- File: `src/services/TemperatureMonitoringService.ts`
- Lines 287-291: Minimum cool time check
- Line 44: Check interval configuration (30 seconds)
- Line 46: Minimum cool time configuration (2 minutes)

### Spoolman Integration Issue

**Current Flow:**
1. While printing: DualAPIBackend returns EstLength/EstWeight from 5M API ✅
2. Print completes: State becomes "Completed"
3. Backend clears or stops returning EstLength/EstWeight (becomes 0) ❌
4. PrinterDataTransformer.extractCurrentJob() extracts 0 for filament data ❌
5. Printer cools → "printer-cooled" event fires with status containing 0 usage ❌
6. SpoolmanUsageTracker.updateSpoolmanUsage() receives 0 values ❌
7. Check on line 214-217 fails: No weight OR length > 0 ❌
8. Returns early with warning: "No filament usage recorded for this print" ❌
9. Spoolman never receives update ❌

**Code Location:**
- File: `src/printer-backends/DualAPIBackend.ts`
- Lines 270-271: EstLength/EstWeight extraction from API
- No caching mechanism exists

**Why This Matters:**
- PrinterDataTransformer DOES try to preserve job data for "Completed" state (line 207)
- But it extracts filament usage from the CURRENT backend response (which is now 0)
- Need to cache the LAST KNOWN filament usage while printing

## Implementation Plan

### Change 1: Fix Temperature Monitoring

**File:** `src/services/TemperatureMonitoringService.ts`

#### 1A: Reduce Check Interval (30s → 10s)

**Location:** Line 44

**Current:**
```typescript
checkIntervalMs: 30 * 1000, // Check every 30 seconds
```

**New:**
```typescript
checkIntervalMs: 10 * 1000, // Check every 10 seconds
```

**Reason:** Faster response time for "printer cooled" notifications

#### 1B: Remove Minimum Cool Time Check

**Location:** Lines 287-291

**Current:**
```typescript
// Check minimum cool time has passed
const timeSincePrintComplete = Date.now() - this.state.printCompleteTime.getTime();
if (timeSincePrintComplete < this.config.minimumCoolTime) {
  return;
}
```

**New:** Delete lines 287-291 entirely

**Reason:** No need to wait before checking temperature - just check immediately and wait for threshold

**Note:** Do NOT change line 46 (minimumCoolTime config definition) - just remove the check that uses it

---

### Change 2: Backend-Level Filament Usage Caching

**File:** `src/printer-backends/DualAPIBackend.ts`

#### 2A: Add Cache Property

**Location:** After line 20 (in class properties section)

**Add:**
```typescript
/**
 * Cache for last known filament usage data while printing
 * Preserved when print completes so Spoolman can deduct usage
 * Cleared when state returns to Ready or new print starts
 */
private lastFilamentUsageCache: {
  estimatedRightLen: number;
  estimatedRightWeight: number;
  currentJob: string;
  cachedAt: Date;
} | null = null;
```

**Reason:** Per-instance storage for filament usage data (multi-printer safe)

#### 2B: Cache Logic in getPrinterStatus()

**Location:** After line 271 (after extracting EstLength/EstWeight)

**Add caching logic:**
```typescript
// Extract current values
const estimatedRightLen = machineInfo?.EstLength || 0;
const estimatedRightWeight = machineInfo?.EstWeight || 0;
const currentJob = machineInfo?.PrintFileName;

// Cache filament usage while actively printing
if ((status === 'printing' || status === 'paused') &&
    currentJob &&
    (estimatedRightLen > 0 || estimatedRightWeight > 0)) {
  this.lastFilamentUsageCache = {
    estimatedRightLen,
    estimatedRightWeight,
    currentJob,
    cachedAt: new Date()
  };
}

// Use cached values when print is completed
let finalEstimatedRightLen = estimatedRightLen;
let finalEstimatedRightWeight = estimatedRightWeight;

if (status === 'completed' && this.lastFilamentUsageCache) {
  // Verify cache matches current job
  if (this.lastFilamentUsageCache.currentJob === currentJob) {
    finalEstimatedRightLen = this.lastFilamentUsageCache.estimatedRightLen;
    finalEstimatedRightWeight = this.lastFilamentUsageCache.estimatedRightWeight;
    console.log(`[DualAPIBackend] Using cached filament usage for completed print: ${finalEstimatedRightWeight}g, ${finalEstimatedRightLen}mm`);
  }
}

// Clear cache when returning to ready or new print starts
if (status === 'ready' ||
    (status === 'printing' && currentJob && this.lastFilamentUsageCache?.currentJob !== currentJob)) {
  console.log('[DualAPIBackend] Clearing filament usage cache');
  this.lastFilamentUsageCache = null;
}
```

#### 2C: Update Status Object

**Location:** Lines 270-271

**Current:**
```typescript
estimatedRightLen: machineInfo?.EstLength || 0,
estimatedRightWeight: machineInfo?.EstWeight || 0,
```

**New:**
```typescript
estimatedRightLen: finalEstimatedRightLen,
estimatedRightWeight: finalEstimatedRightWeight,
```

**Reason:** Use cached values when available

#### 2D: Clear Cache on Disconnect

**Location:** In disconnect() method (if it exists) or connection error handling

**Add:**
```typescript
// Clear filament usage cache on disconnect
this.lastFilamentUsageCache = null;
```

**Reason:** Ensure cache doesn't persist across connections

---

## Multi-Printer Support

Both changes are **already multi-printer safe**:

1. **Temperature Monitoring:**
   - Each context has its own TemperatureMonitoringService instance
   - Managed by MultiContextTemperatureMonitor
   - Per-context state tracking
   - No shared state between contexts

2. **Filament Usage Caching:**
   - Cache is an instance property (not static/global)
   - Each printer connection has its own DualAPIBackend instance
   - Each backend maintains its own cache
   - No cross-contamination between printers

## Testing Checklist

After implementation, verify:

1. **Temperature Monitoring:**
   - [ ] Print completes → monitoring starts immediately
   - [ ] Temperature is checked every 10 seconds
   - [ ] "Print cooled" notification fires when bed ≤35°C
   - [ ] Works with emulator (simulated temperature drop)
   - [ ] Works with real printer

2. **Spoolman Integration:**
   - [ ] Active spool is set before print
   - [ ] Print completes with filament usage shown in UI
   - [ ] Stats remain visible after state → "Completed"
   - [ ] Bed cools below threshold
   - [ ] "Print cooled" notification appears
   - [ ] Spoolman weight is deducted correctly
   - [ ] Check Spoolman logs for update API call

3. **Multi-Printer:**
   - [ ] Connect two printers simultaneously
   - [ ] Start prints on both
   - [ ] Verify each gets independent temperature monitoring
   - [ ] Verify each tracks its own filament usage
   - [ ] Complete one print → verify its Spoolman deduction
   - [ ] Complete other print → verify its Spoolman deduction
   - [ ] Ensure no cross-contamination of data

4. **Edge Cases:**
   - [ ] Print completes → immediately start new print (cache clears)
   - [ ] Print completes → disconnect before cooling (cache clears)
   - [ ] Print completes → reconnect printer (new cache)
   - [ ] Multiple prints in sequence on same printer

## Files Modified

1. `src/services/TemperatureMonitoringService.ts` - Temperature monitoring fixes
2. `src/printer-backends/DualAPIBackend.ts` - Filament usage caching

**No changes needed:**
- `src/printer-backends/GenericLegacyBackend.ts` - Doesn't report filament usage
- `src/services/SpoolmanUsageTracker.ts` - Already correct
- `src/services/PrinterDataTransformer.ts` - Already correct
- Multi-context coordinators - Already correct

## Expected Outcome

1. ✅ Temperature monitoring starts immediately after print completes
2. ✅ Temperature checked every 10 seconds
3. ✅ "Print cooled" notification fires as soon as bed ≤35°C
4. ✅ Filament usage data preserved after completion
5. ✅ Spoolman receives correct weight/length and deducts properly
6. ✅ Works correctly with multiple simultaneous printer connections
7. ✅ Stats remain visible in UI after print completion

## Notes

- The temperature threshold is set to 35°C (COOLED_TEMPERATURE_THRESHOLD on line 38)
- The 2-minute delay was preventing notifications for prints that cool quickly
- The backend returns zero filament data after completion, so caching is required
- Active spool persistence was already working correctly - this was not the issue
