/**
 * @fileoverview Centralized per-printer settings defaults and utilities.
 *
 * Provides a single source of truth for all per-printer setting default values,
 * ensuring consistent behavior across all code paths that create or load printer
 * details. This eliminates scattered default logic and prevents settings from
 * being undefined when loaded from storage.
 *
 * Key exports:
 * - PER_PRINTER_SETTINGS_DEFAULTS: Constant object with all default values
 * - applyPerPrinterDefaults(): Pure function to apply defaults to printer details
 * - hasMissingDefaults(): Check if any per-printer settings need defaults applied
 *
 * Usage:
 * ```typescript
 * import { applyPerPrinterDefaults, hasMissingDefaults } from '@shared/utils/printerSettingsDefaults.js';
 *
 * // Apply defaults to printer details loaded from storage
 * const detailsWithDefaults = applyPerPrinterDefaults(loadedDetails);
 *
 * // Check if save is needed after applying defaults
 * if (hasMissingDefaults(originalDetails)) {
 *   await savePrinter(detailsWithDefaults);
 * }
 * ```
 *
 * @module shared/utils/printerSettingsDefaults
 */

import type { PrinterDetails } from '../types/printer.js';

/**
 * Default values for all per-printer settings.
 * Used when settings are missing from stored data.
 *
 * These defaults match the expected behavior:
 * - Camera/LED features disabled by default
 * - WebUI enabled by default (matches WebUIManager fallback)
 * - RTSP settings tuned for balanced quality/performance
 * - FPS overlay disabled by default
 */
export const PER_PRINTER_SETTINGS_DEFAULTS = {
  customCameraEnabled: false,
  customCameraUrl: '',
  customLedsEnabled: false,
  forceLegacyMode: false,
  webUIEnabled: true,
  rtspFrameRate: 30,
  rtspQuality: 3,
  showCameraFps: false,
} as const;

/**
 * Non-const version of per-printer settings for function return types.
 * Uses standard types instead of literal types from `as const`.
 */
export interface PerPrinterSettings {
  customCameraEnabled: boolean;
  customCameraUrl: string;
  customLedsEnabled: boolean;
  forceLegacyMode: boolean;
  webUIEnabled: boolean;
  rtspFrameRate: number;
  rtspQuality: number;
  showCameraFps: boolean;
}

/**
 * Apply default values to any missing per-printer settings.
 * Pure function - does not mutate input.
 *
 * @param details - Printer details (may have missing optional fields)
 * @returns New object with all per-printer settings guaranteed to have values
 *
 * @example
 * ```typescript
 * const stored = { Name: 'Printer1', webUIEnabled: undefined };
 * const complete = applyPerPrinterDefaults(stored);
 * // complete.webUIEnabled === true (default applied)
 * ```
 */
export function applyPerPrinterDefaults<T extends Partial<PrinterDetails>>(details: T): T & PerPrinterSettings {
  return {
    ...details,
    customCameraEnabled: details.customCameraEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraEnabled,
    customCameraUrl: details.customCameraUrl ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraUrl,
    customLedsEnabled: details.customLedsEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customLedsEnabled,
    forceLegacyMode: details.forceLegacyMode ?? PER_PRINTER_SETTINGS_DEFAULTS.forceLegacyMode,
    webUIEnabled: details.webUIEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.webUIEnabled,
    rtspFrameRate: details.rtspFrameRate ?? PER_PRINTER_SETTINGS_DEFAULTS.rtspFrameRate,
    rtspQuality: details.rtspQuality ?? PER_PRINTER_SETTINGS_DEFAULTS.rtspQuality,
    showCameraFps: details.showCameraFps ?? PER_PRINTER_SETTINGS_DEFAULTS.showCameraFps,
  } as T & PerPrinterSettings;
}

/**
 * Check if any per-printer settings are missing defaults.
 * Useful for determining if save is needed after applying defaults.
 *
 * @param details - Printer details to check
 * @returns true if any per-printer setting is undefined
 *
 * @example
 * ```typescript
 * if (hasMissingDefaults(loadedDetails)) {
 *   const withDefaults = applyPerPrinterDefaults(loadedDetails);
 *   await savePrinter(withDefaults);
 * }
 * ```
 */
export function hasMissingDefaults(details: Partial<PrinterDetails>): boolean {
  return (
    details.customCameraEnabled === undefined ||
    details.customCameraUrl === undefined ||
    details.customLedsEnabled === undefined ||
    details.forceLegacyMode === undefined ||
    details.webUIEnabled === undefined ||
    details.rtspFrameRate === undefined ||
    details.rtspQuality === undefined ||
    details.showCameraFps === undefined
  );
}
