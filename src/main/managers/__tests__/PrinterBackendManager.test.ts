/**
 * @fileoverview Tests for PrinterBackendManager backend selection, lifecycle wiring,
 * and context-driven backend reuse behavior.
 */

/**
 * @fileoverview Jest coverage for `PrinterBackendManager`.
 *
 * Verifies backend creation, reuse, cleanup, and per-printer legacy/backend
 * selection while coordinating with the loading and context managers.
 */
import type { PrinterDetails } from '@shared/types/printer.js';
import { EventEmitter } from 'events';
import { getLoadingManager } from '../LoadingManager.js';
import { getPrinterBackendManager, PrinterBackendManager } from '../PrinterBackendManager.js';
import { getPrinterContextManager } from '../PrinterContextManager.js';

jest.mock('../LoadingManager.js', () => ({
  getLoadingManager: jest.fn(),
}));

jest.mock('../PrinterContextManager.js', () => ({
  getPrinterContextManager: jest.fn(),
}));

describe('PrinterBackendManager', () => {
  let mockLoadingManager: EventEmitter;
  let mockContextManager: EventEmitter & {
    getContext: jest.Mock;
    getActiveContextId: jest.Mock;
    updateBackend: jest.Mock;
  };

  beforeEach(() => {
    mockLoadingManager = new EventEmitter();
    mockContextManager = Object.assign(new EventEmitter(), {
      getContext: jest.fn(),
      getActiveContextId: jest.fn().mockReturnValue(null),
      updateBackend: jest.fn(),
    });

    (getLoadingManager as jest.Mock).mockReturnValue(mockLoadingManager);
    (getPrinterContextManager as jest.Mock).mockReturnValue(mockContextManager);
    (PrinterBackendManager as any).instance = null;
  });

  function createPrinterDetails(overrides: Partial<PrinterDetails> = {}): PrinterDetails {
    return {
      Name: 'Test Printer',
      IPAddress: '192.168.1.10',
      SerialNumber: 'SN123',
      CheckCode: '1234',
      ClientType: 'legacy',
      printerModel: 'Generic',
      customCameraEnabled: false,
      customCameraUrl: '',
      customLedsEnabled: false,
      forceLegacyMode: false,
      ...overrides,
    };
  }

  it('refreshes backend features when context printer details change', () => {
    const manager = getPrinterBackendManager();
    const backend = {
      refreshPerPrinterSettings: jest.fn().mockReturnValue(['customCameraEnabled']),
    };
    const updatedPrinterDetails = createPrinterDetails({ customCameraEnabled: true });
    const featureChangeListener = jest.fn();

    (manager as any).contextBackends.set('context-1', backend);
    mockContextManager.getContext.mockReturnValue({
      printerDetails: updatedPrinterDetails,
    });
    manager.on('backend-features-changed', featureChangeListener);

    mockContextManager.emit('context-updated', 'context-1');

    expect(backend.refreshPerPrinterSettings).toHaveBeenCalledWith(updatedPrinterDetails);
    expect((manager as any).contextPrinterDetails.get('context-1')).toBe(updatedPrinterDetails);
    expect(featureChangeListener).toHaveBeenCalledWith({
      backend,
      contextId: 'context-1',
      changedKeys: ['customCameraEnabled'],
    });
  });

  it('updates stored printer details even when no backend is active for the context', () => {
    const manager = getPrinterBackendManager();
    const updatedPrinterDetails = createPrinterDetails({ customCameraEnabled: true });
    const featureChangeListener = jest.fn();

    mockContextManager.getContext.mockReturnValue({
      printerDetails: updatedPrinterDetails,
    });
    manager.on('backend-features-changed', featureChangeListener);

    mockContextManager.emit('context-updated', 'context-1');

    expect((manager as any).contextPrinterDetails.get('context-1')).toBe(updatedPrinterDetails);
    expect(featureChangeListener).not.toHaveBeenCalled();
  });
});
