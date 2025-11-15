/**
 * @fileoverview Printer context management routes (list + switch active context).
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { StandardAPIResponse } from '../../types/web-api.types';
import { toAppError } from '../../../utils/error.utils';
import type { RouteDependencies } from './route-helpers';

export function registerContextRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/contexts', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const allContexts = deps.contextManager.getAllContexts();
      const activeContextId = deps.contextManager.getActiveContextId();

      const contexts = allContexts.map(context => ({
        id: context.id,
        name: context.printerDetails.Name,
        model: context.printerDetails.printerModel || 'Unknown',
        ipAddress: context.printerDetails.IPAddress,
        serialNumber: context.printerDetails.SerialNumber,
        isActive: context.id === activeContextId
      }));

      return res.json({
        success: true,
        contexts,
        activeContextId
      });
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  router.post('/contexts/switch', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contextId } = req.body as { contextId?: string };

      if (!contextId || typeof contextId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Context ID is required'
        });
      }

      const context = deps.contextManager.getContext(contextId);
      if (!context) {
        return res.status(404).json({
          success: false,
          error: `Context ${contextId} not found`
        });
      }

      deps.contextManager.switchContext(contextId);
      return res.json({
        success: true,
        message: `Switched to printer: ${context.printerDetails.Name}`
      });
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });
}
