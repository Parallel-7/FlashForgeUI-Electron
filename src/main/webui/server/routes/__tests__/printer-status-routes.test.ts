/**
 * @fileoverview Tests for printer-status WebUI routes covering normalized status
 * payloads and backend-availability guard rails.
 */

/**
 * @fileoverview Jest coverage for WebUI printer-status route handlers.
 *
 * Tests status polling, command-facing responses, and route error handling for
 * the HTTP API that backs WebUI status panels.
 */
import express from 'express';
import { registerPrinterStatusRoutes } from '../printer-status-routes.js';
import { startTestServer } from '../test-server.js';

describe('printer-status-routes', () => {
  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
        getPrinterStatus: jest.fn().mockResolvedValue({
          success: true,
          status: {
            printerState: 'printing',
            bedTemperature: 60,
            nozzleTemperature: 220,
            progress: 42,
            currentJob: 'demo.gcode',
            remainingTime: 120,
            currentLayer: 12,
            totalLayers: 40,
            bedTargetTemperature: 65,
            nozzleTargetTemperature: 225,
            printDuration: 600,
            filtration: {
              mode: 'internal',
            },
            estimatedRightWeight: 18.5,
            estimatedRightLen: 1250,
            cumulativeFilament: 321,
            cumulativePrintTime: 654,
            printEta: '04:48',
          },
        }),
        getFeatures: jest.fn().mockReturnValue({
          ledControl: {
            customControlEnabled: true,
            usesLegacyAPI: false,
          },
          jobManagement: {
            pauseResume: true,
            cancelJobs: true,
          },
        }),
        isFeatureAvailable: jest.fn().mockImplementation((_contextId: string, feature: string) => {
          return feature === 'camera' || feature === 'led-control' || feature === 'filtration';
        }),
        getMaterialStationStatus: jest.fn().mockReturnValue({
          connected: true,
          slots: [],
          activeSlot: null,
          overallStatus: 'ready',
          errorMessage: null,
        }),
      },
      contextManager: {
        getActiveContextId: jest.fn().mockReturnValue('context-1'),
        getContext: jest.fn().mockReturnValue({
          id: 'context-1',
          printerDetails: {
            IPAddress: '192.168.1.10',
          },
        }),
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {},
      ...overrides,
    } as any;
  }

  it('maps printer status responses into the WebUI payload shape', async () => {
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerPrinterStatusRoutes(router, createDependencies());
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/printer/status?contextId=context-1`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      status: {
        printerState: 'printing',
        bedTemperature: 60,
        bedTargetTemperature: 65,
        nozzleTemperature: 220,
        nozzleTargetTemperature: 225,
        progress: 42,
        currentLayer: 12,
        totalLayers: 40,
        jobName: 'demo.gcode',
        timeElapsed: 10,
        timeRemaining: 120,
        filtrationMode: 'internal',
        estimatedWeight: 18.5,
        estimatedLength: 1.25,
        cumulativeFilament: 321,
        cumulativePrintTime: 654,
        formattedEta: '04:48',
        elapsedTimeSeconds: 600,
      },
    });
  });

  it('reports printer features using backend availability checks', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerPrinterStatusRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/printer/features?contextId=context-1`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      features: {
        hasCamera: true,
        hasLED: true,
        hasFiltration: true,
        hasMaterialStation: false,
        canPause: true,
        canResume: true,
        canCancel: true,
        ledUsesLegacyAPI: true,
      },
    });
  });

  it('returns material-station data only when the printer supports it', async () => {
    const unsupportedDeps = createDependencies({
      backendManager: {
        ...createDependencies().backendManager,
        isFeatureAvailable: jest.fn().mockReturnValue(false),
      },
    });
    const unsupportedServer = await startTestServer((app) => {
      const router = express.Router();
      registerPrinterStatusRoutes(router, unsupportedDeps);
      app.use('/api', router);
    });

    const unsupportedResponse = await fetch(
      `${unsupportedServer.baseUrl}/api/printer/material-station?contextId=context-1`
    );
    const unsupportedBody = await unsupportedResponse.json();
    await unsupportedServer.close();

    expect(unsupportedResponse.status).toBe(200);
    expect(unsupportedBody).toEqual({
      success: false,
      error: 'Material station not available on this printer',
    });

    const supportedDeps = createDependencies({
      backendManager: {
        ...createDependencies().backendManager,
        isFeatureAvailable: jest
          .fn()
          .mockImplementation((_contextId: string, feature: string) => feature === 'material-station'),
      },
    });
    const supportedServer = await startTestServer((app) => {
      const router = express.Router();
      registerPrinterStatusRoutes(router, supportedDeps);
      app.use('/api', router);
    });

    const supportedResponse = await fetch(
      `${supportedServer.baseUrl}/api/printer/material-station?contextId=context-1`
    );
    const supportedBody = await supportedResponse.json();
    await supportedServer.close();

    expect(supportedResponse.status).toBe(200);
    expect(supportedBody).toEqual({
      success: true,
      status: {
        connected: true,
        slots: [],
        activeSlot: null,
        overallStatus: 'ready',
        errorMessage: null,
      },
    });
  });
});
