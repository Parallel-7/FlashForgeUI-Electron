/**
 * @fileoverview Tests for the browser-side stored-file tracking indicator.
 *
 * `describeStoredFileTracking` mirrors the server-side rule
 * (src/main/services/job-tracking.ts) for the file modal: a multi-material file with
 * printer-reported weights opens the matching dialog, where spools are
 * chosen, so it can be tracked; a single-material file is not tracked.
 * The predicate is duplicated across bundles on purpose; change both.
 */

import { describe, expect, it } from '@jest/globals';
import type { AD5XToolData, WebUIJobFile } from '../../app';
import { describeStoredFileTracking } from '../stored-file-tracking';

const TRACKED = { spoolmanEnabled: true, hasStation: true };

function tool(toolId: number, filamentWeight: number): AD5XToolData {
  return { toolId, filamentWeight, materialName: 'PLA', materialColor: '#ffffff' };
}

function ad5xFile(overrides: Partial<WebUIJobFile> = {}): WebUIJobFile {
  return {
    fileName: 'stored-single.3mf',
    displayName: 'stored-single.3mf',
    metadataType: 'ad5x',
    toolCount: 1,
    toolDatas: [],
    totalFilamentWeight: 130,
    ...overrides,
  };
}

describe('describeStoredFileTracking', () => {
  it('shows nothing when Spoolman is disabled', () => {
    expect(
      describeStoredFileTracking(ad5xFile(), { ...TRACKED, spoolmanEnabled: false })
    ).toBeNull();
  });

  it('shows nothing for printers without a material station', () => {
    expect(describeStoredFileTracking(ad5xFile(), { ...TRACKED, hasStation: false })).toBeNull();
  });

  it('shows nothing for files without AD5X metadata (Creator 5 upload-only)', () => {
    expect(
      describeStoredFileTracking(ad5xFile({ metadataType: 'basic', toolDatas: undefined }), TRACKED)
    ).toBeNull();
  });

  it('marks single-material files as not tracked', () => {
    const hint = describeStoredFileTracking(ad5xFile({ toolDatas: [tool(0, 40)] }), TRACKED);
    expect(hint?.tracked).toBe(false);
    expect(hint?.label).toContain('upload via app');
  });

  it('marks multi-material files with weights as trackable through the dialog', () => {
    const hint = describeStoredFileTracking(
      ad5xFile({ toolCount: 2, toolDatas: [tool(0, 60), tool(1, 70)] }),
      TRACKED
    );
    expect(hint).toEqual({ tracked: true, label: 'Spoolman: choose spools when you match materials' });
  });

  it('marks multi-material files without weights as not tracked', () => {
    const hint = describeStoredFileTracking(
      ad5xFile({ toolCount: 2, toolDatas: [tool(0, 0), tool(1, 0)] }),
      TRACKED
    );
    expect(hint?.tracked).toBe(false);
    expect(hint?.tooltip).toContain('no filament weight');
  });
});
