/**
 * @fileoverview Tests for WebUI context routes that list available contexts
 * and switch the active printer context.
 */

/**
 * @fileoverview Jest coverage for WebUI context route handlers.
 *
 * Verifies context listing, switching, and error handling for the API used by
 * the multi-printer WebUI context selector.
 */
import express from 'express';
import { registerContextRoutes } from '../context-routes.js';
import { startTestServer } from '../test-server.js';

describe('context-routes', () => {
  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {},
      contextManager: {
        getAllContexts: jest.fn().mockReturnValue([
          {
            id: 'context-1',
            printerDetails: {
              Name: 'AD5X',
              IPAddress: '192.168.1.10',
              SerialNumber: 'SN-1',
              printerModel: 'AD5X',
            },
          },
          {
            id: 'context-2',
            printerDetails: {
              Name: 'Legacy Printer',
              IPAddress: '192.168.1.11',
              SerialNumber: 'SN-2',
              printerModel: '',
            },
          },
        ]),
        getActiveContextId: jest.fn().mockReturnValue('context-1'),
        getContext: jest.fn().mockImplementation((contextId: string) => {
          if (contextId === 'context-1') {
            return {
              id: 'context-1',
              printerDetails: {
                Name: 'AD5X',
              },
            };
          }

          return null;
        }),
        switchContext: jest.fn(),
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {},
      ...overrides,
    } as any;
  }

  it('lists available contexts and marks the active printer', async () => {
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerContextRoutes(router, createDependencies());
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/contexts`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      contexts: [
        {
          id: 'context-1',
          name: 'AD5X',
          model: 'AD5X',
          ipAddress: '192.168.1.10',
          serialNumber: 'SN-1',
          isActive: true,
        },
        {
          id: 'context-2',
          name: 'Legacy Printer',
          model: 'Unknown',
          ipAddress: '192.168.1.11',
          serialNumber: 'SN-2',
          isActive: false,
        },
      ],
      activeContextId: 'context-1',
    });
  });

  it('validates that a context id is required before switching', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerContextRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/contexts/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: 'Context ID is required',
    });
    expect(deps.contextManager.switchContext).not.toHaveBeenCalled();
  });

  it('returns not found when the requested context does not exist', async () => {
    const deps = createDependencies({
      contextManager: {
        ...createDependencies().contextManager,
        getContext: jest.fn().mockReturnValue(null),
      },
    });
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerContextRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/contexts/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contextId: 'missing-context' }),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: 'Context missing-context not found',
    });
  });

  it('switches the active context and returns the printer name', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerContextRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/contexts/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contextId: 'context-1' }),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Switched to printer: AD5X',
    });
    expect(deps.contextManager.switchContext).toHaveBeenCalledWith('context-1');
  });
});
