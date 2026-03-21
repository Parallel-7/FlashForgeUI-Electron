/**
 * @fileoverview Focused unit tests for DiscordNotificationService timer and lifecycle behavior.
 *
 * Covers the single periodic timer model, multi-context periodic sends, cleanup on context
 * removal, and monitor listener teardown on unregister.
 *
 * @module services/discord/__tests__/DiscordNotificationService.test
 */

import type { PrinterStatus } from '@shared/types/polling.js';
import { EventEmitter } from 'events';
import { PrintStateMonitor } from '../../PrintStateMonitor.js';
import { TemperatureMonitoringService } from '../../TemperatureMonitoringService.js';
import { DiscordNotificationService } from '../DiscordNotificationService.js';

type MockDiscordConfig = {
  DiscordSync: boolean;
  DiscordIncludeCameraSnapshots: boolean;
  WebhookUrl: string;
  DiscordUpdateIntervalMinutes: number;
};

class MockConfigManager extends EventEmitter {
  private config: MockDiscordConfig;

  constructor(overrides: Partial<MockDiscordConfig> = {}) {
    super();
    this.config = {
      DiscordSync: true,
      DiscordIncludeCameraSnapshots: false,
      WebhookUrl: 'https://discord.example/webhook',
      DiscordUpdateIntervalMinutes: 5,
      ...overrides,
    };
  }

  public getConfig(): MockDiscordConfig {
    return this.config;
  }

  public updateConfig(next: Partial<MockDiscordConfig>): void {
    this.config = {
      ...this.config,
      ...next,
    };

    this.emit('configUpdated', {
      changedKeys: Object.keys(next),
    });
  }
}

class MockContextManager extends EventEmitter {
  private readonly contexts = new Map<string, any>();

  constructor(initialContexts: any[] = []) {
    super();
    initialContexts.forEach((context) => {
      this.contexts.set(context.id, context);
    });
  }

  public getAllContexts(): any[] {
    return Array.from(this.contexts.values());
  }

  public getContext(contextId: string): any | null {
    return this.contexts.get(contextId) ?? null;
  }

  public removeContext(contextId: string): void {
    if (!this.contexts.has(contextId)) {
      return;
    }

    this.contexts.delete(contextId);
    this.emit('context-removed', {
      contextId,
      wasActive: false,
    });
  }
}

function createContext(contextId: string): any {
  return {
    id: contextId,
    name: `Printer ${contextId}`,
    printerDetails: {},
    backend: null,
    connectionState: 'connected',
    pollingService: null,
    notificationCoordinator: null,
    cameraProxyPort: null,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActivity: new Date('2026-01-01T00:00:00.000Z'),
    activeSpoolId: null,
    activeSpoolData: null,
  };
}

function createStatus(fileName: string): PrinterStatus {
  return {
    state: 'Printing',
    temperatures: {
      bed: {
        current: 55,
        target: 60,
        isHeating: false,
      },
      extruder: {
        current: 210,
        target: 215,
        isHeating: false,
      },
    },
    fans: {
      coolingFan: 100,
      chamberFan: 0,
    },
    filtration: {
      mode: 'none',
      tvocLevel: 0,
      available: false,
    },
    settings: {},
    currentJob: {
      fileName,
      displayName: fileName,
      startTime: new Date('2026-01-01T00:00:00.000Z'),
      progress: {
        percentage: 50,
        currentLayer: 10,
        totalLayers: 20,
        timeRemaining: 30,
        elapsedTime: 60,
        elapsedTimeSeconds: 3600,
        weightUsed: 10,
        lengthUsed: 2,
        formattedEta: '01:30',
      },
      isActive: true,
    },
    connectionStatus: 'connected',
    lastUpdate: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('DiscordNotificationService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
    } as Response) as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('creates only one periodic timer across multiple registered contexts', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const service = new DiscordNotificationService(
      new MockConfigManager() as any,
      new MockContextManager([createContext('ctx-1'), createContext('ctx-2')]) as any
    );

    service.initialize();
    service.registerContext('ctx-1');
    service.registerContext('ctx-2');

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    service.dispose();
  });

  it('sends one periodic update per connected context on each interval', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const contextManager = new MockContextManager([createContext('ctx-1'), createContext('ctx-2')]);
    const service = new DiscordNotificationService(new MockConfigManager() as any, contextManager as any);

    service.initialize();
    service.registerContext('ctx-1');
    service.registerContext('ctx-2');
    service.updatePrinterStatus('ctx-1', createStatus('cube-1.gx'));
    service.updatePrinterStatus('ctx-2', createStatus('cube-2.gx'));

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1_500);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.dispose();
  });

  it('uploads multipart webhook bodies when snapshots are enabled for periodic updates', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const service = new DiscordNotificationService(
      new MockConfigManager({
        DiscordIncludeCameraSnapshots: true,
      }) as any,
      new MockContextManager([createContext('ctx-1')]) as any
    );

    Object.defineProperty(service, 'go2rtcService', {
      configurable: true,
      value: {
        captureSnapshot: jest.fn(async () => ({
          bytes: new Uint8Array([1, 2, 3]),
          contentType: 'image/jpeg',
          filename: 'printer_ctx-1-snapshot.jpg',
        })),
      },
    });

    service.initialize();
    service.registerContext('ctx-1');
    service.updatePrinterStatus('ctx-1', createStatus('cube-1.gx'));

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit?.body).toBeInstanceOf(FormData);

    const body = requestInit?.body as FormData;
    const payload = JSON.parse(String(body.get('payload_json')));

    expect(payload.embeds[0].image?.url).toBe('attachment://printer_ctx-1-snapshot.jpg');
    expect(body.get('files[0]')).not.toBeNull();

    service.dispose();
  });

  it('falls back to JSON webhook bodies when snapshots are unavailable', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const service = new DiscordNotificationService(
      new MockConfigManager({
        DiscordIncludeCameraSnapshots: true,
      }) as any,
      new MockContextManager([createContext('ctx-1')]) as any
    );

    Object.defineProperty(service, 'go2rtcService', {
      configurable: true,
      value: {
        captureSnapshot: jest.fn(async () => null),
      },
    });

    service.initialize();
    await service.notifyPrintComplete('ctx-1', 'cube-1.gx', 3600);

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit?.body).not.toBeInstanceOf(FormData);
    expect(requestInit?.headers).toEqual({
      'Content-Type': 'application/json',
    });

    const payload = JSON.parse(String(requestInit?.body));
    expect(payload.embeds[0].image).toBeUndefined();

    service.dispose();
  });

  it('stops the periodic timer when the last context is removed', async () => {
    const contextManager = new MockContextManager([createContext('ctx-1')]);
    const service = new DiscordNotificationService(new MockConfigManager() as any, contextManager as any);

    service.initialize();
    service.registerContext('ctx-1');

    expect(jest.getTimerCount()).toBe(1);

    contextManager.removeContext('ctx-1');

    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1_500);
    expect(global.fetch).not.toHaveBeenCalled();

    service.dispose();
  });

  it('removes attached monitor listeners when a context is unregistered', () => {
    const service = new DiscordNotificationService(
      new MockConfigManager() as any,
      new MockContextManager([createContext('ctx-1')]) as any
    );
    const stateMonitor = new PrintStateMonitor('ctx-1');
    const temperatureMonitor = new TemperatureMonitoringService('ctx-1');

    service.initialize();
    service.registerContext('ctx-1');
    service.attachContextMonitors('ctx-1', stateMonitor, temperatureMonitor);

    expect(stateMonitor.listenerCount('print-completed')).toBe(1);
    expect(temperatureMonitor.listenerCount('printer-cooled')).toBe(1);

    service.unregisterContext('ctx-1');

    expect(stateMonitor.listenerCount('print-completed')).toBe(0);
    expect(temperatureMonitor.listenerCount('printer-cooled')).toBe(0);

    service.dispose();
  });
});
