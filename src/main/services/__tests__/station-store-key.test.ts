/**
 * @fileoverview Unit tests for station-store-key: serial-first store-key
 * resolution, context-id fallback warning behavior, key stability across
 * reconnects, and forgetting a removed context.
 */

import {
  getPrinterContextManager,
  PrinterContextManager,
} from '../../managers/PrinterContextManager';
import {
  forgetStationContext,
  resolveStationStoreKey,
  stationStoreKeysForContext,
} from '../station-store-key';
import type { PrinterDetails } from '@shared/types/printer';

jest.mock('../../services/SpoolmanIntegrationService.js', () => ({
  getSpoolmanIntegrationService: jest.fn(() => ({
    getActiveSpool: jest.fn(),
    setActiveSpool: jest.fn(),
    clearActiveSpool: jest.fn(),
  })),
}));

const SERIAL = 'FFSN-A17';

function makePrinterDetails(serial: string): PrinterDetails {
  return {
    Name: 'Creator 5',
    IPAddress: '192.168.1.50',
    SerialNumber: serial,
    CheckCode: '1234',
    ClientType: 'new',
    printerModel: 'Creator 5',
  };
}

describe('station-store-key', () => {
  beforeEach(() => {
    forgetStationContext('ctx-live');
    forgetStationContext('ctx-fallback');
    forgetStationContext('ctx-gone');
    (PrinterContextManager as unknown as { instance: unknown }).instance = null;
  });

  afterEach(() => {
    getPrinterContextManager().reset();
    (PrinterContextManager as unknown as { instance: unknown }).instance = null;
  });

  describe('resolveStationStoreKey', () => {
    it('prefers the printer serial resolved from the context', () => {
      expect(resolveStationStoreKey('ctx-live', () => SERIAL)).toBe(SERIAL);
    });

    it('falls back to the context id and warns only once per context id', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(resolveStationStoreKey('ctx-fallback', () => undefined)).toBe('ctx-fallback');
        expect(resolveStationStoreKey('ctx-fallback', () => undefined)).toBe('ctx-fallback');

        const fallbackWarnings = warn.mock.calls.filter((call) =>
          String(call[0]).includes('[station-store-key]')
        );
        expect(fallbackWarnings).toHaveLength(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('treats a throwing lookup like an unresolved serial', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(
          resolveStationStoreKey('ctx-gone', () => {
            throw new Error('boom');
          })
        ).toBe('ctx-gone');
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('keeps the same store key across a reconnect (new context id, same serial)', () => {
      const manager = getPrinterContextManager();
      const first = manager.createContext(makePrinterDetails(SERIAL));
      expect(resolveStationStoreKey(first)).toBe(SERIAL);

      // A reconnect removes and recreates the context with a NEW id but the
      // same physical printer (same serial).
      manager.removeContext(first);
      const second = manager.createContext(makePrinterDetails(SERIAL));
      expect(second).not.toBe(first);
      expect(resolveStationStoreKey(second)).toBe(SERIAL);
    });

    it('falls back to the context id for an unknown context', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(resolveStationStoreKey('ctx-never-created')).toBe('ctx-never-created');
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('stationStoreKeysForContext', () => {
    it('lists the resolved serial and the context-id fallback', () => {
      resolveStationStoreKey('ctx-live', () => SERIAL);
      expect(stationStoreKeysForContext('ctx-live')).toEqual([SERIAL, 'ctx-live']);
    });

    it('lists only the context id when no serial was ever resolved', () => {
      expect(stationStoreKeysForContext('ctx-fallback')).toEqual(['ctx-fallback']);
    });
  });

  describe('forgetStationContext', () => {
    it('drops the cached serial of a removed context', () => {
      resolveStationStoreKey('ctx-forget', () => 'SERIAL-F');
      expect(stationStoreKeysForContext('ctx-forget')).toEqual(['SERIAL-F', 'ctx-forget']);
      forgetStationContext('ctx-forget');
      expect(stationStoreKeysForContext('ctx-forget')).toEqual(['ctx-forget']);
    });
  });
});
