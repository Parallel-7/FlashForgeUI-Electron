/**
 * @fileoverview Tests for WebUIManager startup, port binding, static asset serving,
 * and integration with auth and websocket services.
 */

/**
 * @fileoverview Jest coverage for `WebUIManager`.
 *
 * Verifies WebUI server startup/shutdown, auth-aware wiring, and coordination
 * between Express routes, WebSocket handling, and config-driven behavior.
 */
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { getConfigManager } from '../../../managers/ConfigManager.js';
import { getPrinterConnectionManager } from '../../../managers/ConnectionFlowManager.js';
import { getEnvironmentDetectionService } from '../../../services/EnvironmentDetectionService.js';
import { getAuthManager } from '../AuthManager.js';
import { getWebSocketManager } from '../WebSocketManager.js';
import { getWebUIManager, WebUIManager } from '../WebUIManager.js';

jest.mock('electron', () => ({
  app: {
    quit: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([]),
  },
  dialog: {
    showMessageBox: jest.fn(),
  },
}));

jest.mock('../../../managers/ConfigManager.js', () => ({
  getConfigManager: jest.fn(),
}));

jest.mock('../../../managers/ConnectionFlowManager.js', () => ({
  getPrinterConnectionManager: jest.fn(),
}));

jest.mock('../../../services/EnvironmentDetectionService.js', () => ({
  getEnvironmentDetectionService: jest.fn(),
}));

jest.mock('../AuthManager.js', () => ({
  getAuthManager: jest.fn(),
}));

jest.mock('../WebSocketManager.js', () => ({
  getWebSocketManager: jest.fn(),
}));

jest.mock('../api-routes.js', () => {
  const express = require('express');
  return {
    buildRouteDependencies: jest.fn(() => ({})),
    createAPIRoutes: jest.fn(() => express.Router()),
  };
});

jest.mock('../auth-middleware.js', () => ({
  createRequestLogger: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  createAuthMiddleware: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  createLoginRateLimiter: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  createErrorMiddleware: jest.fn(() => (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next()),
}));

jest.mock('../security-middleware.js', () => ({
  createSecurityMiddleware: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

jest.mock('../routes/theme-routes.js', () => ({
  registerPublicThemeRoutes: jest.fn(),
}));

describe('WebUIManager', () => {
  const tempDirectories: string[] = [];
  const configManager = Object.assign(new EventEmitter(), {
    getConfig: jest.fn(),
    get: jest.fn(),
    on: EventEmitter.prototype.on,
  });
  const connectionManager = Object.assign(new EventEmitter(), {
    on: EventEmitter.prototype.on,
  });
  const environmentService = {
    getWebUIStaticPath: jest.fn(),
    isRunningAsAdmin: jest.fn().mockReturnValue(true),
  };
  const authManager = {
    initialize: jest.fn(),
    isAuthenticationRequired: jest.fn().mockReturnValue(false),
    getAuthStatus: jest.fn().mockReturnValue({
      authRequired: false,
      hasPassword: false,
      defaultPassword: false,
    }),
    extractTokenFromHeader: jest.fn(),
    verifyToken: jest.fn().mockReturnValue(false),
    revokeToken: jest.fn(),
    validateLogin: jest.fn(),
    dispose: jest.fn(),
  };
  const webSocketManager = {
    initialize: jest.fn(),
    shutdown: jest.fn(),
    dispose: jest.fn(),
    broadcastPrinterStatus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (WebUIManager as any).instance = null;
    (getConfigManager as jest.Mock).mockReturnValue(configManager);
    (getPrinterConnectionManager as jest.Mock).mockReturnValue(connectionManager);
    (getEnvironmentDetectionService as jest.Mock).mockReturnValue(environmentService);
    (getAuthManager as jest.Mock).mockReturnValue(authManager);
    (getWebSocketManager as jest.Mock).mockReturnValue(webSocketManager);
    configManager.getConfig.mockReturnValue({
      WebUIEnabled: true,
      WebUIPort: 0,
      WebUIPassword: '',
      WebUIPasswordRequired: false,
    });
    configManager.get.mockImplementation((key: string) => {
      if (key === 'WebUIEnabled') {
        return true;
      }
      return null;
    });
  });

  afterEach(async () => {
    const manager = (WebUIManager as any).instance as WebUIManager | null;
    if (manager) {
      await manager.dispose();
    }
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
    (WebUIManager as any).instance = null;
  });

  it('serves WebUI static assets with no-store cache headers', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffui-webui-manager-'));
    tempDirectories.push(tempDir);
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<!DOCTYPE html><html><body>fixture</body></html>', 'utf8');
    environmentService.getWebUIStaticPath.mockReturnValue(tempDir);

    const manager = getWebUIManager();
    const started = await manager.start();

    expect(started).toBe(true);
    expect(webSocketManager.initialize).toHaveBeenCalled();

    const server = manager.getHttpServer()!;
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/index.html`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('fixture');
    expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
  });
});
