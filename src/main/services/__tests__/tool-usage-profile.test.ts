/**
 * @fileoverview Unit tests for the per-tool usage profile: gcode extrusion
 * sums (relative and absolute extrusion, G92 resets, retractions, comments,
 * tool changes, chunk boundaries), curve interpolation, and a full read of a
 * real sliced 3MF whose expected values come from the fixture generator.
 */

import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildToolUsageProfile,
  ToolExtrusionAccumulator,
  usedFractionAt,
} from '../tool-usage-profile';

const FIXTURES = path.resolve(__dirname, '../../../../tests/fixtures/print-files');

function profileOf(gcode: string, sampleCount = 4, chunkSize = 7) {
  const bytes = Buffer.from(gcode, 'latin1');
  const accumulator = new ToolExtrusionAccumulator(bytes.length, 0, sampleCount);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    accumulator.push(bytes.subarray(offset, offset + chunkSize));
  }
  return accumulator.finish();
}

/** Fixed-width lines so byte positions are easy to reason about. */
const LINE = (e: string) => `G1 X1 E${e}\n`.padEnd(16, ' ');

describe('ToolExtrusionAccumulator', () => {
  it('splits relative extrusion between tools by byte position', () => {
    const gcode = `${LINE('1')}${LINE('1')}T1\n${LINE('1')}${LINE('1')}`;
    const profile = profileOf(gcode);
    expect(Object.keys(profile.perTool).sort()).toEqual(['0', '1']);
    expect(profile.perTool['0'][4]).toBe(1);
    expect(profile.perTool['1'][4]).toBe(1);
    expect(profile.perTool['0'][2]).toBe(1);
    expect(profile.perTool['1'][1]).toBe(0);
  });

  it('handles absolute extrusion with G92 resets', () => {
    const gcode = ['M82', 'G92 E0', 'G1 X1 E5', 'G1 X2 E10', 'G92 E0', 'T3', 'G1 X3 E4', ''].join('\n');
    const profile = profileOf(gcode, 2);
    expect(profile.perTool['0'][2]).toBe(1);
    expect(profile.perTool['3'][2]).toBe(1);
  });

  it('nets out retractions and ignores comments and other commands', () => {
    const gcode = [
      'M83 ; relative',
      'G1 E-0.8 ; retract',
      'G1 E0.8 ; unretract',
      'G1 X5 E2.5 ; print',
      '; G1 E100 commented out',
      'M104 S200',
      'G28',
      '',
    ].join('\n');
    const profile = profileOf(gcode, 2);
    expect(profile.perTool['0'][2]).toBe(1);
  });

  it('leaves out tools that never extrude', () => {
    const profile = profileOf(['T1', 'G1 X1 Y1', 'T0', 'G1 E3', ''].join('\n'), 2);
    expect(Object.keys(profile.perTool)).toEqual(['0']);
  });
});

describe('usedFractionAt', () => {
  const profile = { sampleCount: 4, perTool: { '0': [0, 0.5, 1, 1, 1], '2': [0, 0, 0, 0.5, 1] } };

  it('interpolates between samples', () => {
    expect(usedFractionAt(profile, 0, 40)).toBeCloseTo(0.8);
    expect(usedFractionAt(profile, 2, 40)).toBe(0);
    expect(usedFractionAt(profile, 2, 87.5)).toBeCloseTo(0.75);
    expect(usedFractionAt(profile, 0, 100)).toBe(1);
  });

  it('falls back to the plain progress fraction without a curve', () => {
    expect(usedFractionAt(null, 0, 40)).toBeCloseTo(0.4);
    expect(usedFractionAt(profile, 1, 40)).toBeCloseTo(0.4);
  });

  it('clamps progress to 0-100', () => {
    expect(usedFractionAt(null, 0, 140)).toBe(1);
    expect(usedFractionAt(null, 0, -5)).toBe(0);
  });
});

describe('buildToolUsageProfile', () => {
  it('reads the embedded gcode of a real 3MF', async () => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, 'two-tool-toolchange.expected.json'), 'utf8')
    ) as { tools: Record<string, { usedG: number; gramsAt40: number; gramsAt75: number }> };

    const profile = await buildToolUsageProfile(path.join(FIXTURES, 'two-tool-toolchange.3mf'), 0);
    expect(profile).not.toBeNull();
    expect(Object.keys(profile?.perTool ?? {}).sort()).toEqual(['0', '2']);

    for (const [toolId, tool] of Object.entries(expected.tools)) {
      for (const percent of [40, 75] as const) {
        const grams = tool.usedG * usedFractionAt(profile, Number(toolId), percent);
        const expectedGrams = percent === 40 ? tool.gramsAt40 : tool.gramsAt75;
        expect(Math.abs(grams - expectedGrams)).toBeLessThan(0.05);
      }
    }
  });

  it('returns null for a 3MF without gcode', async () => {
    const profile = await buildToolUsageProfile(path.join(FIXTURES, 'creator5-two-tool.3mf'), 0);
    // This fixture has gcode but no tool change: everything is tool 0.
    expect(Object.keys(profile?.perTool ?? {})).toEqual(['0']);
  });

  it('rejects a file that is not a ZIP archive', async () => {
    await expect(
      buildToolUsageProfile(path.join(FIXTURES, 'adventurer5m-single-color.gcode'), 0)
    ).rejects.toThrow(/ZIP/);
  });
});
