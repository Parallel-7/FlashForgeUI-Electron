/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Jest coverage for the WebUI transport layer.
 *
 * Exercises HTTP request helpers, auth header generation, WebSocket lifecycle
 * handling, update fan-out, reconnect behavior, and command dispatch failure
 * paths in `Transport.js`.
 */
/**
 * @fileoverview JSDOM tests for the WebUI Transport layer covering fetch requests,
 * websocket lifecycle, reconnection, and auth-aware command dispatch.
 */

const mockShowToast = jest.fn();
const mockFetch = jest.fn();
const mockState = {
  authRequired: false,
  authToken: null as string | null,
  websocket: null as WebSocket | null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
  isAuthenticated: false,
};

class MockWebSocket {
  public static readonly OPEN = 1;
  public static instances: MockWebSocket[] = [];

  public readonly url: string;
  public readonly sentMessages: string[] = [];
  public readyState = 0;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((error: unknown) => void) | null = null;
  public onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public send(payload: string): void {
    this.sentMessages.push(payload);
  }

  public close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  public triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  public triggerMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  public triggerClose(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

jest.mock('../../shared/dom.js', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('../AppState.js', () => ({
  state: mockState,
}));

import {
  apiRequest,
  apiRequestWithMetadata,
  buildAuthHeaders,
  connectWebSocket,
  disconnectWebSocket,
  onConnectionChange,
  onSpoolmanUpdate,
  onStatusUpdate,
  sendCommand,
} from '../Transport.js';

describe('webui transport', () => {
  const originalFetch = global.fetch;
  const originalWebSocket = global.WebSocket;
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    global.WebSocket = originalWebSocket;
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    MockWebSocket.instances = [];
    mockState.authRequired = false;
    mockState.authToken = null;
    mockState.websocket = null;
    mockState.isConnected = false;
    mockState.reconnectAttempts = 0;
    mockState.maxReconnectAttempts = 5;
    mockState.reconnectDelay = 2000;
    mockState.isAuthenticated = false;
    window.history.replaceState({}, '', 'http://localhost/');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('adds auth headers only when authentication is required and a token is present', () => {
    expect(buildAuthHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
    });

    mockState.authRequired = true;
    mockState.authToken = 'token-123';

    expect(buildAuthHeaders({ Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer token-123',
    });
  });

  it('parses API responses and preserves metadata for empty bodies', async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce({
        status: 204,
        ok: true,
        text: async () => '',
      });

    const payload = await apiRequest<{ success: boolean }>('/api/demo');
    const empty = await apiRequestWithMetadata<Record<string, never>>('/api/empty');

    expect(payload).toEqual({ success: true });
    expect(empty).toEqual({
      data: {},
      status: 204,
      ok: true,
    });
  });

  it('throws when the server returns invalid JSON', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => 'not-json',
    });

    await expect(apiRequest('/api/bad-json')).rejects.toThrow('Failed to parse server response');
  });

  it('connects the websocket, dispatches updates, and reconnects after disconnect', () => {
    const connectionCallback = jest.fn();
    const statusCallback = jest.fn();
    const spoolCallback = jest.fn();

    onConnectionChange(connectionCallback);
    onStatusUpdate(statusCallback);
    onSpoolmanUpdate(spoolCallback);

    mockState.authRequired = true;
    mockState.authToken = 'auth-token';
    mockState.isAuthenticated = true;

    connectWebSocket();

    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0]!;
    expect(socket.url).toBe('ws://localhost/ws?token=auth-token');

    socket.triggerOpen();

    expect(mockState.isConnected).toBe(true);
    expect(connectionCallback).toHaveBeenCalledWith(true);
    expect(socket.sentMessages).toContain(JSON.stringify({ command: 'REQUEST_STATUS' }));

    const statusPayload = {
      printerState: 'Ready',
      bedTemperature: 0,
      bedTargetTemperature: 0,
      nozzleTemperature: 0,
      nozzleTargetTemperature: 0,
      progress: 0,
    };

    socket.triggerMessage({
      type: 'STATUS_UPDATE',
      timestamp: new Date().toISOString(),
      status: statusPayload,
    });
    socket.triggerMessage({
      type: 'SPOOLMAN_UPDATE',
      timestamp: new Date().toISOString(),
      contextId: 'context-1',
      spool: null,
    });
    socket.triggerMessage({
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'boom',
    });

    expect(statusCallback).toHaveBeenCalledWith(statusPayload);
    expect(spoolCallback).toHaveBeenCalledWith('context-1', null);
    expect(mockShowToast).toHaveBeenCalledWith('boom', 'error');

    socket.triggerClose();

    expect(mockState.isConnected).toBe(false);
    expect(mockState.websocket).toBeNull();
    expect(connectionCallback).toHaveBeenLastCalledWith(false);
    expect(mockState.reconnectAttempts).toBe(1);

    jest.runOnlyPendingTimers();

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('shows a toast when commands are sent without an open websocket', () => {
    sendCommand({ command: 'PING' });

    expect(mockShowToast).toHaveBeenCalledWith('Not connected to server', 'error');
  });

  it('closes the active websocket during disconnect', () => {
    connectWebSocket();
    const socket = MockWebSocket.instances[0]!;
    mockState.websocket = socket as unknown as WebSocket;

    disconnectWebSocket();

    expect(mockState.websocket).toBeNull();
    expect(socket.readyState).toBe(3);
  });
});
