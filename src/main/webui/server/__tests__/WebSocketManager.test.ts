/**
 * @fileoverview Tests for WebSocketManager authentication, message handling,
 * context-aware status pushes, and client-count updates.
 */

/**
 * @fileoverview Jest coverage for `WebSocketManager`.
 *
 * Tests WebSocket authentication, client registration, broadcast delivery, and
 * command/status messaging for the authenticated WebUI realtime channel.
 */
const mockValidateToken = jest.fn();
const mockIsAuthenticationRequired = jest.fn();
const mockExecuteGCodeCommand = jest.fn();
const mockGetActiveContextId = jest.fn();
const mockUpdateClientCount = jest.fn();
const mockSpoolmanOn = jest.fn();
const mockWebSocketServerInstances: any[] = [];

jest.mock('../../../managers/PrinterBackendManager', () => ({
  getPrinterBackendManager: () => ({
    executeGCodeCommand: (...args: unknown[]) => mockExecuteGCodeCommand(...args),
  }),
}));

jest.mock('../../../managers/PrinterContextManager', () => ({
  getPrinterContextManager: () => ({
    getActiveContextId: (...args: unknown[]) => mockGetActiveContextId(...args),
  }),
}));

jest.mock('../../../services/SpoolmanIntegrationService', () => ({
  getSpoolmanIntegrationService: () => ({
    on: (...args: unknown[]) => mockSpoolmanOn(...args),
  }),
}));

jest.mock('../AuthManager', () => ({
  getAuthManager: () => ({
    isAuthenticationRequired: (...args: unknown[]) => mockIsAuthenticationRequired(...args),
    validateToken: (...args: unknown[]) => mockValidateToken(...args),
  }),
}));

jest.mock('../WebUIManager', () => ({
  getWebUIManager: () => ({
    updateClientCount: (...args: unknown[]) => mockUpdateClientCount(...args),
  }),
}));

jest.mock('ws', () => ({
  RawData: Buffer,
  WebSocket: jest.fn(),
  WebSocketServer: jest.fn().mockImplementation((options: unknown) => {
    const instance = {
      options,
      on: jest.fn(),
      close: jest.fn((callback?: () => void) => callback?.()),
    };
    mockWebSocketServerInstances.push(instance);
    return instance;
  }),
}));

import { WebSocketManager } from '../WebSocketManager.js';

function createMockSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();

  return {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    ping: jest.fn(),
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.(...args);
    },
  };
}

function createPollingData() {
  return {
    printerStatus: {
      state: 'Printing',
      temperatures: {
        bed: { current: 60.4, target: 65, isHeating: true },
        extruder: { current: 219.6, target: 220, isHeating: false },
      },
      fans: {
        coolingFan: 75,
        chamberFan: 0,
      },
      filtration: {
        mode: 'internal',
        tvocLevel: 0,
        available: true,
      },
      settings: {},
      currentJob: {
        fileName: 'part.gx',
        displayName: 'part.gx',
        startTime: new Date('2026-03-04T15:00:00.000Z'),
        isActive: true,
        progress: {
          percentage: 42,
          currentLayer: 12,
          totalLayers: 40,
          timeRemaining: 90,
          elapsedTime: 10,
          elapsedTimeSeconds: 600,
          weightUsed: 18.5,
          lengthUsed: 1.25,
          formattedEta: '4:30 PM',
        },
      },
      connectionStatus: 'connected',
      lastUpdate: new Date('2026-03-04T15:10:00.000Z'),
      cumulativeStats: {
        totalFilamentUsed: 321,
        totalPrintTime: 654,
      },
    },
    materialStation: null,
    thumbnailData: 'thumb-data',
    isConnected: true,
    isInitializing: false,
    lastPolled: new Date('2026-03-04T15:10:00.000Z'),
  } as any;
}

describe('WebSocketManager', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockWebSocketServerInstances.length = 0;
    mockIsAuthenticationRequired.mockReturnValue(true);
    mockValidateToken.mockReturnValue({ isValid: true });
    mockExecuteGCodeCommand.mockResolvedValue({ success: true, error: null });
    mockGetActiveContextId.mockReturnValue('context-1');
    (WebSocketManager as any).instance = null;
  });

  afterEach(() => {
    WebSocketManager.getInstance().dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
    (WebSocketManager as any).instance = null;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('initializes the websocket server with auth verification and spoolman subscriptions', () => {
    const manager = WebSocketManager.getInstance();
    const httpServer = {} as any;

    manager.initialize(httpServer);

    expect(manager.isServerRunning()).toBe(true);
    expect(mockWebSocketServerInstances).toHaveLength(1);
    expect(mockWebSocketServerInstances[0].options).toMatchObject({
      server: httpServer,
      path: '/ws',
      verifyClient: expect.any(Function),
    });
    expect(mockWebSocketServerInstances[0].on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(mockSpoolmanOn).toHaveBeenCalledWith('spoolman-changed', expect.any(Function));
  });

  it('verifies websocket clients for both authenticated and unauthenticated sessions', () => {
    const manager = WebSocketManager.getInstance();
    const unauthenticatedReq = {
      url: '/ws?token=guest-token',
      headers: {
        host: 'localhost:3000',
      },
    } as any;
    const unauthenticatedCallback = jest.fn();

    mockIsAuthenticationRequired.mockReturnValue(false);
    (manager as any).verifyClient({ origin: '', secure: false, req: unauthenticatedReq }, unauthenticatedCallback);

    expect(unauthenticatedReq.wsToken).toBe('guest-token');
    expect(unauthenticatedCallback).toHaveBeenCalledWith(true);

    const authenticatedReq = {
      url: '/ws',
      headers: {
        host: 'localhost:3000',
        authorization: 'Bearer secure-token',
      },
    } as any;
    const authenticatedCallback = jest.fn();

    mockIsAuthenticationRequired.mockReturnValue(true);
    mockValidateToken.mockReturnValue({ isValid: true, sessionId: 'session-1' });
    (manager as any).verifyClient({ origin: '', secure: false, req: authenticatedReq }, authenticatedCallback);

    expect(authenticatedReq.wsToken).toBe('secure-token');
    expect(authenticatedCallback).toHaveBeenCalledWith(true);

    const invalidReq = {
      url: '/ws',
      headers: {
        host: 'localhost:3000',
      },
    } as any;
    const invalidCallback = jest.fn();

    (manager as any).verifyClient({ origin: '', secure: false, req: invalidReq }, invalidCallback);

    expect(invalidCallback).toHaveBeenCalledWith(false, 401, 'Unauthorized: No token provided');
  });

  it('registers new clients, sends initial state, and handles ping messages', async () => {
    const manager = WebSocketManager.getInstance();
    (manager as any).latestPollingData = createPollingData();
    const ws = createMockSocket();

    (manager as any).handleConnection(ws as any, { wsToken: 'token-1' } as any);

    expect(manager.getClientCount()).toBe(1);
    expect(manager.getClientsByToken('token-1')).toBe(1);
    expect(mockUpdateClientCount).toHaveBeenCalledWith(1);

    const authMessage = JSON.parse(ws.send.mock.calls[0][0]);
    const statusMessage = JSON.parse(ws.send.mock.calls[1][0]);

    expect(authMessage.type).toBe('AUTH_SUCCESS');
    expect(statusMessage).toMatchObject({
      type: 'STATUS_UPDATE',
      status: {
        printerState: 'Printing',
        bedTemperature: 60,
        nozzleTemperature: 220,
        progress: 42,
        jobName: 'part.gx',
        estimatedLength: 1.25,
        thumbnailData: 'thumb-data',
      },
    });

    ws.send.mockClear();
    await (manager as any).handleMessage(ws as any, Buffer.from(JSON.stringify({ command: 'PING' })));

    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: 'PONG',
    });
  });

  it('returns websocket errors for invalid JSON and gcode requests without an active context', async () => {
    const manager = WebSocketManager.getInstance();
    const ws = createMockSocket();

    (manager as any).handleConnection(ws as any, { wsToken: 'token-1' } as any);
    ws.send.mockClear();

    await (manager as any).handleMessage(ws as any, Buffer.from('{'));

    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual(
      expect.objectContaining({
        type: 'ERROR',
        error: 'Invalid JSON format',
      })
    );

    ws.send.mockClear();
    mockGetActiveContextId.mockReturnValue(null);

    await (manager as any).handleMessage(
      ws as any,
      Buffer.from(
        JSON.stringify({
          command: 'EXECUTE_GCODE',
          gcode: 'M105',
        })
      )
    );

    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual(
      expect.objectContaining({
        type: 'ERROR',
        error: 'No active printer context',
      })
    );
  });

  it('broadcasts printer and spoolman updates and targets token-specific clients', async () => {
    const manager = WebSocketManager.getInstance();
    manager.initialize({} as any);

    const wsOne = createMockSocket();
    const wsTwo = createMockSocket();

    (manager as any).handleConnection(wsOne as any, { wsToken: 'token-1' } as any);
    (manager as any).handleConnection(wsTwo as any, { wsToken: 'token-2' } as any);
    wsOne.send.mockClear();
    wsTwo.send.mockClear();

    await manager.broadcastPrinterStatus(createPollingData());

    const broadcastMessage = JSON.parse(wsOne.send.mock.calls[0][0]);
    expect(broadcastMessage).toMatchObject({
      type: 'STATUS_UPDATE',
      status: {
        printerState: 'Printing',
        filtrationMode: 'internal',
        cumulativeFilament: 321,
      },
    });
    expect(wsTwo.send).toHaveBeenCalledTimes(1);

    const spoolmanListener = mockSpoolmanOn.mock.calls[0][1];
    spoolmanListener({
      contextId: 'context-2',
      spool: null,
    });

    expect(JSON.parse(wsOne.send.mock.calls[1][0])).toEqual(
      expect.objectContaining({
        type: 'SPOOLMAN_UPDATE',
        contextId: 'context-2',
        spool: null,
      })
    );

    manager.broadcastToToken('token-2', {
      type: 'PONG',
      timestamp: new Date().toISOString(),
    } as any);

    expect(wsOne.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(wsTwo.send.mock.calls[2][0])).toEqual(
      expect.objectContaining({
        type: 'PONG',
      })
    );

    manager.disconnectToken('token-1');
    expect(wsOne.close).toHaveBeenCalledWith(1000, 'Token revoked');
  });
});
