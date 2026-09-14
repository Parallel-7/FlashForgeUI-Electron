/**
 * @fileoverview Tracked/untracked indicator logic for stored-file prints on
 * material-station printers (AD5X with station).
 *
 * Mirrors the server-side capture rule in src/main/services/stored-file-estimate.ts
 * so the file modal can tell the user, before they start a printer-stored job,
 * whether Spoolman will track it:
 * - single material/tool + printer-reported weight + exactly one slot with a
 *   spool assigned → tracked;
 * - anything else → not tracked, with the shortest honest reason why.
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

/** Shared with the server's warn log (stored-file-estimate.ts). */
export const SPOOL_RESOLUTION_HINT =
  'assign exactly one spool to track printer-started jobs, or upload through the app for per-tool attribution';

const TRACKED_LABEL = 'Spoolman: tracked · single material';
const UPLOAD_HINT_LABEL = 'Spoolman: not tracked · upload via app for tracking';
const SPOOL_HINT_LABEL = 'Spoolman: not tracked · assign exactly one spool';

/**
 * Compute the tracking indicator for a stored file.
 *
 * @param job - File metadata from the jobs/local|recent list
 * @param options - Spoolman enablement, station support and the slot ids that
 *   currently have a spool assigned for the active context
 * @returns the hint to render, or null when tracking is not applicable
 */
export function describeStoredFileTracking(
  job: WebUIJobFile | undefined,
  options: {
    spoolmanEnabled: boolean;
    hasStation: boolean;
    assignedSpoolSlotIds: readonly number[];
  }
): StoredFileTrackingHint | null {
  if (!options.spoolmanEnabled || !options.hasStation) {
    return null;
  }

  // Only AD5X file metadata is rich enough; Creator 5 stored files are
  // upload-only and non-station printers use the single-spool flow.
  if (!isAD5XJobFile(job)) {
    return null;
  }

  const toolCount = job.toolCount ?? job.toolDatas.length;
  if (toolCount > 1 || job.toolDatas.length > 1) {
    return {
      tracked: false,
      label: UPLOAD_HINT_LABEL,
      tooltip: 'multi-material stored prints need an app upload for per-tool attribution',
    };
  }

  const totalWeight = job.totalFilamentWeight ?? 0;
  const singleToolWeight = job.toolDatas[0]?.filamentWeight ?? 0;
  if (!(totalWeight > 0) && !(singleToolWeight > 0)) {
    return {
      tracked: false,
      label: UPLOAD_HINT_LABEL,
      tooltip: 'the printer reports no filament weight for this file',
    };
  }

  if (options.assignedSpoolSlotIds.length !== 1) {
    return {
      tracked: false,
      label: SPOOL_HINT_LABEL,
      tooltip: SPOOL_RESOLUTION_HINT,
    };
  }

  return { tracked: true, label: TRACKED_LABEL };
}
