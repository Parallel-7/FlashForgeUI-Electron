import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const STATIC_ROOT = path.resolve(process.cwd(), 'out/webui/static');
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

interface FixtureContext {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  serialNumber: string;
  isActive: boolean;
}

interface FixturePrinterFeatures {
  hasCamera: boolean;
  hasLED: boolean;
  hasFiltration: boolean;
  hasMaterialStation: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  ledUsesLegacyAPI: boolean;
}

interface FixtureCameraConfig {
  success: boolean;
  wsUrl?: string;
  streamType?: 'mjpeg' | 'rtsp';
  sourceType?: 'builtin' | 'custom';
  streamName?: string;
  apiPort?: number;
  mode?: string;
  showCameraFps?: boolean;
  error?: string;
}

export interface WebUiFixtureOptions {
  authRequired?: boolean;
  loginToken?: string;
  contexts?: FixtureContext[];
  printerFeatures?: Partial<FixturePrinterFeatures>;
  cameraConfig?: FixtureCameraConfig | null;
}

export interface WebUiFixtureServer {
  readonly baseUrl: string;
  readonly requests: string[];
  close(): Promise<void>;
}

interface ResolvedFixtureOptions {
  authRequired: boolean;
  loginToken: string;
  contexts: FixtureContext[];
  printerFeatures: FixturePrinterFeatures;
  cameraConfig: FixtureCameraConfig | null;
}

export async function startWebUiFixtureServer(options: WebUiFixtureOptions = {}): Promise<WebUiFixtureServer> {
  const requests: string[] = [];
  const validTokens = new Set<string>();
  const resolvedOptions = resolveFixtureOptions(options);

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    requests.push(`${request.method ?? 'GET'} ${requestUrl.pathname}`);

    if (await handleApiRoute(request, requestUrl, response, resolvedOptions, validTokens)) {
      return;
    }

    await handleStaticRoute(requestUrl, response);
  });
  const webSocketServer = new WebSocketServer({ noServer: true });

  webSocketServer.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'AUTH_SUCCESS',
        timestamp: new Date().toISOString(),
        clientId: 'fixture-client',
      })
    );

    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as { command?: string };
        if (message.command === 'REQUEST_STATUS') {
          socket.send(
            JSON.stringify({
              type: 'STATUS_UPDATE',
              timestamp: new Date().toISOString(),
              status: {
                printerState: 'Ready',
                bedTemperature: 0,
                bedTargetTemperature: 0,
                nozzleTemperature: 0,
                nozzleTargetTemperature: 0,
                progress: 0,
                currentLayer: 0,
                totalLayers: 0,
              },
            })
          );
        }
      } catch {
        // Ignore malformed messages in the fixture server.
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    requests.push(`UPGRADE ${requestUrl.pathname}`);

    if (requestUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    if (resolvedOptions.authRequired) {
      const token = requestUrl.searchParams.get('token');
      if (!token || !validTokens.has(token)) {
        socket.destroy();
        return;
      }
    }

    webSocketServer.handleUpgrade(request, socket, head, (upgradedSocket) => {
      webSocketServer.emit('connection', upgradedSocket, request);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    async close() {
      webSocketServer.clients.forEach((client) => client.close());
      webSocketServer.close();
      await closeServer(server);
    },
  };
}

function resolveFixtureOptions(options: WebUiFixtureOptions): ResolvedFixtureOptions {
  return {
    authRequired: options.authRequired ?? false,
    loginToken: options.loginToken ?? 'fixture-token',
    contexts: options.contexts ?? [
      {
        id: 'context-1',
        name: 'Fixture Printer',
        model: 'AD5X',
        ipAddress: '192.168.1.25',
        serialNumber: 'SN123',
        isActive: true,
      },
    ],
    printerFeatures: {
      hasCamera: false,
      hasLED: true,
      hasFiltration: true,
      hasMaterialStation: false,
      canPause: true,
      canResume: true,
      canCancel: true,
      ledUsesLegacyAPI: true,
      ...options.printerFeatures,
    },
    cameraConfig: options.cameraConfig ?? null,
  };
}

async function handleApiRoute(
  request: IncomingMessage,
  requestUrl: URL,
  response: ServerResponse,
  options: ResolvedFixtureOptions,
  validTokens: Set<string>
): Promise<boolean> {
  const { pathname } = requestUrl;

  if (pathname === '/api/auth/status') {
    return sendJson(response, 200, {
      authRequired: options.authRequired,
      hasPassword: options.authRequired,
      defaultPassword: false,
    });
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const payload = (await readJsonBody(request)) as { password?: string };
    if (!payload.password) {
      return sendJson(response, 400, {
        success: false,
        message: 'Password required',
      });
    }

    validTokens.add(options.loginToken);
    return sendJson(response, 200, {
      success: true,
      token: options.loginToken,
      message: 'Logged in',
    });
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = extractBearerToken(request);
    if (token) {
      validTokens.delete(token);
    }
    return sendJson(response, 200, {
      success: true,
    });
  }

  if (pathname === '/api/webui/theme') {
    return sendJson(response, 200, {
      primary: '#4285f4',
      secondary: '#357abd',
      background: '#121212',
      surface: '#1e1e1e',
      text: '#e0e0e0',
    });
  }

  if (pathname === '/api/webui/theme/profiles') {
    return sendJson(response, 200, []);
  }

  if (pathname.startsWith('/api/') && options.authRequired && !isAuthorized(request, validTokens)) {
    return sendJson(response, 401, {
      success: false,
      error: 'Unauthorized',
    });
  }

  if (pathname === '/api/printer/status') {
    return sendJson(response, 200, {
      success: true,
      status: {
        printerState: 'Ready',
        bedTemperature: 0,
        bedTargetTemperature: 0,
        nozzleTemperature: 0,
        nozzleTargetTemperature: 0,
        progress: 0,
        currentLayer: 0,
        totalLayers: 0,
        remainingTime: 0,
      },
    });
  }

  if (pathname === '/api/printer/features') {
    return sendJson(response, 200, {
      success: true,
      features: options.printerFeatures,
    });
  }

  if (pathname === '/api/contexts') {
    return sendJson(response, 200, {
      success: true,
      contexts: options.contexts,
      activeContextId: options.contexts.find((context) => context.isActive)?.id ?? options.contexts[0]?.id ?? null,
    });
  }

  if (pathname === '/api/contexts/switch' && request.method === 'POST') {
    const payload = (await readJsonBody(request)) as { contextId?: string };
    options.contexts.forEach((context) => {
      context.isActive = context.id === payload.contextId;
    });
    return sendJson(response, 200, {
      success: true,
      message: 'Switched printer',
    });
  }

  if (pathname === '/api/spoolman/config') {
    return sendJson(response, 200, {
      success: true,
      enabled: false,
      disabledReason: 'Fixture disabled',
      serverUrl: '',
      updateMode: 'weight',
      contextId: null,
    });
  }

  if (pathname === '/api/camera/proxy-config') {
    if (!options.cameraConfig) {
      return sendJson(response, 503, {
        success: false,
        error: 'Camera not configured',
      });
    }

    return sendJson(response, options.cameraConfig.success ? 200 : 503, options.cameraConfig);
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(response, 500, {
      success: false,
      error: `Unhandled fixture route: ${pathname}`,
    });
  }

  return false;
}

async function handleStaticRoute(requestUrl: URL, response: ServerResponse): Promise<void> {
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  const absolutePath = path.resolve(STATIC_ROOT, relativePath);

  if (!absolutePath.startsWith(STATIC_ROOT)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const content = await readFile(absolutePath);
    response.writeHead(200, {
      'Content-Type': getContentType(absolutePath),
      ...NO_STORE_HEADERS,
    });
    response.end(content);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

function isAuthorized(request: IncomingMessage, validTokens: Set<string>): boolean {
  const token = extractBearerToken(request);
  return !!token && validTokens.has(token);
}

function extractBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): true {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...NO_STORE_HEADERS,
  });
  response.end(JSON.stringify(payload));
  return true;
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...NO_STORE_HEADERS,
  });
  response.end(body);
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  if (filePath.endsWith('.ico')) {
    return 'image/x-icon';
  }

  return 'application/octet-stream';
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
