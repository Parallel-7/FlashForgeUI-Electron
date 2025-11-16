/**
 * @fileoverview Rounded UI compatibility helpers for platform-aware UI enforcement.
 *
 * Centralizes logic for determining whether the Rounded UI experiment can run on the
 * current platform, ensuring every window configuration uses the same compatibility
 * checks. Prevents duplicate platform-specific heuristics by exposing a small API:
 * - isRoundedUISupported(): boolean flag for current process/platform
 * - getRoundedUIUnsupportedReason(): identifies why Rounded UI is blocked
 * - getRoundedUISupportInfo(): structured object for IPC responses
 *
 * Rounded UI is currently disabled on:
 * - macOS: custom title bar conflicts with traffic light controls
 * - Windows 11 (build >= 22000): OS already applies rounded chrome that clashes with ours
 */

import * as os from 'os';

const WINDOWS_11_BUILD_NUMBER = 22000;

/**
 * Reasons Rounded UI is blocked.
 */
export type RoundedUIUnsupportedReason = 'macos' | 'windows11';

/**
 * IPC-friendly payload describing Rounded UI availability.
 */
export interface RoundedUISupportInfo {
  readonly supported: boolean;
  readonly reason: RoundedUIUnsupportedReason | null;
}

/**
 * Parse the Windows build number from Electron's system version string.
 */
const getWindowsBuildNumber = (): number => {
  if (process.platform !== 'win32') {
    return 0;
  }

  const electronProcess = process as NodeJS.Process & { getSystemVersion?: () => string };
  const version =
    typeof electronProcess.getSystemVersion === 'function'
      ? electronProcess.getSystemVersion()
      : os.release();

  const buildSegment = version.split('.')[2] ?? version.split('.')[1] ?? '0';
  const buildNumber = Number.parseInt(buildSegment, 10);
  return Number.isFinite(buildNumber) ? buildNumber : 0;
};

/**
 * Determine if the process is running on macOS.
 */
const isMacOS = (): boolean => process.platform === 'darwin';

/**
 * Determine if the process is running on Windows 11 or later.
 */
const isWindows11OrLater = (): boolean => process.platform === 'win32' && getWindowsBuildNumber() >= WINDOWS_11_BUILD_NUMBER;

/**
 * Returns the reason Rounded UI is unsupported, if any.
 */
export const getRoundedUIUnsupportedReason = (): RoundedUIUnsupportedReason | null => {
  if (isMacOS()) {
    return 'macos';
  }

  if (isWindows11OrLater()) {
    return 'windows11';
  }

  return null;
};

/**
 * Returns true when Rounded UI can be enabled on the current platform.
 */
export const isRoundedUISupported = (): boolean => getRoundedUIUnsupportedReason() === null;

/**
 * Helper for IPC responses that need a structured summary.
 */
export const getRoundedUISupportInfo = (): RoundedUISupportInfo => ({
  supported: isRoundedUISupported(),
  reason: getRoundedUIUnsupportedReason()
});
