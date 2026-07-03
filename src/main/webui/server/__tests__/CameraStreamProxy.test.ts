/**
 * @fileoverview Jest coverage for `CameraStreamProxy`.
 *
 * Exercises the authenticated WebUI camera WebSocket proxy against a real HTTP
 * server and a stand-in go2rtc WebSocket backend: auth rejection, src
 * validation, bidirectional text/binary frame piping, and teardown when the
 * backend closes.
 */

const mockVerifyToken = jest.fn();
const mockIsAuthenticationRequired = jest.fn();
let mockGo2rtcPort = 0;

jest.mock('../AuthManager', () => ({
  getAuthManager: () => ({
    isAuthenticationRequired: (...args: unknown[]) => mockIsAuthenticationRequired(...args),
    verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  }),
}));

jest.mock('../../../services/Go2rtcService', () => ({
  getGo2rtcService: () => ({
    getApiPort: () => mockGo2rtcPort,
  }),
}));

import * as http from 'http';
import type { AddressInfo } from 'net';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { CameraStreamProxy } from '../CameraStreamProxy.js';

interface BackendHarness {
  wss: WebSocketServer;
  port: number;
  connections: WebSocket[];
  messages: Array<{ data: string; isBinary: boolean }>;
}

function startBackend(): Promise<BackendHarness> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 }, () => {
      const harness: BackendHarness = {
        wss,
        port: (wss.address() as AddressInfo).port,
        connections: [],
        messages: [],
      };
      wss.on('connection', (ws) => {
        harness.connections.push(ws);
        ws.on('message', (data: RawData, isBinary: boolean) => {
          harness.messages.push({ data: data.toString(), isBinary });
        });
      });
      resolve(harness);
    });
  });
}

function startProxyServer(proxy: CameraStreamProxy): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.on('upgrade', (req, socket, head) => {
      proxy.handleUpgrade(req, socket, head);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

function waitFor<T>(check: () => T | undefined, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = (): void => {
      const value = check();
      if (value !== undefined) {
        resolve(value);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Timed out waiting for condition'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

function expectUpgradeRejection(url: string, expectedStatus: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('unexpected-response', (_req, res) => {
      try {
        expect(res.statusCode).toBe(expectedStatus);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        ws.terminate();
      }
    });
    ws.on('open', () => {
      ws.terminate();
      reject(new Error('Upgrade unexpectedly succeeded'));
    });
    ws.on('error', () => {
      // Emitted after unexpected-response; ignore
    });
  });
}

describe('CameraStreamProxy', () => {
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  let backend: BackendHarness;
  let proxy: CameraStreamProxy;
  let proxyServer: http.Server;
  let proxyPort: number;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsAuthenticationRequired.mockReturnValue(true);
    mockVerifyToken.mockReturnValue(true);

    backend = await startBackend();
    mockGo2rtcPort = backend.port;

    proxy = new CameraStreamProxy();
    const started = await startProxyServer(proxy);
    proxyServer = started.server;
    proxyPort = started.port;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.terminate();
    }
    clients.length = 0;
    proxy.shutdown();
    await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
    await new Promise<void>((resolve) => backend.wss.close(() => resolve()));
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  function connectClient(query: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/api/camera/ws${query}`);
      clients.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('rejects the upgrade with 401 when auth is required and the token is missing or invalid', async () => {
    await expectUpgradeRejection(`ws://127.0.0.1:${proxyPort}/api/camera/ws?src=cam`, 401);

    mockVerifyToken.mockReturnValue(false);
    await expectUpgradeRejection(`ws://127.0.0.1:${proxyPort}/api/camera/ws?src=cam&token=bad`, 401);
    expect(mockVerifyToken).toHaveBeenCalledWith('bad');
    expect(backend.connections).toHaveLength(0);
  });

  it('rejects the upgrade with 400 when the src parameter is missing', async () => {
    await expectUpgradeRejection(`ws://127.0.0.1:${proxyPort}/api/camera/ws?token=good`, 400);
    expect(backend.connections).toHaveLength(0);
  });

  it('pipes text and binary frames between the client and the go2rtc backend', async () => {
    const client = await connectClient('?src=context-1-camera&token=good');
    const received: Array<{ data: Buffer; isBinary: boolean }> = [];
    client.on('message', (data: RawData, isBinary: boolean) => {
      received.push({ data: data as Buffer, isBinary });
    });

    // Client -> backend (sent immediately; proxy buffers until backend opens)
    client.send(JSON.stringify({ type: 'mse' }));
    await waitFor(() => (backend.messages.length >= 1 ? true : undefined));
    expect(backend.messages[0]).toEqual({ data: JSON.stringify({ type: 'mse' }), isBinary: false });

    const backendConnection = await waitFor(() => backend.connections[0]);

    // Backend -> client: text then binary (MSE-style segment)
    backendConnection.send(JSON.stringify({ type: 'mse', value: 'video/mp4' }));
    backendConnection.send(Buffer.from([0x00, 0x01, 0x02, 0x03]));

    await waitFor(() => (received.length >= 2 ? true : undefined));
    expect(received[0].isBinary).toBe(false);
    expect(received[0].data.toString()).toBe(JSON.stringify({ type: 'mse', value: 'video/mp4' }));
    expect(received[1].isBinary).toBe(true);
    expect(Buffer.compare(received[1].data, Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBe(0);
  });

  it('allows connections without a token when authentication is not required', async () => {
    mockIsAuthenticationRequired.mockReturnValue(false);

    const client = await connectClient('?src=context-1-camera');
    expect(client.readyState).toBe(WebSocket.OPEN);
    await waitFor(() => backend.connections[0]);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('closes the client when the backend connection closes', async () => {
    const client = await connectClient('?src=context-1-camera&token=good');
    const backendConnection = await waitFor(() => backend.connections[0]);

    const closed = new Promise<void>((resolve) => client.on('close', () => resolve()));
    backendConnection.close();
    await closed;

    expect(client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED).toBe(true);
  });
});
