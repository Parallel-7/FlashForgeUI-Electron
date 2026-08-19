/**
 * @fileoverview Job upload routes - the browser-side equivalent of the desktop job uploader.
 *
 * The desktop dialog picks a file with a native dialog, parses it with
 * `@parallel-7/slicer-meta`, and hands the local path to the printer backend.
 * A browser has no local path to give, so the flow is split into three calls:
 *
 * 1. POST /jobs/upload/stage  - raw file bytes in, parsed metadata + handle out
 * 2. POST /jobs/upload/start  - handle + options in, printer upload performed
 * 3. POST /jobs/upload/cancel - handle in, scratch file dropped
 *
 * Staging deliberately happens up front (while the dialog shows "Parsing file")
 * so the start call has a real path for `uploadFileAD5X` / `startJob`, exactly
 * as the desktop handlers receive one.
 *
 * Key exports:
 * - registerJobUploadRoutes(): mounts the three endpoints on the API router
 */

import type { AD5XMaterialMapping } from '@ghosttypes/ff-api';
import { type ParseResult, parseSlicerFile } from '@parallel-7/slicer-meta';
import type {
  JobUploadStageResponse,
  JobUploadStartResponse,
  StandardAPIResponse,
  UploadFilamentInfo,
  UploadJobMetadata,
  UploadSliceWarning,
} from '@shared/types/web-api.types.js';
import express, { type Response, type Router } from 'express';
import { toAppError } from '../../../utils/error.utils.js';
import {
  createValidationError,
  JobUploadCancelRequestSchema,
  JobUploadStartRequestSchema,
} from '../../schemas/web-api.schemas.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { discardStagedUpload, getStagedUpload, isAllowedJobFileName, stageUpload } from '../upload-staging.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

/**
 * Largest job file accepted in one request. Sliced 3MFs with dense thumbnails and
 * multi-plate data routinely reach a few hundred megabytes.
 */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export function registerJobUploadRoutes(router: Router, deps: RouteDependencies): void {
  router.post(
    '/jobs/upload/stage',
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    async (req: AuthenticatedRequest, res: Response) => {
      await handleStageRequest(req, res, deps);
    }
  );

  router.post('/jobs/upload/start', async (req: AuthenticatedRequest, res: Response) => {
    await handleStartRequest(req, res, deps);
  });

  router.post('/jobs/upload/cancel', async (req: AuthenticatedRequest, res: Response) => {
    const validation = JobUploadCancelRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const validationError = createValidationError(validation.error);
      return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
    }

    await discardStagedUpload(validation.data.uploadId);
    return res.json({ success: true } satisfies StandardAPIResponse);
  });
}

/**
 * Accept the raw file body, write it to scratch storage, and parse its metadata.
 *
 * A parse failure discards the staged file and reports the parser's message, so
 * the browser can render the same "Could not parse file metadata" alert the
 * desktop dialog shows.
 */
async function handleStageRequest(
  req: AuthenticatedRequest,
  res: Response,
  deps: RouteDependencies
): Promise<Response | undefined> {
  let uploadId: string | null = null;

  try {
    const contextResult = resolveContext(req, deps, { requireBackendReady: true });
    if (!contextResult.success) {
      return sendErrorResponse<JobUploadStageResponse>(res, contextResult.statusCode, contextResult.error);
    }

    const filenameParam = req.query.filename;
    const fileName = typeof filenameParam === 'string' ? filenameParam : '';
    if (!isAllowedJobFileName(fileName)) {
      return sendErrorResponse<JobUploadStageResponse>(
        res,
        400,
        'filename must be a bare job file name ending in .gcode, .gx or .3mf'
      );
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.byteLength === 0) {
      return sendErrorResponse<JobUploadStageResponse>(res, 400, 'Request body must contain the job file');
    }

    // Material-station printers (AD5X, Creator 5 / 5 Pro) only accept 3MF files,
    // which carry the per-tool material data the firmware needs for matching.
    // The client blocks this earlier to avoid a pointless transfer; this is the guard.
    const hasMaterialStation = deps.backendManager.isFeatureAvailable(contextResult.contextId, 'material-station');
    const is3MF = fileName.toLowerCase().endsWith('.3mf');
    if (hasMaterialStation && !is3MF) {
      return sendErrorResponse<JobUploadStageResponse>(res, 400, 'This printer only supports 3MF files.');
    }

    const staged = await stageUpload(fileName, body);
    uploadId = staged.id;

    const parsed = await parseSlicerFile(staged.filePath);

    return res.json({
      success: true,
      uploadId: staged.id,
      fileName: staged.fileName,
      metadata: normalizeMetadata(parsed),
      requiresMaterialMatching: hasMaterialStation && is3MF,
    } satisfies JobUploadStageResponse);
  } catch (error) {
    if (uploadId) {
      await discardStagedUpload(uploadId);
    }
    const appError = toAppError(error);
    return sendErrorResponse<JobUploadStageResponse>(res, 500, appError.message);
  }
}

/**
 * Send a staged file to the printer.
 *
 * Mirrors the desktop split: material-station printers take the material-aware
 * 3MF path (`uploadFileAD5X`), everything else goes through `startJob` with a
 * `filePath`, which uploads and optionally starts the job.
 */
async function handleStartRequest(
  req: AuthenticatedRequest,
  res: Response,
  deps: RouteDependencies
): Promise<Response | undefined> {
  try {
    const contextResult = resolveContext(req, deps, { requireBackendReady: true });
    if (!contextResult.success) {
      return sendErrorResponse<JobUploadStartResponse>(res, contextResult.statusCode, contextResult.error);
    }

    const validation = JobUploadStartRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const validationError = createValidationError(validation.error);
      return sendErrorResponse<JobUploadStartResponse>(res, 400, validationError.error);
    }

    const { uploadId, startNow, autoLevel, materialMappings } = validation.data;
    const staged = getStagedUpload(uploadId);
    if (!staged) {
      return sendErrorResponse<JobUploadStartResponse>(
        res,
        410,
        'The staged file is no longer available. Select the file again.'
      );
    }

    const mappingError = materialMappings ? findDuplicateMappingError(materialMappings) : null;
    if (mappingError) {
      return sendErrorResponse<JobUploadStartResponse>(res, 400, mappingError);
    }

    const hasMaterialStation = deps.backendManager.isFeatureAvailable(contextResult.contextId, 'material-station');
    const is3MF = staged.fileName.toLowerCase().endsWith('.3mf');

    try {
      if (hasMaterialStation && !is3MF) {
        return sendErrorResponse<JobUploadStartResponse>(res, 400, 'This printer only supports 3MF files.');
      }

      const result = hasMaterialStation
        ? await deps.backendManager.uploadFileAD5X(
            contextResult.contextId,
            staged.filePath,
            startNow,
            autoLevel,
            materialMappings as AD5XMaterialMapping[] | undefined
          )
        : await deps.backendManager.startJob(contextResult.contextId, {
            operation: 'start',
            filePath: staged.filePath,
            fileName: staged.fileName,
            leveling: autoLevel,
            startNow,
          });

      const response: JobUploadStartResponse = {
        success: result.success,
        fileName: result.fileName || staged.fileName,
        started: result.started,
        message: result.success ? `Uploaded ${result.fileName || staged.fileName}` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } finally {
      // The backend has read the file by now either way; keeping it around only
      // risks a stale replay against a different printer context.
      await discardStagedUpload(uploadId);
    }
  } catch (error) {
    const appError = toAppError(error);
    return sendErrorResponse<JobUploadStartResponse>(res, 500, appError.message);
  }
}

/** Reject mappings that reuse a tool or a slot, matching the /jobs/start guard. */
function findDuplicateMappingError(mappings: readonly { toolId: number; slotId: number }[]): string | null {
  const toolIds = new Set<number>();
  const slotIds = new Set<number>();

  for (const mapping of mappings) {
    if (toolIds.has(mapping.toolId)) {
      return `Duplicate toolId in materialMappings: ${mapping.toolId}`;
    }
    if (slotIds.has(mapping.slotId)) {
      return `Duplicate slotId in materialMappings: ${mapping.slotId}`;
    }
    toolIds.add(mapping.toolId);
    slotIds.add(mapping.slotId);
  }

  return null;
}

/**
 * Collapse a slicer-meta ParseResult into the flat shape the WebUI renders.
 *
 * Every fallback chain below is copied from the desktop job uploader's
 * `populateMetadata`, so both surfaces show the same value for the same file.
 */
function normalizeMetadata(parsed: ParseResult): UploadJobMetadata {
  const file = parsed.file ?? null;
  const threeMf = parsed.threeMf ?? null;
  const slicer = parsed.slicer ?? null;

  const filamentLengthM = resolveFilamentLengthM(parsed);

  return {
    printerModel: file?.printerModel || threeMf?.printerModelId || null,
    filamentType: file?.filamentType || threeMf?.filaments?.[0]?.type || null,
    filamentLengthM,
    // The desktop only renders a weight when it also has a length, so resolving
    // one without the other would surface a value the desktop hides.
    filamentWeightG: filamentLengthM === null ? null : resolveFilamentWeightG(parsed),
    supportUsed: threeMf ? threeMf.supportUsed : null,
    slicerName: slicer?.slicerName || null,
    slicerVersion: slicer?.slicerVersion || null,
    sliceDate: slicer?.sliceDate || null,
    sliceTime: slicer?.sliceTime || null,
    printEta: slicer?.printEta || null,
    layerHeight: file?.layerHeight ?? null,
    infillDensity: file?.infillDensity ?? null,
    layerCount: file?.layerCount ?? null,
    firstLayerTime: threeMf?.firstLayerTime ?? null,
    warnings: (threeMf?.warnings ?? []).map(
      (warning): UploadSliceWarning => ({
        level: warning.level,
        message: warning.message || warning.msg,
      })
    ),
    thumbnail: normalizeThumbnail(threeMf?.plateImage || file?.thumbnail || null),
    filaments: (threeMf?.filaments ?? file?.filaments ?? []).map(
      (filament): UploadFilamentInfo => ({
        type: filament.type ?? null,
        color: filament.color ?? null,
        usedM: filament.usedM ?? null,
        usedG: filament.usedG ?? null,
      })
    ),
  };
}

function resolveFilamentLengthM(parsed: ParseResult): number | null {
  const fromFile = parseNumeric(parsed.file?.filaments?.[0]?.usedM);
  if (fromFile !== null) {
    return fromFile;
  }
  const fromThreeMf = parseNumeric(parsed.threeMf?.filaments?.[0]?.usedM);
  if (fromThreeMf !== null) {
    return fromThreeMf;
  }
  if (parsed.file?.filamentUsedMM) {
    return parsed.file.filamentUsedMM / 1000;
  }
  return null;
}

function resolveFilamentWeightG(parsed: ParseResult): number | null {
  if (parsed.file?.filamentUsedG) {
    return parsed.file.filamentUsedG;
  }
  const fromThreeMf = parseNumeric(parsed.threeMf?.filaments?.[0]?.usedG);
  if (fromThreeMf !== null) {
    return fromThreeMf;
  }
  return parseNumeric(parsed.file?.filaments?.[0]?.usedG);
}

function parseNumeric(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Strip any data URL prefix so the client can apply one consistently. */
function normalizeThumbnail(thumbnail: string | null): string | null {
  if (!thumbnail) {
    return null;
  }
  return thumbnail.replace(/^data:image\/\w+;base64,/, '');
}
