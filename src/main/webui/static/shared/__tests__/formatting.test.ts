/**
 * @fileoverview Jest coverage for shared WebUI formatting helpers.
 *
 * Verifies time, ETA, lifetime counter, and AD5X material-formatting helpers
 * used across the static WebUI panels and job displays.
 */
/**
 * @fileoverview Tests for shared WebUI formatting helpers covering time, ETA,
 * material matching, and multi-color job utility behavior.
 */

import {
  buildMaterialBadgeTooltip,
  colorsDiffer,
  formatCompletionTime,
  formatElapsedSeconds,
  isPrintAdvancing,
  formatJobPrintingTime,
  formatLifetimeFilament,
  formatLifetimePrintTime,
  formatTime,
  isAD5XJobFile,
  isMultiColorJobFile,
  materialsMatch,
  normalizeMaterialString,
} from '../formatting.js';

describe('webui formatting helpers', () => {
  it('identifies AD5X and multi-color job metadata', () => {
    const ad5xJob = {
      metadataType: 'ad5x',
      toolDatas: [
        { toolId: 0, materialName: 'PLA', materialColor: 'Red' },
        { toolId: 1, materialName: 'PETG', materialColor: 'Blue' },
      ],
    } as any;
    const legacyJob = {
      metadataType: 'legacy',
      toolDatas: [],
    } as any;

    expect(isAD5XJobFile(ad5xJob)).toBe(true);
    expect(isMultiColorJobFile(ad5xJob)).toBe(true);
    expect(isAD5XJobFile(legacyJob)).toBe(false);
    expect(isMultiColorJobFile(legacyJob)).toBe(false);
  });

  it('normalizes and compares material values safely', () => {
    expect(normalizeMaterialString('  PLA  ')).toBe('pla');
    expect(colorsDiffer('Red', ' red ')).toBe(false);
    expect(colorsDiffer('Red', 'Blue')).toBe(true);
    expect(colorsDiffer('', 'Blue')).toBe(false);
    expect(materialsMatch('PETG', ' petg ')).toBe(true);
    expect(materialsMatch('PETG', 'PLA')).toBe(false);
    expect(materialsMatch('', 'PLA')).toBe(false);
  });

  it('builds tooltips for multi-material jobs and falls back for non-AD5X files', () => {
    const ad5xJob = {
      metadataType: 'ad5x',
      toolDatas: [
        { toolId: 0, materialName: 'PLA' },
        { toolId: 1, materialName: 'ABS' },
      ],
    } as any;
    const genericJob = {
      metadataType: 'legacy',
      toolDatas: [],
    } as any;

    expect(buildMaterialBadgeTooltip(ad5xJob)).toBe('Requires material station\nTool 1: PLA\nTool 2: ABS');
    expect(buildMaterialBadgeTooltip(genericJob)).toBe('Multi-color job');
  });

  it('formats printing durations and lifetime counters for display', () => {
    expect(formatJobPrintingTime()).toBe('');
    expect(formatJobPrintingTime(1)).toBe('1s');
    expect(formatJobPrintingTime(45)).toBe('1m');
    expect(formatJobPrintingTime(3599)).toBe('1h');
    expect(formatJobPrintingTime(3660)).toBe('1h 1m');
    expect(formatTime(5)).toBe('5:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatLifetimePrintTime(0)).toBe('--');
    expect(formatLifetimePrintTime(59)).toBe('59m');
    expect(formatLifetimePrintTime(125)).toBe('2h 5m');
    expect(formatLifetimePrintTime(60_125)).toBe('1,002h 5m');
    expect(formatLifetimeFilament(0)).toBe('--');
    expect(formatLifetimeFilament(12.345)).toBe('12.35m');
  });

  it('formats elapsed time and completion timestamps for display', () => {
    expect(formatElapsedSeconds(59)).toBe('00:59');
    expect(formatElapsedSeconds(3_661)).toBe('1:01:01');

    // Fixed completion timestamp — no Date.now() dependency.
    const completion = new Date('2026-03-04T16:30:00.000Z');
    const expected = completion.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    expect(formatCompletionTime(completion)).toBe(expected);
    expect(formatCompletionTime(completion.toISOString())).toBe(expected);
    expect(formatCompletionTime(null)).toBe('--:--');
    expect(formatCompletionTime('not-a-date')).toBe('--:--');
  });

  // isPrintAdvancing gates wall-clock ETA displays. The firmware freezes
  // `estimatedTime` while the print is not progressing, and the library sets
  // CompletionTime to null in those states. 'Heating' is excluded too.
  it('reports print advancement only for states that count estimatedTime down', () => {
    expect(isPrintAdvancing('Printing')).toBe(true);

    for (const state of [
      'Heating',
      'Paused',
      'Pausing',
      'Ready',
      'Error',
      'Completed',
      'Cancelled',
      'Busy',
      'Calibrating',
    ]) {
      expect(isPrintAdvancing(state)).toBe(false);
    }
    expect(isPrintAdvancing(undefined)).toBe(false);
  });
});
