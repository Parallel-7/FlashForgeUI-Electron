/**
 * @fileoverview Jest coverage for the WebUI temperature-control route handlers,
 * focusing on the Creator 5 series per-tool and chamber endpoints that route
 * through the FiveMClient temperature API rather than raw G-code.
 */

import express from 'express';
import { registerTemperatureRoutes } from '../temperature-routes.js';
import { startTestServer } from '../test-server.js';

describe('temperature-routes (Creator 5 multi-tool / chamber)', () => {
  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
        setToolTemperature: jest.fn().mockResolvedValue({ success: true }),
        cancelToolTemperature: jest.fn().mockResolvedValue({ success: true }),
        setChamberTemperature: jest.fn().mockResolvedValue({ success: true }),
        cancelChamberTemperature: jest.fn().mockResolvedValue({ success: true }),
        executeGCodeCommand: jest.fn().mockResolvedValue({ success: true }),
      },
      contextManager: {
        getActiveContextId: jest.fn().mockReturnValue('context-1'),
        getContext: jest.fn().mockReturnValue({
          id: 'context-1',
          printerDetails: { IPAddress: '192.168.1.10' },
        }),
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {},
      ...overrides,
    } as any;
  }

  async function withServer(
    deps: ReturnType<typeof createDependencies>,
    run: (baseUrl: string) => Promise<void>
  ): Promise<void> {
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerTemperatureRoutes(router, deps);
      app.use('/api', router);
    });
    try {
      await run(server.baseUrl);
    } finally {
      await server.close();
    }
  }

  it('sets a per-tool temperature via the backend manager', async () => {
    const deps = createDependencies();
    await withServer(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/printer/temperature/tool/2?contextId=context-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: 215 }),
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(deps.backendManager.setToolTemperature).toHaveBeenCalledWith('context-1', 2, 215);
    });
  });

  it('turns off a per-tool heater', async () => {
    const deps = createDependencies();
    await withServer(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/printer/temperature/tool/0/off?contextId=context-1`, {
        method: 'POST',
      });
      expect(response.status).toBe(200);
      expect(deps.backendManager.cancelToolTemperature).toHaveBeenCalledWith('context-1', 0);
    });
  });

  it('rejects an invalid tool index', async () => {
    const deps = createDependencies();
    await withServer(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/printer/temperature/tool/abc?contextId=context-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: 200 }),
      });
      expect(response.status).toBe(400);
      expect(deps.backendManager.setToolTemperature).not.toHaveBeenCalled();
    });
  });

  it('clamps the chamber temperature to the firmware ceiling', async () => {
    const deps = createDependencies();
    await withServer(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/printer/temperature/chamber?contextId=context-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: 120 }),
      });
      expect(response.status).toBe(200);
      expect(deps.backendManager.setChamberTemperature).toHaveBeenCalledWith('context-1', 80);
    });
  });

  it('turns off the chamber heater', async () => {
    const deps = createDependencies();
    await withServer(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/printer/temperature/chamber/off?contextId=context-1`, {
        method: 'POST',
      });
      expect(response.status).toBe(200);
      expect(deps.backendManager.cancelChamberTemperature).toHaveBeenCalledWith('context-1');
    });
  });
});
