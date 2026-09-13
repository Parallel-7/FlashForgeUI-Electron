/**
 * @fileoverview Storage-key resolution for the station tracking stores.
 *
 * JobEstimateStore (including its exactly-once deduction ledger) and
 * SlotSpoolStore are keyed by PRINTER SERIAL, not by context id. Context ids
 * (`context-<counter>-<timestamp>`) are regenerated on every app restart and
 * whenever a printer is re-added, while the serial is stable for the physical
 * printer — so serial-keyed estimates, slot assignments and ledger entries
 * survive mid-print restarts and printer reconnects.
 *
 * The serial is resolved from `context.printerDetails` at call time. When it
 * is unavailable (context already gone, headless oddities), the context id is
 * used as a fallback key with a one-time warning; fallback-keyed data does
 * NOT survive restarts or reconnects.
 *
 * @module services/station-store-key
 */

import type { JobEstimateStore } from './JobEstimateStore';
import type { SlotSpoolStore } from './SlotSpoolStore';
import { getJobEstimateStore } from './JobEstimateStore';
import { getSlotSpoolStore } from './SlotSpoolStore';
import { getPrinterContextManager } from '../managers/PrinterContextManager';

/** Resolves a context id to its printer serial, or undefined when unknown. */
export type ContextSerialLookup = (contextId: string) => string | undefined;

const defaultSerialLookup: ContextSerialLookup = (contextId) => {
  const context = getPrinterContextManager().getContext(contextId);
  const serial = context?.printerDetails.SerialNumber?.trim();
  return serial ? serial : undefined;
};

/** Context ids already warned about for falling back to context-id keys. */
const warnedFallbackContexts = new Set<string>();

/** context id → serial resolved while that context was alive (for pruning). */
const resolvedSerials = new Map<string, string>();

/**
 * Storage key for a context's station tracking data: the printer serial when
 * resolvable, else the context id (warns once per context id).
 *
 * @param contextId - Printer context id
 * @param lookup - Serial lookup (injectable for tests; defaults to the
 *   PrinterContextManager-backed lookup)
 * @returns Store key for estimates, slot assignments and the ledger
 */
export function resolveStationStoreKey(
  contextId: string,
  lookup: ContextSerialLookup = defaultSerialLookup
): string {
  let serial: string | undefined;
  try {
    serial = lookup(contextId);
  } catch (error: unknown) {
    console.warn(
      `[station-store-key] Serial lookup failed for context ${contextId}:`,
      error
    );
  }

  if (serial) {
    resolvedSerials.set(contextId, serial);
    return serial;
  }

  if (!warnedFallbackContexts.has(contextId)) {
    warnedFallbackContexts.add(contextId);
    console.warn(
      `[station-store-key] No printer serial for context ${contextId}; keying station ` +
        'tracking by context id (records will NOT survive restarts/reconnects).'
    );
  }
  return contextId;
}

/**
 * Every store key a context may have written: the serial resolved while it
 * was alive (when one was seen) plus the context-id fallback. Used to prune
 * the stores when the context is removed.
 *
 * @param contextId - Printer context id
 * @returns De-duplicated candidate store keys
 */
export function stationStoreKeysForContext(contextId: string): string[] {
  const keys = [resolvedSerials.get(contextId), contextId].filter(
    (key): key is string => typeof key === 'string' && key.length > 0
  );
  return [...new Set(keys)];
}

/** Forget a removed context's cached serial resolution and warning state. */
export function forgetStationContext(contextId: string): void {
  resolvedSerials.delete(contextId);
  warnedFallbackContexts.delete(contextId);
}

/** Store surface needed by {@link pruneStationStores}. */
export interface StationStorePruneTargets {
  readonly estimates: Pick<JobEstimateStore, 'clearContext'>;
  readonly slots: Pick<SlotSpoolStore, 'clearContext'>;
}

/**
 * Drop a removed context's station tracking data (estimates + ledger and
 * slot→spool assignments) from both stores, under every key the context may
 * have used, then forget the context's cached resolution.
 *
 * Callers pass explicit targets in tests; the default targets are the
 * process-wide store singletons.
 *
 * @param contextId - Printer context id being removed
 * @param targets - Stores to prune (defaults to the singletons)
 */
export function pruneStationStores(contextId: string, targets?: StationStorePruneTargets): void {
  const { estimates, slots } =
    targets ?? { estimates: getJobEstimateStore(), slots: getSlotSpoolStore() };

  let pruned = false;
  for (const key of stationStoreKeysForContext(contextId)) {
    pruned = estimates.clearContext(key) || pruned;
    pruned = slots.clearContext(key) || pruned;
  }
  forgetStationContext(contextId);

  if (pruned) {
    console.log(
      `[station-store-key] Pruned station tracking data for removed context ${contextId}.`
    );
  }
}
