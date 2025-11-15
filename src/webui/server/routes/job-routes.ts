/**
 * @fileoverview Job listing and control routes (local/recent files plus start job).
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { JobStartRequestSchema } from '../../schemas/web-api.schemas';
import { createValidationError } from '../../schemas/web-api.schemas';
import { toAppError } from '../../../utils/error.utils';
import { StandardAPIResponse } from '../../types/web-api.types';
import { isAD5XJobInfo } from '../../../printer-backends/ad5x/ad5x-utils';
import type { AD5XJobInfo, BasicJobInfo } from '../../../types/printer-backend/backend-operations';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

type JobSource = 'local' | 'recent';

export function registerJobRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/jobs/local', async (req: AuthenticatedRequest, res: Response) => {
    await handleJobListRequest(req, res, deps, 'local');
  });

  router.get('/jobs/recent', async (req: AuthenticatedRequest, res: Response) => {
    await handleJobListRequest(req, res, deps, 'recent');
  });

  router.post('/jobs/start', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const validation = JobStartRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const materialMappings = validation.data.materialMappings;
      if (materialMappings) {
        const toolIdSet = new Set<number>();
        const slotIdSet = new Set<number>();

        for (const mapping of materialMappings) {
          if (toolIdSet.has(mapping.toolId)) {
            return sendErrorResponse<StandardAPIResponse>(
              res,
              400,
              `Duplicate toolId in materialMappings: ${mapping.toolId}`
            );
          }
          if (slotIdSet.has(mapping.slotId)) {
            return sendErrorResponse<StandardAPIResponse>(
              res,
              400,
              `Duplicate slotId in materialMappings: ${mapping.slotId}`
            );
          }

          toolIdSet.add(mapping.toolId);
          slotIdSet.add(mapping.slotId);
        }
      }

      const result = await deps.backendManager.startJob(contextResult.contextId, {
        operation: 'start',
        fileName: validation.data.filename,
        startNow: validation.data.startNow,
        leveling: validation.data.leveling,
        additionalParams:
          materialMappings && materialMappings.length > 0
            ? { materialMappings }
            : undefined
      });

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Starting print: ${validation.data.filename}` : undefined,
        error: result.error
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}

async function handleJobListRequest(
  req: AuthenticatedRequest,
  res: Response,
  deps: RouteDependencies,
  source: JobSource
): Promise<Response | void> {
  try {
    const contextResult = resolveContext(req, deps, { requireBackendReady: true });
    if (!contextResult.success) {
      return sendErrorResponse<StandardAPIResponse>(
        res,
        contextResult.statusCode,
        contextResult.error
      );
    }

    const result =
      source === 'local'
        ? await deps.backendManager.getLocalJobs(contextResult.contextId)
        : await deps.backendManager.getRecentJobs(contextResult.contextId);

    if (!result.success) {
      return sendErrorResponse<StandardAPIResponse>(
        res,
        500,
        result.error || `Failed to get ${source} jobs`
      );
    }

    return res.json({
      success: true,
      files: result.jobs.map(job => mapJobInfo(job)),
      totalCount: result.totalCount
    });
  } catch (error) {
    const appError = toAppError(error);
    return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
  }
}

function mapJobInfo(job: AD5XJobInfo | BasicJobInfo) {
  const base = {
    fileName: job.fileName,
    displayName: job.fileName,
    size: 0,
    lastModified: undefined,
    thumbnail: undefined,
    printingTime: job.printingTime ?? 0
  };

  if (isAD5XJobInfo(job)) {
    return {
      ...base,
      metadataType: 'ad5x' as const,
      toolCount: job.toolCount ?? job.toolDatas?.length ?? 0,
      toolDatas: job.toolDatas ?? [],
      totalFilamentWeight: job.totalFilamentWeight,
      useMatlStation: job.useMatlStation
    };
  }

  return {
    ...base,
    metadataType: 'basic' as const
  };
}
