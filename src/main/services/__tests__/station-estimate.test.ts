/**
 * @fileoverview Unit tests for station-estimate capture helpers: per-tool
 * estimate resolution precedence (3mf filaments first, AD5X tool weight
 * fallback, unknown stays skipped).
 */

import type { ParseResult } from '@parallel-7/slicer-meta';
import { buildToolEstimates, toToolSlotMappings } from '../station-estimate';

function parseWith(filaments: { usedG?: string | null; usedM?: string | null }[]): ParseResult {
  return {
    threeMf: {
      printerModelId: 'Flashforge-creator-5',
      supportUsed: false,
      fileNames: ['benchy.3mf'],
      filaments: filaments.map((filament, index) => ({
        id: String(index + 1),
        type: 'PLA',
        color: '#000000',
        usedM: filament.usedM ?? null,
        usedG: filament.usedG ?? null,
      })),
      plateImage: null,
      warnings: [],
      firstLayerTime: null,
      nozzleDiameters: [0.4],
    },
  };
}

describe('buildToolEstimates', () => {
  const mappings = [
    { toolId: 0, slotId: 1 },
    { toolId: 1, slotId: 3 },
  ];

  it('uses 3mf per-filament values indexed by tool id', () => {
    const result = buildToolEstimates(mappings, parseWith([{ usedG: '11.28', usedM: '3.78' }, { usedG: '8.64', usedM: '2.88' }]));
    expect(result).toEqual([
      { toolId: 0, slotId: 1, usedG: 11.28, usedM: 3.78 },
      { toolId: 1, slotId: 3, usedG: 8.64, usedM: 2.88 },
    ]);
  });

  it('falls back to AD5X per-tool grams when the file lacks filament data', () => {
    const result = buildToolEstimates(mappings, parseWith([]), [
      { toolId: 0, filamentWeight: 15.5 },
      { toolId: 1, filamentWeight: 9.25 },
    ]);
    expect(result).toEqual([
      { toolId: 0, slotId: 1, usedG: 15.5, usedM: null },
      { toolId: 1, slotId: 3, usedG: 9.25, usedM: null },
    ]);
  });

  it('prefers 3mf grams over the AD5X fallback for the same tool', () => {
    const result = buildToolEstimates(
      mappings,
      parseWith([{ usedG: '11.28', usedM: '3.78' }]),
      [{ toolId: 0, filamentWeight: 99 }, { toolId: 1, filamentWeight: 8 }]
    );
    expect(result?.[0]?.usedG).toBe(11.28);
    expect(result?.[1]?.usedG).toBe(8);
  });

  it('keeps missing per-tool values unknown (never splits totals)', () => {
    const result = buildToolEstimates(mappings, parseWith([{ usedG: '20', usedM: '5' }]));
    expect(result?.[1]).toEqual({ toolId: 1, slotId: 3, usedG: null, usedM: null });
  });

  it('returns null when no source provides any estimate', () => {
    expect(buildToolEstimates(mappings, parseWith([]))).toBeNull();
    expect(buildToolEstimates(mappings, parseWith([{ usedG: null, usedM: null }]))).toBeNull();
  });

  it('ignores zero and negative estimates', () => {
    const result = buildToolEstimates(mappings, parseWith([{ usedG: '0', usedM: '-2' }]), [
      { toolId: 0, filamentWeight: 0 },
    ]);
    expect(result).toBeNull();
  });

  it('reads file-level filaments when 3mf filaments are absent', () => {
    const parsed: ParseResult = {
      file: {
        thumbnail: null,
        filamentUsedMM: 6663,
        filamentUsedG: 19.92,
        filamentType: 'PLA',
        printerModel: 'unknown',
        sliceSoft: 'Orca' as never,
        layerHeight: null,
        infillDensity: null,
        layerCount: null,
        filaments: [
          { id: '0', type: 'PLA', color: '#111111', usedM: '3.78', usedG: '11.28' },
          { id: '1', type: 'PLA', color: '#222222', usedM: '2.88', usedG: '8.64' },
        ],
      },
    };
    const result = buildToolEstimates(mappings, parsed);
    expect(result?.[1]?.usedG).toBe(8.64);
  });
});

describe('toToolSlotMappings', () => {
  it('copies mappings into readonly tool/slot pairs', () => {
    expect(toToolSlotMappings([{ toolId: 1, slotId: 2 }])).toEqual([{ toolId: 1, slotId: 2 }]);
  });
});
