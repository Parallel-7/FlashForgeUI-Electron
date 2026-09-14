/**
 * @fileoverview Tests for the browser-side stored-file tracking indicator.
 *
 * `describeStoredFileTracking` mirrors the server-side capture rule
 * (src/main/services/stored-file-estimate.ts) for the file modal: single material +
 * printer-reported weight + exactly one slot with an assigned spool →
 * tracked; anything else → not tracked with the shortest honest reason.
 * The predicate is duplicated across bundles on purpose; change both.
 */

import type { AD5XToolData, WebUIJobFile } from '../../app.js';
import { describeStoredFileTracking } from '../stored-file-tracking.js';

const TRACKED = { spoolmanEnabled: true, hasStation: true, assignedSpoolSlotIds: [1] };

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
    expect(describeStoredFileTracking(ad5xFile(), { ...TRACKED, spoolmanEnabled: false })).toBeNull();
  });

  it('shows nothing for printers without a material station', () => {
    expect(describeStoredFileTracking(ad5xFile(), { ...TRACKED, hasStation: false })).toBeNull();
  });

  it('shows nothing for files without AD5X metadata (Creator 5 upload-only)', () => {
    expect(describeStoredFileTracking(ad5xFile({ metadataType: 'basic', toolDatas: undefined }), TRACKED)).toBeNull();
  });

  it('marks single-material files with one assigned spool as tracked', () => {
    const hint = describeStoredFileTracking(ad5xFile(), TRACKED);
    expect(hint).toEqual({ tracked: true, label: 'Spoolman: tracked · single material' });
  });

  it('falls back to the single tool weight when the total is missing', () => {
    const hint = describeStoredFileTracking(
      ad5xFile({ totalFilamentWeight: undefined, toolDatas: [tool(0, 40)] }),
      TRACKED
    );
    expect(hint?.tracked).toBe(true);
  });

  it('points multi-material files to the app upload path', () => {
    const hint = describeStoredFileTracking(ad5xFile({ toolCount: 2, toolDatas: [tool(0, 60), tool(1, 70)] }), TRACKED);
    expect(hint?.tracked).toBe(false);
    expect(hint?.label).toContain('upload via app');
  });

  it('points weightless files to the app upload path', () => {
    const hint = describeStoredFileTracking(ad5xFile({ totalFilamentWeight: 0 }), TRACKED);
    expect(hint?.tracked).toBe(false);
    expect(hint?.label).toContain('upload via app');
  });

  it('asks for exactly one spool when none is assigned', () => {
    const hint = describeStoredFileTracking(ad5xFile(), { ...TRACKED, assignedSpoolSlotIds: [] });
    expect(hint?.tracked).toBe(false);
    expect(hint?.label).toContain('assign exactly one spool');
    expect(hint?.tooltip).toContain('assign exactly one spool');
  });

  it('asks for exactly one spool when several are assigned', () => {
    const hint = describeStoredFileTracking(ad5xFile(), {
      ...TRACKED,
      assignedSpoolSlotIds: [1, 2],
    });
    expect(hint?.tracked).toBe(false);
    expect(hint?.label).toContain('assign exactly one spool');
  });
});
