/**
 * @fileoverview Tests for Spoolman WebUI routes covering config, search,
 * selection, and active-spool state responses.
 */

import express from 'express';
import { registerSpoolmanRoutes } from '../spoolman-routes.js';
import { startTestServer } from '../test-server.js';

describe('spoolman-routes', () => {
  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
      },
      contextManager: {
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
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {
        isGloballyEnabled: jest.fn().mockReturnValue(true),
        isContextSupported: jest.fn().mockReturnValue(true),
        isStationContext: jest.fn().mockReturnValue(false),
        getSlotSpoolMap: jest.fn().mockReturnValue(new Map()),
        getDisabledReason: jest.fn().mockReturnValue(null),
        getServerUrl: jest.fn().mockReturnValue('http://spoolman.local'),
        getUpdateMode: jest.fn().mockReturnValue('weight'),
        fetchSpools: jest.fn().mockResolvedValue([
          {
            id: 101,
            filament: {
              name: 'PLA Black',
              vendor: { name: 'FlashForge' },
              material: 'PLA',
              color_hex: '#111111',
            },
            remaining_weight: 750,
            remaining_length: 123.4,
            archived: false,
          },
        ]),
        getActiveSpool: jest.fn().mockReturnValue({
          id: 55,
          name: 'PETG Blue',
          vendor: 'FlashForge',
          material: 'PETG',
          colorHex: '#0000ff',
          remainingWeight: 480,
          remainingLength: 88,
          lastUpdated: '2026-03-04T15:00:00.000Z',
        }),
        getSpoolById: jest.fn().mockResolvedValue({
          id: 77,
          name: 'ASA White',
          vendor: 'FlashForge',
          material: 'ASA',
          colorHex: '#ffffff',
          remainingWeight: 630,
          remainingLength: 95,
          lastUpdated: '2026-03-04T15:05:00.000Z',
        }),
        setActiveSpool: jest.fn().mockResolvedValue(undefined),
        clearActiveSpool: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides,
    } as any;
  }

  it('returns a disabled response when no active printer context exists', async () => {
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(
        router,
        createDependencies({
          contextManager: {
            ...createDependencies().contextManager,
            getActiveContextId: jest.fn().mockReturnValue(null),
          },
        })
      );
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/config`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      success: false,
      error: 'No active printer context',
      enabled: false,
      serverUrl: '',
      updateMode: 'weight',
      contextId: null,
    });
  });

  it('returns the active spoolman configuration for the current context', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/config`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      enabled: true,
      disabledReason: null,
      serverUrl: 'http://spoolman.local',
      updateMode: 'weight',
      contextId: 'context-1',
      // Non-station contexts carry no estimate-based tracking view.
      station: null,
    });
  });

  it('embeds the station tracking view for material-station contexts', async () => {
    const deps = createDependencies({
      spoolmanService: {
        ...createDependencies().spoolmanService,
        isStationContext: jest.fn().mockReturnValue(true),
        getSlotSpoolMap: jest.fn().mockReturnValue(
          new Map([
            [1, 101],
            [2, 102],
          ])
        ),
      },
    });
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/config`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.station?.supported).toBe(true);
    expect(body.station?.note).toContain('estimated from files uploaded through this app');
    expect(body.station?.slotAssignments).toEqual([
      { slotId: 1, spoolId: 101 },
      { slotId: 2, spoolId: 102 },
    ]);
    expect(body.station?.lastDeduction).toBeNull();
  });

  it('maps fetched spools into the WebUI search payload', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/spools?search=pla`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(deps.spoolmanService.fetchSpools).toHaveBeenCalledWith({
      limit: 50,
      allow_archived: false,
      'filament.name': 'pla',
    });
    expect(body).toEqual({
      success: true,
      spools: [
        {
          id: 101,
          name: 'PLA Black',
          vendor: 'FlashForge',
          material: 'PLA',
          colorHex: '#111111',
          remainingWeight: 750,
          remainingLength: 123.4,
          archived: false,
        },
      ],
    });
  });

  it('returns a conflict when the context has no Spoolman support', async () => {
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(
        router,
        createDependencies({
          spoolmanService: {
            ...createDependencies().spoolmanService,
            isContextSupported: jest.fn().mockReturnValue(false),
          },
        })
      );
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/active/context-1`);
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: 'Spoolman integration is not available for this printer',
      spool: null,
    });
  });

  it('assigns a slot spool for station contexts', async () => {
    const deps = createDependencies({
      spoolmanService: {
        ...createDependencies().spoolmanService,
        isStationContext: jest.fn().mockReturnValue(true),
        setSpoolForSlot: jest.fn(),
      },
    });
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/slot-spool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: 2, spoolId: 102 }),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    // The spool is validated before the assignment is persisted.
    expect(deps.spoolmanService.getSpoolById).toHaveBeenCalledWith(102);
    expect(deps.spoolmanService.setSpoolForSlot).toHaveBeenCalledWith('context-1', 2, 102);
    expect(body).toEqual({
      success: true,
      contextId: 'context-1',
      slotId: 2,
      spoolId: 102,
    });
  });

  it('rejects slot spool assignment for non-station contexts', async () => {
    const deps = createDependencies({
      spoolmanService: {
        ...createDependencies().spoolmanService,
        isStationContext: jest.fn().mockReturnValue(false),
        setSpoolForSlot: jest.fn(),
      },
    });
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/slot-spool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: 1, spoolId: 5 }),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Slot→spool assignments require a printer with a material station');
    expect(deps.spoolmanService.setSpoolForSlot).not.toHaveBeenCalled();
  });

  it('selects an active spool for the resolved context', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spoolId: 77,
      }),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(deps.spoolmanService.getSpoolById).toHaveBeenCalledWith(77);
    expect(deps.spoolmanService.setActiveSpool).toHaveBeenCalledWith('context-1', {
      id: 77,
      name: 'ASA White',
      vendor: 'FlashForge',
      material: 'ASA',
      colorHex: '#ffffff',
      remainingWeight: 630,
      remainingLength: 95,
      lastUpdated: '2026-03-04T15:05:00.000Z',
    });
    expect(body).toEqual({
      success: true,
      spool: {
        id: 77,
        name: 'ASA White',
        vendor: 'FlashForge',
        material: 'ASA',
        colorHex: '#ffffff',
        remainingWeight: 630,
        remainingLength: 95,
        lastUpdated: '2026-03-04T15:05:00.000Z',
      },
    });
  });

  it('clears the active spool for the resolved context', async () => {
    const deps = createDependencies();
    const server = await startTestServer((app) => {
      const router = express.Router();
      registerSpoolmanRoutes(router, deps);
      app.use('/api', router);
    });

    const response = await fetch(`${server.baseUrl}/api/spoolman/select`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    await server.close();

    expect(response.status).toBe(200);
    expect(deps.spoolmanService.clearActiveSpool).toHaveBeenCalledWith('context-1');
    expect(body).toEqual({
      success: true,
      message: 'Active spool cleared',
    });
  });
});
