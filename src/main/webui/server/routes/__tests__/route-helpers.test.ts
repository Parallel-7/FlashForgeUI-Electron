/**
 * @fileoverview Tests for shared route helper utilities that resolve printer
 * contexts and emit standardized API error responses.
 */

/**
 * @fileoverview Jest coverage for shared WebUI route helpers.
 *
 * Verifies the response and async-wrapping helpers reused by the individual
 * Express route modules in the authenticated WebUI server.
 */
import type { Response } from 'express';
import { resolveContext, sendErrorResponse } from '../route-helpers.js';

describe('route-helpers', () => {
  const context = {
    id: 'context-1',
    printerDetails: {
      Name: 'Printer',
    },
  };

  function createDependencies(overrides: Record<string, unknown> = {}) {
    return {
      backendManager: {
        isBackendReady: jest.fn().mockReturnValue(true),
        getBackendForContext: jest.fn().mockReturnValue({ id: 'backend-1' }),
      },
      contextManager: {
        getActiveContextId: jest.fn().mockReturnValue('context-1'),
        getContext: jest.fn().mockReturnValue(context),
      },
      connectionManager: {},
      configManager: {},
      spoolmanService: {},
      ...overrides,
    } as any;
  }

  it('prefers explicit context ids from query params and resolves backend instances when requested', () => {
    const result = resolveContext(
      {
        query: {
          contextId: 'context-2',
        },
      } as any,
      createDependencies({
        contextManager: {
          getActiveContextId: jest.fn().mockReturnValue('context-1'),
          getContext: jest.fn().mockImplementation((contextId: string) => ({
            ...context,
            id: contextId,
          })),
        },
      }),
      {
        requireBackendReady: true,
        requireBackendInstance: true,
      }
    );

    expect(result).toEqual({
      success: true,
      contextId: 'context-2',
      context: expect.objectContaining({ id: 'context-2' }),
      backend: { id: 'backend-1' },
    });
  });

  it('returns printer-not-connected when backend readiness is required but unavailable', () => {
    const result = resolveContext(
      {} as any,
      createDependencies({
        backendManager: {
          isBackendReady: jest.fn().mockReturnValue(false),
          getBackendForContext: jest.fn(),
        },
      }),
      {
        requireBackendReady: true,
      }
    );

    expect(result).toEqual({
      success: false,
      statusCode: 503,
      error: 'Printer not connected',
    });
  });

  it('writes standardized error payloads', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    sendErrorResponse(response, 404, 'Missing printer');

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: 'Missing printer',
    });
  });
});
