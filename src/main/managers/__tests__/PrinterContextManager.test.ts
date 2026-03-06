/**
 * @fileoverview Tests for PrinterContextManager context creation, activation,
 * persistence defaults, and saved-printer bookkeeping.
 */

/**
 * @fileoverview Jest coverage for `PrinterContextManager`.
 *
 * Exercises context creation, activation, mutation, and teardown while
 * preserving per-printer details and expected event emission semantics.
 */
import type { PrinterDetails } from '@shared/types/printer.js';
import { getPrinterContextManager, PrinterContextManager } from '../PrinterContextManager.js';

jest.mock('../../services/SpoolmanIntegrationService.js', () => ({
  getSpoolmanIntegrationService: jest.fn(() => ({
    getActiveSpool: jest.fn(),
    setActiveSpool: jest.fn(),
    clearActiveSpool: jest.fn(),
  })),
}));

function createPrinterDetails(overrides: Partial<PrinterDetails> = {}): PrinterDetails {
  return {
    Name: 'Printer One',
    IPAddress: '192.168.1.10',
    SerialNumber: 'SN123',
    CheckCode: '1234',
    ClientType: 'legacy',
    printerModel: 'Generic',
    ...overrides,
  };
}

describe('PrinterContextManager', () => {
  let manager: PrinterContextManager;

  beforeEach(() => {
    (PrinterContextManager as any).instance = null;
    manager = getPrinterContextManager();
  });

  afterEach(() => {
    manager.reset();
    (PrinterContextManager as any).instance = null;
  });

  it('creates contexts and emits a serializable context-created event', () => {
    const listener = jest.fn();
    manager.on('context-created', listener);

    const contextId = manager.createContext(createPrinterDetails());

    expect(manager.hasContext(contextId)).toBe(true);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        contextId,
        contextInfo: expect.objectContaining({
          id: contextId,
          name: 'Printer One',
          ip: '192.168.1.10',
          serialNumber: 'SN123',
          status: 'connecting',
          hasCamera: false,
        }),
      })
    );
  });

  it('switches active contexts and updates the previous context state', () => {
    const firstContextId = manager.createContext(createPrinterDetails());
    const secondContextId = manager.createContext(createPrinterDetails({ Name: 'Printer Two', SerialNumber: 'SN456' }));
    const listener = jest.fn();
    manager.on('context-switched', listener);

    manager.switchContext(firstContextId);
    manager.switchContext(secondContextId);

    expect(manager.getActiveContextId()).toBe(secondContextId);
    expect(manager.getContext(firstContextId)?.isActive).toBe(false);
    expect(manager.getContext(secondContextId)?.isActive).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        contextId: secondContextId,
        previousContextId: firstContextId,
      })
    );
  });

  it('updates printer details and emits context-updated for live listeners', () => {
    const contextId = manager.createContext(createPrinterDetails());
    const listener = jest.fn();
    manager.on('context-updated', listener);

    manager.updatePrinterDetails(
      contextId,
      createPrinterDetails({
        customCameraEnabled: true,
      })
    );

    expect(manager.getContext(contextId)?.printerDetails.customCameraEnabled).toBe(true);
    expect(listener).toHaveBeenCalledWith(contextId);
  });

  it('removes active contexts and clears the active context id', () => {
    const contextId = manager.createContext(createPrinterDetails());
    manager.switchContext(contextId);

    manager.removeContext(contextId);

    expect(manager.getActiveContextId()).toBeNull();
    expect(manager.hasContext(contextId)).toBe(false);
  });
});
