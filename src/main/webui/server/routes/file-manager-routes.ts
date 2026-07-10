/**
 * @fileoverview SFTP file manager API routes for the WebUI server.
 *
 * Mirrors the desktop file manager IPC surface (file-manager-handlers.ts) over
 * authenticated REST so browser clients can browse, delete, and rename printer
 * files via the main-process FileManagerService. Unlike the desktop dialog
 * (which pins the context at window-open time in the main process), REST
 * clients pin the context themselves: the WebUI dialog captures the contextId
 * when it opens and passes it explicitly on every request, so switching the
 * active context mid-session never retargets operations.
 *
 * Routes:
 * - GET  /file-manager/support: cheap model-only support check (no SSH probe)
 * - GET  /file-manager/capabilities: model support + USB probe
 * - GET  /file-manager/files?storage=&path=: list a storage location
 * - POST /file-manager/delete { storage, paths }: batch delete
 * - POST /file-manager/rename { storage, path, newName }: rename in place
 * - GET  /file-manager/thumbnail?storage=&path=: cached/remote thumbnail fetch
 */

import type { Response, Router } from 'express';
import type { FileManagerStorageKind } from '@shared/types/file-manager.js';
import {
  FileManagerService,
  type FileManagerTarget,
  getFileManagerService,
} from '../../../services/FileManagerService.js';
import { toAppError } from '../../../utils/error.utils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import {
  type ResolvedContext,
  type RouteDependencies,
  resolveContext,
  sendErrorResponse,
} from './route-helpers.js';

/** Convert a resolved printer context into a FileManagerService target. */
function toFileManagerTarget(resolution: ResolvedContext): FileManagerTarget {
  const details = resolution.context.printerDetails;
  return {
    contextId: resolution.contextId,
    ipAddress: details.IPAddress,
    serialNumber: details.SerialNumber,
    printerName: details.Name,
    modelType: details.modelType,
  };
}

/** Validate the storage discriminator from query/body input. */
function parseStorage(value: unknown): FileManagerStorageKind | null {
  return value === 'internal' || value === 'usb' ? value : null;
}

/** Read a single string value from an Express query parameter. */
function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export function registerFileManagerRoutes(router: Router, deps: RouteDependencies): void {
  const service = getFileManagerService();

  // Model-only support probe: cheap enough to gate topbar buttons on every
  // context switch (the full capabilities call opens an SSH session).
  router.get('/file-manager/support', (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }
    const details = resolution.context.printerDetails;
    return res.json({
      success: true,
      supported: FileManagerService.isModelSupported(details.modelType),
      contextId: resolution.contextId,
      printerName: details.Name,
    });
  });

  router.get('/file-manager/capabilities', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error, {
        supported: false,
        usbPresent: false,
        usbMounts: [],
      });
    }

    try {
      const capabilities = await service.getCapabilities(toFileManagerTarget(resolution));
      return res.json({ success: true, contextId: resolution.contextId, ...capabilities });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/file-manager/files', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    const storage = parseStorage(readString(req.query?.storage));
    if (!storage) {
      return sendErrorResponse(res, 400, 'Invalid storage kind');
    }
    const path = readString(req.query?.path) ?? '';

    try {
      const listing = await service.listFiles(toFileManagerTarget(resolution), storage, path);
      return res.json(listing);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/file-manager/delete', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const storage = parseStorage(body.storage);
    const paths = body.paths;
    if (!storage || !Array.isArray(paths) || paths.some((path) => typeof path !== 'string')) {
      return sendErrorResponse(res, 400, 'Invalid delete request');
    }

    try {
      const result = await service.deleteFiles(toFileManagerTarget(resolution), storage, paths as string[]);
      return res.json(result);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/file-manager/rename', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const storage = parseStorage(body.storage);
    if (!storage || typeof body.path !== 'string' || typeof body.newName !== 'string') {
      return sendErrorResponse(res, 400, 'Invalid rename request');
    }

    try {
      const result = await service.renameFile(toFileManagerTarget(resolution), storage, body.path, body.newName);
      return res.json(result);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/file-manager/thumbnail', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    const storage = parseStorage(readString(req.query?.storage));
    const path = readString(req.query?.path);
    if (!storage || !path) {
      return sendErrorResponse(res, 400, 'Invalid thumbnail request');
    }

    try {
      const result = await service.getThumbnail(toFileManagerTarget(resolution), storage, path);
      return res.json(result);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });
}
