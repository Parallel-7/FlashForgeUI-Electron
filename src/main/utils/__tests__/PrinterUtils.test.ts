/**
 * @fileoverview Tests for product-ID-first printer family/model detection.
 *
 * The discovery USB product ID (offset 0x88) is the authoritative, immutable
 * model discriminator. These tests lock in that it is preferred over the
 * firmware Machine Type string, and that Creator 5 / 5 Pro route as new-API
 * printers rather than falling through to the legacy path.
 */
import {
  detectPrinterFamilyFromId,
  detectPrinterModelTypeFromId,
} from '../PrinterUtils.js';

describe('detectPrinterModelTypeFromId', () => {
  it('resolves modern models from the USB product ID', () => {
    expect(detectPrinterModelTypeFromId(0x0023, '')).toBe('adventurer-5m');
    expect(detectPrinterModelTypeFromId(0x0024, '')).toBe('adventurer-5m-pro');
    expect(detectPrinterModelTypeFromId(0x0026, '')).toBe('ad5x');
    expect(detectPrinterModelTypeFromId(0x0028, '')).toBe('creator-5');
    expect(detectPrinterModelTypeFromId(0x0029, '')).toBe('creator-5-pro');
  });

  it('prefers the product ID over the Machine Type string', () => {
    // Even if a future firmware reported an odd type name, the PID wins.
    expect(detectPrinterModelTypeFromId(0x0024, 'Adventurer 5M')).toBe('adventurer-5m-pro');
  });

  it('falls back to the immutable Machine Type when no product ID is present', () => {
    expect(detectPrinterModelTypeFromId(undefined, 'Adventurer 5M Pro')).toBe('adventurer-5m-pro');
    expect(detectPrinterModelTypeFromId(undefined, 'Creator 5 Pro')).toBe('creator-5-pro');
    expect(detectPrinterModelTypeFromId(undefined, 'Adventurer 3')).toBe('generic-legacy');
  });
});

describe('detectPrinterFamilyFromId', () => {
  it('classifies Creator 5 / 5 Pro as new-API printers requiring a check code', () => {
    for (const pid of [0x0028, 0x0029]) {
      const family = detectPrinterFamilyFromId(pid, '');
      expect(family.is5MFamily).toBe(true);
      expect(family.requiresCheckCode).toBe(true);
    }
  });

  it('classifies all known modern PIDs as 5M family', () => {
    for (const pid of [0x0023, 0x0024, 0x0026, 0x0028, 0x0029]) {
      expect(detectPrinterFamilyFromId(pid, '').is5MFamily).toBe(true);
    }
  });

  it('falls back to the Machine Type for manual (no-PID) connections', () => {
    expect(detectPrinterFamilyFromId(undefined, 'Creator 5').is5MFamily).toBe(true);
    expect(detectPrinterFamilyFromId(undefined, 'Adventurer 4').is5MFamily).toBe(false);
  });
});
