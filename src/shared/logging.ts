/**
 * @fileoverview Shared logging utilities for gating verbose console output.
 *
 * Provides helpers for feature-flagged verbose logging across both the main
 * and renderer processes. The helpers read from environment variables or a
 * global runtime flag so developers can opt into detailed tracing without
 * spamming release builds.
 */

type VerboseFlagContainer = {
  FLASHFORGE_VERBOSE_LOGGING?: boolean;
};

let cachedVerboseFlag: boolean | null = null;

/**
 * Resolve whether verbose logging is enabled.
 *
 * Looks for the FLASHFORGE_VERBOSE_LOGGING environment variable (truthy values
 * of "true" or "1") or a globalThis flag. Results are cached for subsequent
 * calls to avoid repeated environment lookups.
 */
function resolveVerboseLoggingFlag(): boolean {
  if (cachedVerboseFlag !== null) {
    return cachedVerboseFlag;
  }

  const envFlag =
    typeof process !== 'undefined' &&
    typeof process.env?.FLASHFORGE_VERBOSE_LOGGING === 'string' &&
    process.env.FLASHFORGE_VERBOSE_LOGGING.toLowerCase();

  if (envFlag === 'true' || envFlag === '1') {
    cachedVerboseFlag = true;
    return cachedVerboseFlag;
  }

  const globalFlag =
    typeof globalThis !== 'undefined' &&
    (globalThis as VerboseFlagContainer).FLASHFORGE_VERBOSE_LOGGING;

  cachedVerboseFlag = globalFlag === true;
  return cachedVerboseFlag;
}


/**
 * Emits a verbose log statement when the verbose flag is enabled.
 *
 * @param namespace Identifier for the caller (e.g., component/service name)
 * @param message Message to log
 * @param args Optional args forwarded to console.debug
 */
export function logVerbose(
  namespace: string,
  message: string,
  ...args: unknown[]
): void {
  if (!resolveVerboseLoggingFlag()) {
    return;
  }

  if (args.length > 0) {
    console.debug(`[${namespace}] ${message}`, ...args);
  } else {
    console.debug(`[${namespace}] ${message}`);
  }
}

