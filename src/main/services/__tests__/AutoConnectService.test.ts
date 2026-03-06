/**
 * @fileoverview Tests for AutoConnectService decision-making across single-match,
 * multi-match, and no-match saved-printer scenarios.
 */

/**
 * @fileoverview Jest coverage for `AutoConnectService`.
 *
 * Verifies saved-printer prioritization, auto-connect gating, and the
 * connection handoff logic used during desktop startup flows.
 */
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

import { AutoConnectService } from '../AutoConnectService.js';

describe('AutoConnectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AutoConnectService as any).instance = null;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('chooses the correct auto-connect action based on the number of matches', () => {
    const service = AutoConnectService.getInstance();
    const singleMatch = [{ serialNumber: 'SN-1', printerName: 'Printer One' }] as any;
    const multipleMatches = [
      { serialNumber: 'SN-1', printerName: 'Printer One' },
      { serialNumber: 'SN-2', printerName: 'Printer Two' },
    ] as any;

    expect(service.determineAutoConnectChoice([])).toEqual({
      action: 'none',
      reason: 'No saved printers found on network',
    });
    expect(service.determineAutoConnectChoice(singleMatch)).toEqual({
      action: 'connect',
      selectedMatch: singleMatch[0],
      reason: 'Single saved printer found',
    });
    expect(service.determineAutoConnectChoice(multipleMatches)).toEqual({
      action: 'select',
      matches: multipleMatches,
      reason: 'Multiple saved printers found',
    });
  });

  it('emits updates for preference changes and auto-connect logging', () => {
    const service = AutoConnectService.getInstance();
    const preferenceSpy = jest.fn();
    const logSpy = jest.fn();

    service.on('auto-connect-preferences-updated', preferenceSpy);
    service.on('auto-connect-logged', logSpy);

    service.updateAutoConnectPreferences('SN-1');
    service.logAutoConnectAttempt('started', { source: 'startup' });

    expect(service.shouldAutoConnect()).toBe(true);
    expect(service.getPreferredPrinter([])).toBeNull();
    expect(service.shouldAutoConnectToPrinter('SN-1')).toBe(false);
    expect(service.getAutoConnectDelay()).toBe(100);
    expect(service.shouldRetryAutoConnect(1)).toBe(false);
    expect(preferenceSpy).toHaveBeenCalledWith('SN-1');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'started',
        details: { source: 'startup' },
        timestamp: expect.any(String),
      })
    );
  });
});
