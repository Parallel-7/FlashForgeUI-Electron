/**
 * @fileoverview Tests for MultiContextPollingCoordinator polling service creation,
 * rebinding, disposal, and event fan-out across printer contexts.
 */

/**
 * @fileoverview Jest coverage for `MultiContextPollingCoordinator`.
 *
 * Tests per-context polling registration, active context changes, and cleanup
 * behavior while coordinating shared polling services across multiple printers.
 */
import { EventEmitter } from 'events';

const mockLogVerbose = jest.fn();
const mockContextManager = Object.assign(new EventEmitter(), {
  getContext: jest.fn(),
  updatePollingService: jest.fn(),
});

class MockPrinterPollingService extends EventEmitter {
  public static instances: MockPrinterPollingService[] = [];

  public readonly printerIP: string;
  public readonly updateConfigCalls: Partial<{ intervalMs: number }>[] = [];
  public backendManager: unknown = null;
  public currentData: unknown = null;
  public disposed = false;
  private readonly stats: { intervalMs: number; isPolling: boolean; retryCount: number };

  constructor(config: Partial<{ intervalMs: number }>, printerIP: string) {
    super();
    this.printerIP = printerIP;
    this.stats = {
      intervalMs: config.intervalMs ?? 0,
      isPolling: false,
      retryCount: 0,
    };
    MockPrinterPollingService.instances.push(this);
  }

  public setBackendManager(backendManager: unknown): void {
    this.backendManager = backendManager;
  }

  public start(): boolean {
    this.stats.isPolling = true;
    return true;
  }

  public stop(): void {
    this.stats.isPolling = false;
  }

  public dispose(): void {
    this.disposed = true;
  }

  public updateConfig(config: Partial<{ intervalMs: number }>): void {
    this.updateConfigCalls.push(config);
    if (config.intervalMs !== undefined) {
      this.stats.intervalMs = config.intervalMs;
    }
  }

  public isRunning(): boolean {
    return this.stats.isPolling;
  }

  public getCurrentData(): any {
    return this.currentData;
  }

  public getStats(): { intervalMs: number; isPolling: boolean; retryCount: number } {
    return { ...this.stats };
  }
}

jest.mock('@shared/logging.js', () => ({
  logVerbose: (...args: unknown[]) => mockLogVerbose(...args),
}));

jest.mock('../../managers/PrinterContextManager.js', () => ({
  getPrinterContextManager: () => mockContextManager,
}));

jest.mock('../PrinterPollingService.js', () => ({
  POLLING_EVENTS: {
    DATA_UPDATED: 'data-updated',
    POLLING_ERROR: 'polling-error',
  },
  PrinterPollingService: MockPrinterPollingService,
}));

import { MultiContextPollingCoordinator } from '../MultiContextPollingCoordinator.js';

describe('MultiContextPollingCoordinator', () => {
  const backendA = {
    getPrinterStatus: jest.fn().mockResolvedValue({ success: true }),
    getMaterialStationStatus: jest.fn().mockReturnValue({ connected: true }),
    getModelPreview: jest.fn().mockResolvedValue('preview-a'),
    getJobThumbnail: jest.fn().mockResolvedValue('thumb-a'),
  };
  const backendB = {
    getPrinterStatus: jest.fn().mockResolvedValue({ success: true }),
    getMaterialStationStatus: jest.fn().mockReturnValue(null),
    getModelPreview: jest.fn().mockResolvedValue('preview-b'),
    getJobThumbnail: jest.fn().mockResolvedValue('thumb-b'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockContextManager.removeAllListeners();
    mockContextManager.getContext.mockReset();
    mockContextManager.updatePollingService.mockReset();
    MockPrinterPollingService.instances = [];
    (MultiContextPollingCoordinator as any).instance = null;
  });

  it('starts polling for a context, wires the backend wrapper, and exposes status helpers', async () => {
    mockContextManager.getContext.mockImplementation((contextId: string) => {
      if (contextId !== 'context-1') {
        return null;
      }

      return {
        id: 'context-1',
        isActive: true,
        backend: backendA,
        printerDetails: {
          IPAddress: '192.168.1.25',
        },
      };
    });

    const coordinator = MultiContextPollingCoordinator.getInstance();
    const startedSpy = jest.fn();
    coordinator.on('polling-started', startedSpy);

    coordinator.startPollingForContext('context-1');

    expect(MockPrinterPollingService.instances).toHaveLength(1);
    const poller = MockPrinterPollingService.instances[0]!;
    expect(poller.printerIP).toBe('192.168.1.25');
    expect(poller.getStats()).toEqual({
      intervalMs: 3000,
      isPolling: true,
      retryCount: 0,
    });
    expect(mockContextManager.updatePollingService).toHaveBeenCalledWith('context-1', poller);
    expect(startedSpy).toHaveBeenCalledWith('context-1');
    expect(coordinator.isPollingForContext('context-1')).toBe(true);
    expect(coordinator.getActivePollingContexts()).toEqual(['context-1']);
    expect(coordinator.getActivePollingCount()).toBe(1);
    expect(await (poller.backendManager as any).getPrinterStatus()).toEqual({ success: true });
    expect(await (poller.backendManager as any).getModelPreview()).toBe('preview-a');
    expect(await (poller.backendManager as any).getJobThumbnail('job.ffp')).toBe('thumb-a');
  });

  it('reacts to context switches and removals by updating pollers and forwarding cached data', () => {
    mockContextManager.getContext.mockImplementation((contextId: string) => {
      const contexts: Record<string, unknown> = {
        'context-1': {
          id: 'context-1',
          isActive: true,
          backend: backendA,
          printerDetails: { IPAddress: '192.168.1.25' },
        },
        'context-2': {
          id: 'context-2',
          isActive: false,
          backend: backendB,
          printerDetails: { IPAddress: '192.168.1.26' },
        },
      };

      return contexts[contextId] ?? null;
    });

    const coordinator = MultiContextPollingCoordinator.getInstance();
    const pollingDataSpy = jest.fn();
    coordinator.on('polling-data', pollingDataSpy);

    coordinator.startPollingForContext('context-1');
    coordinator.startPollingForContext('context-2');

    const firstPoller = MockPrinterPollingService.instances[0]!;
    const secondPoller = MockPrinterPollingService.instances[1]!;
    secondPoller.currentData = { printerStatus: { printerState: 'Ready' } };

    mockContextManager.emit('context-switched', {
      contextId: 'context-2',
      previousContextId: 'context-1',
    });

    expect(secondPoller.updateConfigCalls).toContainEqual({ intervalMs: 3000 });
    expect(firstPoller.updateConfigCalls).toContainEqual({ intervalMs: 3000 });
    expect(pollingDataSpy).toHaveBeenCalledWith('context-2', {
      printerStatus: { printerState: 'Ready' },
    });

    mockContextManager.emit('context-removed', {
      contextId: 'context-1',
    });

    expect(coordinator.isPollingForContext('context-1')).toBe(false);
    expect(firstPoller.disposed).toBe(true);
  });

  it('throws for invalid contexts and supports manual config updates and full disposal', () => {
    mockContextManager.getContext.mockImplementation((contextId: string) => {
      if (contextId === 'missing-context') {
        return null;
      }

      if (contextId === 'backendless-context') {
        return {
          id: contextId,
          isActive: true,
          backend: null,
          printerDetails: { IPAddress: '192.168.1.30' },
        };
      }

      return {
        id: contextId,
        isActive: true,
        backend: backendA,
        printerDetails: { IPAddress: '192.168.1.31' },
      };
    });

    const coordinator = MultiContextPollingCoordinator.getInstance();

    expect(() => coordinator.startPollingForContext('missing-context')).toThrow(
      'Cannot start polling: Context missing-context does not exist'
    );
    expect(() => coordinator.startPollingForContext('backendless-context')).toThrow(
      'Cannot start polling: Context backendless-context has no backend'
    );

    coordinator.startPollingForContext('context-3');
    expect(coordinator.updatePollingConfigForContext('context-3', { intervalMs: 1500 })).toBe(true);
    expect(coordinator.updatePollingConfigForContext('unknown-context', { intervalMs: 1500 })).toBe(false);
    expect(coordinator.getStatus()).toEqual({
      activePollingCount: 1,
      activeContexts: ['context-3'],
      listenersRegistered: true,
      pollingConfigs: {
        'context-3': {
          intervalMs: 1500,
          isPolling: true,
          retryCount: 0,
        },
      },
    });

    coordinator.dispose();

    expect(coordinator.getActivePollingCount()).toBe(0);
    expect(MockPrinterPollingService.instances[0]?.disposed).toBe(true);
  });
});
