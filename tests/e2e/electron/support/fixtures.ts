/**
 * @fileoverview Locates the print files the upload specs feed to FlashForgeUI.
 *
 * Files live in-repo under tests/fixtures/print-files so a run never depends on a
 * sibling checkout. They are real slicer output, not synthetic stubs, because the
 * upload path parses embedded metadata (and, for 3MF, per-tool filament data) - a
 * hand-written file would exercise none of that.
 *
 * Key exports:
 * - PRINT_FIXTURES: the available files and what each is for
 * - resolveFixture(): absolute path, asserting the file exists
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.resolve(process.cwd(), 'tests', 'fixtures', 'print-files');

export interface PrintFixture {
  fileName: string;
  /** Name the file will have on the printer after upload. */
  remoteName: string;
  description: string;
  toolCount: number;
}

/*
 * Tool counts below were read from the parser, not from the upstream file names.
 * Those names are actively misleading: slicer-meta's "twocolors" 3MF records only one
 * filament with real usage, while its "pla-silk" 3MF records two (PLA + SILK). The
 * fixtures here are renamed after what the parser actually reports, because that is
 * what decides whether the material matching dialog appears.
 */
export const PRINT_FIXTURES = {
  /** One filament: the simplest 3MF an AD5X will accept. */
  ad5xSingleTool: {
    fileName: 'ad5x-single-tool.3mf',
    remoteName: 'ad5x-single-tool.3mf',
    description: 'AD5X 3MF with one filament (orca-flashforge 1.4.2)',
    toolCount: 1,
  },
  /** Two filaments: drives the multi-tool material matching path. */
  ad5xMultiTool: {
    fileName: 'ad5x-multi-tool.3mf',
    remoteName: 'ad5x-multi-tool.3mf',
    description: 'AD5X 3MF with two filaments, PLA + SILK (orca-flashforge 1.4.2)',
    toolCount: 2,
  },
  /** Plain single-colour gcode for 5M-series printers. */
  adventurer5mSingleColor: {
    fileName: 'adventurer5m-single-color.gcode',
    remoteName: 'adventurer5m-single-color.gcode',
    description: 'Adventurer 5M single-colour gcode (orca-flashforge 1.3.0)',
    toolCount: 1,
  },
} as const satisfies Record<string, PrintFixture>;

export const resolveFixture = (fixture: PrintFixture): string => {
  const fullPath = path.join(FIXTURE_DIR, fixture.fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`Print fixture missing: ${fullPath}. Expected "${fixture.description}".`);
  }
  return fullPath;
};

/**
 * Picks the simplest uploadable fixture for a target.
 *
 * Material-station printers (AD5X / Creator 5) only accept 3MF; everything else gets
 * plain single-colour gcode, which is what a 5M-series user actually uploads.
 */
export const simplestFixtureFor = (hasMaterialStation: boolean): PrintFixture =>
  hasMaterialStation ? PRINT_FIXTURES.ad5xSingleTool : PRINT_FIXTURES.adventurer5mSingleColor;
