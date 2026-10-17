/**
 * @fileoverview Tracked/untracked indicator for stored-file prints on
 * material-station printers (AD5X with station).
 *
 * Mirrors the server-side rule in src/main/services/job-tracking.ts so the file modal
 * can tell the user, before they start a job stored on the printer, whether
 * Spoolman will track it:
 * - a multi-material file opens the matching dialog, where the user picks a
 *   spool per tool, so it can be tracked;
 * - a single-material file starts without the dialog, so it is not tracked.
 *
 * The two run in separate bundles, so the predicate is duplicated on purpose
 * (same situation as isPrintAdvancing); change both together.
 */

import type { WebUIJobFile } from '../app.js';
import { isAD5XJobFile } from './formatting.js';

/** Rendered indicator for one stored file. Null = show nothing. */
export interface StoredFileTrackingHint {
  readonly tracked: boolean;
  readonly label: string;
  readonly tooltip?: string;
}

const TRACKABLE_LABEL = 'Spoolman: choose spools when you match materials';
const UNTRACKED_LABEL = 'Spoolman: not tracked · upload via app for tracking';

/**
 * Compute the tracking indicator for a stored file.
 *
 * @param job - File metadata from the jobs/local|recent list
 * @param options - Spoolman enablement and station support for the context
 * @returns the hint to render, or null when tracking is not applicable
 */
export function describeStoredFileTracking(
  job: WebUIJobFile | undefined,
  options: {
    spoolmanEnabled: boolean;
    hasStation: boolean;
  }
): StoredFileTrackingHint | null {
  if (!options.spoolmanEnabled || !options.hasStation) {
    return null;
  }

  // Only AD5X file metadata is rich enough; Creator 5 stored files cannot be
  // started from the app and non-station printers use the single-spool flow.
  if (!isAD5XJobFile(job)) {
    return null;
  }

  const toolCount = job.toolCount ?? job.toolDatas.length;
  if (toolCount > 1 || job.toolDatas.length > 1) {
    const weighed = job.toolDatas.some((tool) => tool.filamentWeight > 0);
    return weighed
      ? { tracked: true, label: TRACKABLE_LABEL }
      : {
          tracked: false,
          label: UNTRACKED_LABEL,
          tooltip: 'the printer reports no filament weight for this file',
        };
  }

  return {
    tracked: false,
    label: UNTRACKED_LABEL,
    tooltip: 'single-material files start without the matching dialog, so no spool is chosen',
  };
}
