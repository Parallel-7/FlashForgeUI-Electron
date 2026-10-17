/**
 * @fileoverview Authenticated WebSocket proxy tunneling WebUI camera streams to go2rtc.
 *
 * Browsers never connect to the go2rtc API port directly; instead they open a
 * WebSocket to the WebUI server at /api/camera/ws?src=<stream>&token=<auth> and
 * this proxy pipes frames verbatim to/from ws://127.0.0.1:<go2rtc apiPort>/api/ws.
 * This keeps the go2rtc API (which has no authentication of its own) off the
 * network boundary - users only need to expose the WebUI port for camera video.
 * MSE and MJPEG playback both flow entirely over this single WebSocket; WebRTC
 * signaling also passes through (media then negotiates its own transport).
 *
 * Auth mirrors WebSocketManager.verifyClient: when authentication is required,
 * the ?token= query parameter must be a valid AuthManager token.
 *
 * Key exports:
 * - CameraStreamProxy class: handleUpgrade (called from WebUIManager's upgrade
 *   dispatcher) and shutdown (closes all active bridges)
 */

import type * as http from 'http';
import type { Duplex } from 'node:stream';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { getGo2rtcService } from '../../services/Go2rtcService.js';
import { getAuthManager } from './AuthManager.js';

/**
 * Reject a WebSocket upgrade with a raw HTTP error response.
 */
function rejectUpgrade(socket: Duplex, statusCode: number, message: string): void {
  const statusText = statusCode === 401 ? 'Unauthorized' : 'Bad Request';
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      '\r\n' +
      message
  );
  socket.destroy();
}

/**
 * Close a WebSocket, ignoring errors from sockets already closing/closed.
 */
function closeQuietly(ws: WebSocket): void {
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  } catch {
    ws.terminate();
  }
}

/**
 * Camera stream proxy - bridges authenticated WebUI clients to the local go2rtc API.
 */
export class CameraStreamProxy {
  private readonly authManager = getAuthManager();

  /** WebSocket server in noServer mode; upgrades are dispatched by WebUIManager */
  private readonly wss = new WebSocketServer({ noServer: true });

  /** Active client->backend socket pairs for shutdown cleanup */
  private readonly activeBridges = new Set<{ client: WebSocket; backend: WebSocket }>();

  /**
   * Handle an HTTP upgrade request for /api/camera/ws.
   * Validates auth token and src parameter before completing the upgrade.
   */
  public handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    let src: string | null;
    let token: string | null;
    try {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
      src = url.searchParams.get('src');
      token = url.searchParams.get('token');
    } catch {
      rejectUpgrade(socket, 400, 'Invalid request URL');
      return;
    }

    if (this.authManager.isAuthenticationRequired()) {
      if (!token || !this.authManager.verifyToken(token)) {
        rejectUpgrade(socket, 401, 'Unauthorized: Invalid or missing token');
        return;
      }
    }

    if (!src) {
      rejectUpgrade(socket, 400, 'Missing src parameter');
      return;
    }

    const streamSrc = src;
    this.wss.handleUpgrade(req, socket, head, (clientWs) => {
      this.bridge(clientWs, streamSrc);
    });
  }

  /**
   * Pipe frames between the accepted WebUI client and a fresh go2rtc connection.
   */
  private bridge(clientWs: WebSocket, src: string): void {
    const apiPort = getGo2rtcService().getApiPort();
    const backendUrl = `ws://127.0.0.1:${apiPort}/api/ws?src=${encodeURIComponent(src)}`;
    const backendWs = new WebSocket(backendUrl);

    const pair = { client: clientWs, backend: backendWs };
    this.activeBridges.add(pair);

    // Client messages arriving before the backend connection opens are buffered
    const pendingToBackend: Array<{ data: RawData; isBinary: boolean }> = [];

    const teardown = (): void => {
      this.activeBridges.delete(pair);
      pendingToBackend.length = 0;
      closeQuietly(clientWs);
      closeQuietly(backendWs);
    };

    clientWs.on('message', (data: RawData, isBinary: boolean) => {
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.send(data, { binary: isBinary });
      } else if (backendWs.readyState === WebSocket.CONNECTING) {
        pendingToBackend.push({ data, isBinary });
      }
    });

    backendWs.on('open', () => {
      for (const { data, isBinary } of pendingToBackend) {
        backendWs.send(data, { binary: isBinary });
      }
      pendingToBackend.length = 0;
    });

    backendWs.on('message', (data: RawData, isBinary: boolean) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    clientWs.on('close', teardown);
    backendWs.on('close', teardown);
    clientWs.on('error', (error) => {
      console.warn('[CameraStreamProxy] Client socket error:', error.message);
      teardown();
    });
    backendWs.on('error', (error) => {
      console.warn('[CameraStreamProxy] go2rtc socket error:', error.message);
      teardown();
    });
  }

  /**
   * Close all active bridges and the underlying WebSocket server.
   */
  public shutdown(): void {
    for (const { client, backend } of this.activeBridges) {
      closeQuietly(client);
      closeQuietly(backend);
    }
    this.activeBridges.clear();
    this.wss.close();
  }
}
