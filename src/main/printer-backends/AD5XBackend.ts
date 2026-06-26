/**
 * @fileoverview Backend implementation for AD5X printers with material station support.
 *
 * The AD5X maps materials at UPLOAD time: `uploadFileAD5X` carries the full material
 * mappings (and AD5X-only flags like `firstLayerInspection`) on the upload request, and
 * the print is started either by `printNow` on that upload or by a later
 * `startAD5X*Job` against an already-resident file.
 *
 * Shared material-station machinery (slot config, status extraction, recent jobs) lives
 * in {@link MaterialStationBackend}; this class is a sibling of {@link Creator5Backend},
 * not its parent, so AD5X-specific wire formats can never leak into the Creator 5.
 *
 * Key exports:
 * - AD5XBackend class: Backend for AD5X series printers
 */

import type { AD5XMaterialMapping, AD5XUploadParams } from '@ghosttypes/ff-api';
import {
  JobOperationParams,
  JobStartResult,
  PrinterFeatureSet,
} from '@shared/types/printer-backend/index.js';
import * as path from 'path';
import { MaterialStationBackend } from './MaterialStationBackend.js';

/**
 * Backend implementation for AD5X printer.
 * Uses dual API with material station support; materials are mapped at upload time.
 */
export class AD5XBackend extends MaterialStationBackend {
  /**
   * AD5X base features: the shared material-station set with no built-in camera
   * (custom URL only) and LED control gated behind the CustomLeds setting. LED and
   * filtration are further resolved from the product endpoint by `getBaseFeatures`.
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    return this.materialStationBaseFeatures();
  }

  /**
   * Perform AD5X-specific initialization.
   */
  protected async initializeBackend(): Promise<void> {
    await super.initializeBackend();
    console.log('- Job starting: Enabled with material station support');
  }

  /**
   * Start a job on the AD5X. New files upload via {@link uploadFileAD5X}; this path
   * starts a file already resident on the printer, picking the multi- or single-color
   * command based on whether material mappings were provided.
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    try {
      // Handle file upload case
      if (params.filePath) {
        const success = await this.fiveMClient.jobControl.uploadFile(
          params.filePath,
          params.startNow,
          params.leveling
        );

        if (!success) {
          throw new Error('Failed to upload and start job');
        }

        return {
          success: true,
          fileName: params.fileName || params.filePath,
          started: params.startNow,
          timestamp: new Date(),
        };
      }

      // Handle local file printing case
      if (!params.fileName) {
        throw new Error('fileName or filePath is required');
      }

      // Only proceed with printing if startNow is true
      if (!params.startNow) {
        return {
          success: true,
          fileName: params.fileName,
          started: false,
          timestamp: new Date(),
        };
      }

      // Check if material mappings are provided for multi-color job
      const materialMappings = params.additionalParams?.materialMappings as
        | AD5XMaterialMapping[]
        | undefined;

      if (materialMappings && materialMappings.length > 0) {
        console.log(
          `Starting AD5X multi-color job: ${params.fileName} with ${materialMappings.length} material mappings`
        );

        const success = await this.fiveMClient.jobControl.startAD5XMultiColorJob({
          fileName: params.fileName,
          levelingBeforePrint: params.leveling,
          materialMappings,
        });

        if (!success) {
          throw new Error('Failed to start multi-color job');
        }
      } else {
        console.log(`Starting AD5X single-color job: ${params.fileName}`);

        const success = await this.fiveMClient.jobControl.startAD5XSingleColorJob({
          fileName: params.fileName,
          levelingBeforePrint: params.leveling,
        });

        if (!success) {
          throw new Error('Failed to start single-color job');
        }
      }

      return {
        success: true,
        fileName: params.fileName,
        started: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName: params.fileName || '',
        started: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Upload a file to the AD5X with material-station support (3MF multi-color). The
   * AD5X maps materials at upload time, so the full `materialMappings` ride along on
   * the upload request via ff-api's `uploadFileAD5X`.
   */
  public async uploadFileAD5X(
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: AD5XMaterialMapping[]
  ): Promise<JobStartResult> {
    try {
      const uploadParams: AD5XUploadParams = {
        filePath,
        startPrint,
        levelingBeforePrint,
        flowCalibration: false,
        firstLayerInspection: false,
        timeLapseVideo: false,
        materialMappings: materialMappings || [],
      };

      console.log(
        `AD5X upload: ${path.basename(filePath)}, start: ${startPrint}, level: ${levelingBeforePrint}, mappings: ${materialMappings?.length || 0}`
      );

      const success = await this.fiveMClient.jobControl.uploadFileAD5X(uploadParams);

      if (!success) {
        throw new Error('Failed to upload file to AD5X printer');
      }

      return {
        success: true,
        fileName: path.basename(filePath),
        started: startPrint,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName: path.basename(filePath),
        started: false,
        timestamp: new Date(),
      };
    }
  }
}
