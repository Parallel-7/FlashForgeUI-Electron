/**
 * @fileoverview Centralized per-printer SSH settings API routes for the WebUI server.
 *
 * Mirrors the desktop Settings -> SSH tab over authenticated REST so browser
 * clients can view and edit the credentials consumed by every SSH feature
 * (file manager, calibration assistant, reboot). Credentials are stored per
 * printer serial via SSHSettingsService.
 *
 * SECURITY: the stored password is WRITE-ONLY over this surface. GET responses
 * never include the password — only whether a custom (non easy-SSH default)
 * password is set. Submitting a new password overwrites it; submitting an
 * empty string resets it to the easy-SSH default; omitting the field keeps
 * the current value.
 *
 * Routes:
 * - GET  /ssh-settings: resolved settings (password redacted) for the context
 * - POST /ssh-settings: apply a partial update
 * - POST /ssh-settings/reset: restore the easy-SSH defaults
 */

import type { Response, Router } from 'express';
import { SSH_DEFAULTS, type SSHSettingsUpdate } from '@shared/types/ssh-settings.js';
import { getSSHSettingsService } from '../../../services/SSHSettingsService.js';
import { toAppError } from '../../../utils/error.utils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

/** SSH settings shape returned to WebUI clients (password redacted). */
export interface WebUISSHSettings {
  readonly username: string;
  readonly port: number;
  readonly keyPath?: string;
  readonly isCustom: boolean;
  /** True when a non-default password is stored (the value itself is never sent). */
  readonly passwordIsCustom: boolean;
}

/** Coerce and validate the incoming update payload; null when malformed. */
function parseUpdatePayload(body: unknown): SSHSettingsUpdate | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const update: {
    username?: string;
    password?: string;
    port?: number;
    keyPath?: string;
  } = {};

  if (raw.username !== undefined) {
    if (typeof raw.username !== 'string') return null;
    update.username = raw.username;
  }
  if (raw.password !== undefined) {
    if (typeof raw.password !== 'string') return null;
    update.password = raw.password;
  }
  if (raw.port !== undefined) {
    const port = typeof raw.port === 'number' ? raw.port : Number(raw.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
    update.port = port;
  }
  if (raw.keyPath !== undefined) {
    if (typeof raw.keyPath !== 'string') return null;
    update.keyPath = raw.keyPath;
  }
  return update;
}

export function registerSSHSettingsRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/ssh-settings', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    try {
      const details = resolution.context.printerDetails;
      const settings = await getSSHSettingsService().getSettings(details.SerialNumber);
      const redacted: WebUISSHSettings = {
        username: settings.username,
        port: settings.port,
        keyPath: settings.keyPath,
        isCustom: settings.isCustom,
        passwordIsCustom: settings.password !== SSH_DEFAULTS.password,
      };
      return res.json({
        success: true,
        settings: redacted,
        printerName: details.Name,
        contextId: resolution.contextId,
      });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/ssh-settings', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    const update = parseUpdatePayload(req.body);
    if (!update) {
      return sendErrorResponse(res, 400, 'Invalid SSH settings payload');
    }

    try {
      await getSSHSettingsService().updateSettings(resolution.context.printerDetails.SerialNumber, update);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/ssh-settings/reset', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    try {
      await getSSHSettingsService().resetSettings(resolution.context.printerDetails.SerialNumber);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });
}
