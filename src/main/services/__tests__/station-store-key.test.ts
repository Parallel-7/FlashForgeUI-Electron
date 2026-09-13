/**
 * @fileoverview Unit tests for station-store-key: serial-first store-key
 * resolution, context-id fallback warning behavior, key stability across
 * reconnects, and context-removal pruning of both tracking stores.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getPrinterContextManager,
  PrinterContextManager,
} from '../../managers/PrinterContextManager';
import { JobEstimateStore } from '../JobEstimateStore';
import { SlotSpoolStore } from '../SlotSpoolStore';
import {
  forgetStationContext,
  pruneStationStores,
  resolveStationStoreKey,
  stationStoreKeysForContext,
} from '../station-store-key';
import type { JobEstimateRecord } from '@shared/types/spoolman-tracking';
import type { PrinterDetails } from '@shared/types/printer';

jest.mock('../../services/SpoolmanIntegrationService.js', () => ({
  getSpoolmanIntegrationService: jest.fn(() => ({
    getActiveSpool: jest.fn(),
    setActiveSpool: jest.fn(),
    clearActiveSpool: jest.fn(),
  })),
}));

function tmpPath(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'station-store-key-')), name);
}

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

function makeRecord(fileName: string): JobEstimateRecord {
  return {
    fileName,
    mappings: [{ toolId: 0, slotId: 1 }],
    perTool: [{ toolId: 0, slotId: 1, usedG: 10, usedM: 3 }],
    capturedAt: new Date().toISOString(),
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

  describe('pruneStationStores', () => {
    it('clears serial-keyed estimates, ledger, and slot assignments', () => {
      const estimates = new JobEstimateStore(tmpPath('estimates.json'));
      const slots = new SlotSpoolStore(tmpPath('slots.json'));
      estimates.captureEstimate(SERIAL, makeRecord('benchy.3mf'));
      estimates.markDeducted(SERIAL, 'benchy.3mf::t0');
      slots.setSpoolForSlot(SERIAL, 1, 42);

      // The context wrote under its serial (resolver primed via lookup).
      resolveStationStoreKey('ctx-live', () => SERIAL);

      pruneStationStores('ctx-live', { estimates, slots });

      expect(estimates.findEstimate(SERIAL, 'benchy.3mf')).toBeNull();
      expect(estimates.isDeducted(SERIAL, 'benchy.3mf::t0')).toBe(false);
      expect(slots.getSpoolForSlot(SERIAL, 1)).toBeNull();
      // And the prune survives a restart of the stores.
      expect(new JobEstimateStore(estimates.filePath).getEstimates(SERIAL)).toHaveLength(0);
      expect(new SlotSpoolStore(slots.filePath).getSlotMap(SERIAL).size).toBe(0);
    });

    it('clears fallback-keyed data when no serial was resolved', () => {
      const estimates = new JobEstimateStore(tmpPath('estimates.json'));
      const slots = new SlotSpoolStore(tmpPath('slots.json'));
      estimates.captureEstimate('ctx-fallback', makeRecord('benchy.3mf'));
      slots.setSpoolForSlot('ctx-fallback', 1, 42);

      pruneStationStores('ctx-fallback', { estimates, slots });

      expect(estimates.findEstimate('ctx-fallback', 'benchy.3mf')).toBeNull();
      expect(slots.getSpoolForSlot('ctx-fallback', 1)).toBeNull();
    });

    it('forgets the context resolution after pruning', () => {
      resolveStationStoreKey('ctx-live', () => SERIAL);
      const estimates = new JobEstimateStore(tmpPath('estimates.json'));
      const slots = new SlotSpoolStore(tmpPath('slots.json'));

      pruneStationStores('ctx-live', { estimates, slots });
      expect(stationStoreKeysForContext('ctx-live')).toEqual(['ctx-live']);
    });
  });
});
