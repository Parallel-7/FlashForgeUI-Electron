/**
 * @fileoverview Shared logging utilities for gating verbose console output
 *
 * Provides helpers for feature-flagged verbose logging across both the main
 * and renderer processes. The verbose flag is controlled by:
 * - Config setting (DebugMode) - primary control
 * - CLI arguments (--debug) - for headless mode override
 * - Global runtime flag - set by main process for cross-process coordination
 *
 * In the main process, console output (including logVerbose) is mirrored to
 * the console log file by DebugLogService's console capture when debug mode
 * is enabled. Renderer-process output is not captured to file.
 *
 * @module shared/logging
 */

type VerboseFlagContainer = {
  FLASHFORGE_DEBUG_MODE?: boolean;
};

let cachedVerboseFlag: boolean | null = null;

/**
 * Set the debug mode flag globally
 * Called from main process after reading config/CLI arguments
 */
export function setDebugModeEnabled(enabled: boolean): void {
  if (typeof globalThis !== 'undefined') {
    (globalThis as VerboseFlagContainer).FLASHFORGE_DEBUG_MODE = enabled;
  }
  cachedVerboseFlag = enabled;
}

/**
 * Clear the cached flag to force re-evaluation
 * Call this when config changes
 */
export function clearDebugModeCache(): void {
  cachedVerboseFlag = null;
}

/**
 * Resolve whether verbose logging is enabled
 *
 * Checks the global flag that is set by the main process based on
 * config settings and CLI arguments. Results are cached for performance.
 */
export function resolveVerboseLoggingFlag(): boolean {
  if (cachedVerboseFlag !== null) {
    return cachedVerboseFlag;
  }

  // Check global flag set by main process
  const globalFlag = typeof globalThis !== 'undefined' && (globalThis as VerboseFlagContainer).FLASHFORGE_DEBUG_MODE;

  cachedVerboseFlag = globalFlag === true;
  return cachedVerboseFlag;
}

/**
 * Emits a verbose log statement when the verbose flag is enabled
 *
 * @param namespace Identifier for the caller (e.g., component/service name)
 * @param message Message to log
 * @param args Optional args forwarded to console.debug
 */
export function logVerbose(namespace: string, message: string, ...args: unknown[]): void {
  if (!resolveVerboseLoggingFlag()) {
    return;
  }

  if (args.length > 0) {
    console.debug(`[${namespace}] ${message}`, ...args);
  } else {
    console.debug(`[${namespace}] ${message}`);
  }
}
