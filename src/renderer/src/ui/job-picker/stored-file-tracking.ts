/**
 * @fileoverview Tracked/untracked indicator for stored-file prints on
 * material-station printers (AD5X with station), desktop job-picker edition.
 *
 * Mirrors the main-process rule in src/main/services/job-tracking.ts so the
 * job picker can tell the user, before they start a job stored on the
 * printer, whether Spoolman will track it. The desktop picker opens the
 * matching dialog for every file with per-tool data, and the dialog asks for
 * a spool per tool, so such a file can be tracked. A file without per-tool
 * data or weights cannot.
 *
 * The webui static client keeps its own copy
 * (src/main/webui/static/shared/stored-file-tracking.ts) because the two run
 * in separate bundles; the predicate is duplicated on purpose (same situation
 * as isPrintAdvancing). Change all copies together.
 */

import type { AD5XJobInfo } from '@shared/types/printer-backend/backend-operations';

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
 * @param job - AD5X file metadata from the recent/local job list
 * @param options - Spoolman enablement and station support for the context
 * @returns the hint to render, or null when tracking is not applicable
 */
export function describeStoredFileTracking(
  job: AD5XJobInfo | undefined,
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
  if (!job || job._type !== 'ad5x') {
    return null;
  }

  const toolDatas = job.toolDatas ?? [];
  if (toolDatas.length === 0) {
    return {
      tracked: false,
      label: UNTRACKED_LABEL,
      tooltip: 'the printer reports no per-tool data for this file',
    };
  }
  if (!toolDatas.some((tool) => tool.filamentWeight > 0)) {
    return {
      tracked: false,
      label: UNTRACKED_LABEL,
      tooltip: 'the printer reports no filament weight for this file',
    };
  }
  return { tracked: true, label: TRACKABLE_LABEL };
}
