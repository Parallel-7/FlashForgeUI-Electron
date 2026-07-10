/**
 * @fileoverview Printer power API routes for the WebUI server.
 *
 * Exposes the remote "Reboot Printer" feature to WebUI clients. The route
 * delegates to the shared startPrinterReboot() core (same code path as the
 * desktop IPC handler), so validation, the SSH dispatch, and the reconnect
 * monitor behave identically on both surfaces. Reboot lifecycle updates reach
 * the browser over the REBOOT_STATUS WebSocket broadcast; this route only
 * acknowledges that the reboot was dispatched.
 *
 * Routes:
 * - POST /printer/reboot: dispatch a reboot for the resolved context
 * - GET  /printer/reboot/support: whether the resolved context supports reboot
 */

import type { Response, Router } from 'express';
import { startPrinterReboot } from '../../../ipc/handlers/printer-power-handlers.js';
import { toAppError } from '../../../utils/error.utils.js';
import { isRebootSupportedModel } from '../../../utils/PrinterUtils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

export function registerPrinterPowerRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/printer/reboot/support', (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }
    const modelType = resolution.context.printerDetails.modelType;
    return res.json({
      success: true,
      supported: isRebootSupportedModel(modelType),
      contextId: resolution.contextId,
      printerName: resolution.context.printerDetails.Name,
    });
  });

  router.post('/printer/reboot', async (req: AuthenticatedRequest, res: Response) => {
    const resolution = resolveContext(req, deps);
    if (!resolution.success) {
      return sendErrorResponse(res, resolution.statusCode, resolution.error);
    }

    try {
      await startPrinterReboot(resolution.contextId);
      return res.json({ success: true, contextId: resolution.contextId });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });
}
