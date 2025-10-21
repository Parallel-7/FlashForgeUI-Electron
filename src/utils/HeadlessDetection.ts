/**
 * @fileoverview Headless mode detection utility
 *
 * Simple flag to track whether the application is running in headless mode.
 * Used throughout the application to conditionally skip UI-dependent features.
 */

let headlessMode = false;

/**
 * Set the headless mode flag
 *
 * Should be called early in application initialization before any UI components are created.
 *
 * @param enabled True if running in headless mode
 */
export function setHeadlessMode(enabled: boolean): void {
  headlessMode = enabled;
}

/**
 * Check if application is running in headless mode
 *
 * @returns True if headless mode is enabled
 */
export function isHeadlessMode(): boolean {
  return headlessMode;
}

