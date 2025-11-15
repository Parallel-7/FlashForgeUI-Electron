/**
 * @fileoverview Shared helper utilities and dependency contracts for WebUI API route modules.
 *
 * Centralizes common plumbing for context resolution, backend readiness enforcement, and
 * standardized error responses so individual route modules can focus on business logic. The
 * helpers understand optional `contextId` overrides (query/body/params) to unlock true
 * multi-context REST support while keeping consistent HTTP status codes across endpoints.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import type { PrinterBackendManager } from '../../../managers/PrinterBackendManager';
import type { ConnectionFlowManager } from '../../../managers/ConnectionFlowManager';
import type {
  PrinterContextManager,
  PrinterContext
} from '../../../managers/PrinterContextManager';
import type { ConfigManager } from '../../../managers/ConfigManager';
import type { SpoolmanIntegrationService } from '../../../services/SpoolmanIntegrationService';
import type { BasePrinterBackend } from '../../../printer-backends/BasePrinterBackend';

/**
 * Common manager dependencies shared across most route modules.
 */
export interface RouteDependencies {
  readonly backendManager: PrinterBackendManager;
  readonly connectionManager: ConnectionFlowManager;
  readonly contextManager: PrinterContextManager;
  readonly configManager: ConfigManager;
  readonly spoolmanService: SpoolmanIntegrationService;
}

/**
 * Options for resolving a printer context from the incoming request.
 */
export interface ContextResolutionOptions {
  /** Explicit context ID override (highest priority). */
  readonly overrideContextId?: string | null;
  /** Name of the route parameter containing the context ID (e.g., `:contextId`). */
  readonly paramName?: string;
  /** When true, ensures the backend is ready before continuing. */
  readonly requireBackendReady?: boolean;
  /** When true, resolves the backend instance and includes it in the result. */
  readonly requireBackendInstance?: boolean;
}

/**
 * Successful context resolution payload returned to handlers.
 */
export interface ResolvedContext {
  readonly contextId: string;
  readonly context: PrinterContext;
  readonly backend?: BasePrinterBackend;
}

/**
 * Result union for context resolution attempts.
 */
export type ContextResolutionResult =
  | ({ success: true } & ResolvedContext)
  | { success: false; statusCode: number; error: string };

/**
 * Attempt to resolve a printer context ID from the request using optional overrides.
 */
export function resolveContext(
  req: AuthenticatedRequest,
  deps: RouteDependencies,
  options: ContextResolutionOptions = {}
): ContextResolutionResult {
  const candidate =
    normalizeContextId(options.overrideContextId) ??
    (options.paramName ? normalizeContextId(req.params?.[options.paramName]) : undefined) ??
    normalizeContextId(readValue(req.query?.contextId)) ??
    normalizeContextId(readValue((req.body as Record<string, unknown> | undefined)?.contextId)) ??
    deps.contextManager.getActiveContextId();

  if (!candidate) {
    return {
      success: false,
      statusCode: 503,
      error: 'No active printer context'
    };
  }

  const context = deps.contextManager.getContext(candidate);
  if (!context) {
    return {
      success: false,
      statusCode: 404,
      error: `Context ${candidate} not found`
    };
  }

  if (options.requireBackendReady && !deps.backendManager.isBackendReady(candidate)) {
    return {
      success: false,
      statusCode: 503,
      error: 'Printer not connected'
    };
  }

  let backend: BasePrinterBackend | undefined;
  if (options.requireBackendInstance) {
    backend = deps.backendManager.getBackendForContext(candidate) ?? undefined;
    if (!backend) {
      return {
        success: false,
        statusCode: 503,
        error: 'Backend not available'
      };
    }
  }

  return {
    success: true,
    contextId: candidate,
    context,
    backend
  };
}

/**
 * Convenience helper for returning standardized error payloads from modules.
 */
export function sendErrorResponse<T extends { success: boolean; error?: string }>(
  res: Response,
  statusCode: number,
  message: string,
  extras?: Partial<T>
): Response {
  const payload: T = {
    ...(extras ?? {}),
    success: false,
    error: message
  } as T;
  return res.status(statusCode).json(payload);
}

function normalizeContextId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function readValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value;
}
