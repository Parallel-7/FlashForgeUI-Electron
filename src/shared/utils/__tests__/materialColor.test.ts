/**
 * @fileoverview Unit coverage for material colour normalization.
 *
 * The cases here mirror real values observed on hardware: an AD5X reports slot colours
 * as raw config strings ("161616", "7C4B00") while others come back already prefixed
 * ("#F98D33"). ff-api rejects anything that is not '#RRGGBB' before sending, so both
 * forms have to converge.
 */

import {
  DEFAULT_MATERIAL_COLOR,
  normalizeMaterialColor,
  normalizeMaterialMappingColors,
} from '../materialColor';

describe('normalizeMaterialColor', () => {
  it('adds a missing leading hash', () => {
    expect(normalizeMaterialColor('161616')).toBe('#161616');
    expect(normalizeMaterialColor('7C4B00')).toBe('#7C4B00');
  });

  it('leaves an already-prefixed colour intact', () => {
    expect(normalizeMaterialColor('#F98D33')).toBe('#F98D33');
  });

  it('upper-cases so equal colours compare equal regardless of source casing', () => {
    expect(normalizeMaterialColor('#f98d33')).toBe('#F98D33');
    expect(normalizeMaterialColor('abcdef')).toBe('#ABCDEF');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeMaterialColor('  161616 ')).toBe('#161616');
  });

  it('keeps only the value before the first semicolon, as the AD5X config encodes it', () => {
    expect(normalizeMaterialColor('161616;PLA')).toBe('#161616');
    expect(normalizeMaterialColor('#F98D33;something')).toBe('#F98D33');
  });

  it('falls back when the colour is missing or unusable', () => {
    expect(normalizeMaterialColor(undefined)).toBe(DEFAULT_MATERIAL_COLOR);
    expect(normalizeMaterialColor(null)).toBe(DEFAULT_MATERIAL_COLOR);
    expect(normalizeMaterialColor('')).toBe(DEFAULT_MATERIAL_COLOR);
    expect(normalizeMaterialColor('   ')).toBe(DEFAULT_MATERIAL_COLOR);
    expect(normalizeMaterialColor('not-a-colour')).toBe(DEFAULT_MATERIAL_COLOR);
    // Three-digit shorthand is not what the printers emit, so it is not accepted.
    expect(normalizeMaterialColor('#FFF')).toBe(DEFAULT_MATERIAL_COLOR);
    expect(normalizeMaterialColor('#1234567')).toBe(DEFAULT_MATERIAL_COLOR);
  });

  it('honours a caller-supplied fallback', () => {
    expect(normalizeMaterialColor('nope', '#000000')).toBe('#000000');
  });
});

describe('normalizeMaterialMappingColors', () => {
  it('normalizes both colour fields and preserves everything else', () => {
    const mappings = [
      {
        toolId: 0,
        slotId: 4,
        materialName: 'PLA',
        toolMaterialColor: '7C4B00',
        slotMaterialColor: '161616',
      },
    ];

    expect(normalizeMaterialMappingColors(mappings)).toEqual([
      {
        toolId: 0,
        slotId: 4,
        materialName: 'PLA',
        toolMaterialColor: '#7C4B00',
        slotMaterialColor: '#161616',
      },
    ]);
  });

  it('does not mutate the input', () => {
    const mappings = [
      { toolId: 0, slotId: 1, materialName: 'PLA', toolMaterialColor: 'aabbcc', slotMaterialColor: 'ddeeff' },
    ];

    normalizeMaterialMappingColors(mappings);

    expect(mappings[0].toolMaterialColor).toBe('aabbcc');
  });

  it('handles an empty array', () => {
    expect(normalizeMaterialMappingColors([])).toEqual([]);
  });
});
