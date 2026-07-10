/**
 * @fileoverview Main-process console capture for file-based logging
 *
 * Wraps the global console methods (log/info/warn/error/debug) so every line
 * printed to the terminal can also be mirrored into a log file. The wrappers
 * always write through to the original console methods first, then forward a
 * pre-formatted string (via util.format, matching Node console semantics) to
 * a sink callback. The sink is expected to be cheap and non-throwing; any
 * sink error is swallowed so logging can never break the app.
 *
 * Installed once by DebugLogService.initialize(). The originals are exposed
 * via getOriginalConsole() so internal logging paths (e.g. flush error
 * reporting) can bypass the capture and avoid feedback loops.
 *
 * Main process only - renderer console output is not captured here.
 *
 * @module utils/ConsoleCapture
 */

import * as util from 'util';

/** Console levels that are captured */
export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** Receives each captured console line, already formatted to a string */
export type ConsoleSink = (level: ConsoleLevel, message: string) => void;

type ConsoleMethod = (...args: unknown[]) => void;

const CONSOLE_LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

let originalMethods: Record<ConsoleLevel, ConsoleMethod> | null = null;

/**
 * Install console capture wrappers. Idempotent - subsequent calls are no-ops.
 *
 * @param sink Callback receiving each formatted console line
 */
export function installConsoleCapture(sink: ConsoleSink): void {
  if (originalMethods) {
    return;
  }

  const originals = {} as Record<ConsoleLevel, ConsoleMethod>;

  for (const level of CONSOLE_LEVELS) {
    const original = console[level].bind(console) as ConsoleMethod;
    originals[level] = original;

    console[level] = (...args: unknown[]): void => {
      original(...args);
      try {
        sink(level, util.format(...args));
      } catch {
        // Logging must never break the app - drop the line on sink failure
      }
    };
  }

  originalMethods = originals;
}

/**
 * Get the original (pre-capture) console methods, or null if capture is not
 * installed. Use these for logging from inside the capture sink's own write
 * path to avoid re-entering the capture.
 */
export function getOriginalConsole(): Record<ConsoleLevel, ConsoleMethod> | null {
  return originalMethods;
}
