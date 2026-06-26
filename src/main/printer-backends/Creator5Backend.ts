/**
 * @fileoverview Backend implementation for Creator 5 / Creator 5 Pro printers.
 *
 * The Creator 5 series is a material-station printer like the AD5X, but it differs in
 * several wire-level ways, so it is a SIBLING of {@link AD5XBackend} (both extend
 * {@link MaterialStationBackend}) rather than a subclass — this keeps AD5X-specific
 * behaviour from leaking in by inheritance. The Creator 5 differences:
 *
 * - **HTTP-only**: no legacy TCP server (no port 8899). The FiveMClient runs in
 *   `httpOnly` mode and is the entire connection; there is no secondary client and no
 *   raw G-code / M-code passthrough.
 * - **Two-step material workflow**: unlike the AD5X (which maps materials at upload
 *   time), the Creator 5 uploads the file with `useMatlStation` / `gcodeToolCnt` flags
 *   and then maps per-tool materials at print-start via `POST /printGcode`. Material
 *   matching is ALWAYS used (even for a single-color file), mirroring the AD5X UX, so
 *   `useMatlStation` is always true.
 * - **Per-tool temperatures**: a 4-nozzle tool changer plus a heated chamber.
 * - **Camera** on both Creator 5 and Creator 5 Pro; **filtration / door sensor** on the
 *   Pro only.
 *
 * Key exports:
 * - Creator5Backend class: Backend for Creator 5 / Creator 5 Pro printers
 */

import {
  type Creator5MaterialMapping,
  FiveMClient,
  type FFMachineInfo,
} from '@ghosttypes/ff-api';
import {
  JobOperationParams,
  JobStartResult,
  PrinterFeatureSet,
} from '@shared/types/printer-backend/index.js';
import { basename } from 'path';
import { MaterialStationBackend } from './MaterialStationBackend.js';

/**
 * Backend implementation for the Creator 5 / Creator 5 Pro. Sibling of the AD5X
 * backend (shared material-station base), with the Creator 5's HTTP-only transport,
 * two-step material-mapping print flow, per-tool temperatures, and Pro hardware.
 */
export class Creator5Backend extends MaterialStationBackend {
  /**
   * HTTP-only client initialization. The Creator 5 has no TCP channel, so we validate
   * only the primary FiveMClient and leave the legacy client unset (the base
   * {@link DualAPIBackend.initializeClients} would require a secondary client).
   */
  protected initializeClients(): void {
    if (!(this.primaryClient instanceof FiveMClient)) {
      throw new Error('Creator5Backend requires FiveMClient as primary client');
    }
    this.fiveMClient = this.primaryClient;
    // No secondaryClient / legacyClient: the Creator 5 series is HTTP-only.
  }

  /**
   * Whether this specific printer is a Creator 5 Pro (vs a plain Creator 5).
   * Drives the Pro-only capabilities: real door sensor and filtration/aux fan.
   */
  private isCreator5Pro(): boolean {
    return this.modelType === 'creator-5-pro';
  }

  /**
   * Creator 5 base features: the shared material-station set, but HTTP-only — no raw
   * G-code passthrough and no legacy status path. The built-in camera is enabled at
   * runtime from the printer's reported `cameraStreamUrl`; LED / filtration are
   * resolved from the product endpoint by {@link getBaseFeatures} (with a Pro
   * filtration override).
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    const features = this.materialStationBaseFeatures();

    return {
      ...features,
      // The Creator 5 series is HTTP-only and exposes NO raw G-code / M-code
      // passthrough: the firmware's only command surface is the HTTP /control command
      // set (Ghidra RE of firmwareExe 1.9.2 — creator5-analysis §5).
      gcodeCommands: {
        available: false,
        usesLegacyAPI: false,
        supportedCommands: [],
      },
      // Status comes solely from the HTTP /detail endpoint — no legacy TCP status path.
      statusMonitoring: {
        ...features.statusMonitoring,
        usesNewAPI: true,
        usesLegacyAPI: false,
      },
    };
  }

  /**
   * Resolve full feature set, then apply Creator 5 Pro hardware overrides. The base
   * derives filtration from the product endpoint, but the Creator 5 Pro under-reports
   * its fan control states despite shipping with 5M-Pro-style filtration / aux fan, so
   * force it on by model. The plain Creator 5 keeps the product-derived value.
   */
  protected getBaseFeatures(): PrinterFeatureSet {
    const features = super.getBaseFeatures();

    if (this.isCreator5Pro()) {
      return {
        ...features,
        filtration: {
          available: true,
          controllable: true,
          reason: 'Creator 5 Pro has built-in filtration / aux fan',
        },
      };
    }

    return features;
  }

  /**
   * Surface Creator 5-specific status fields (per-tool temps, chamber, door capability)
   * on top of the base status.
   */
  protected getAdditionalStatusFields(machineInfo: unknown): Record<string, unknown> {
    const base = super.getAdditionalStatusFields(machineInfo);
    const info = machineInfo as Partial<FFMachineInfo> | null;

    return {
      ...base,
      // Per-tool current/target temperatures (4 entries on the Creator 5 series).
      toolTemps: info?.ToolTemps ?? [],
      // Chamber temperature (both Creator 5 and 5 Pro have a heated chamber).
      chamberTemp: info?.Chamber?.current ?? 0,
      chamberTargetTemp: info?.Chamber?.set ?? 0,
      // Capability flags for the renderer to gate UI.
      isCreator5Pro: this.isCreator5Pro(),
      hasChamberControl: true, // Creator 5 / 5 Pro always have a heated chamber (firmware-confirmed)
      hasDoorSensor: info?.HasDoorSensor ?? this.isCreator5Pro(),
    };
  }

  /**
   * Start a job on the Creator 5 / Creator 5 Pro.
   *
   * A fresh file upload goes through the two-step material flow
   * ({@link uploadCreator5File}); an already-resident file goes straight to the native
   * print-start command (`POST /printGcode`) with the per-tool material mappings.
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    try {
      const materialMappings = params.additionalParams?.materialMappings as
        | Creator5MaterialMapping[]
        | undefined;

      // Fresh file upload: upload (with the material-station flags), then start.
      if (params.filePath) {
        return await this.uploadCreator5File(
          params.filePath,
          params.startNow,
          params.leveling,
          materialMappings,
          params.fileName
        );
      }

      if (!params.fileName) {
        throw new Error('fileName or filePath is required');
      }

      // Upload-only request (start handled separately by the caller).
      if (!params.startNow) {
        return {
          success: true,
          fileName: params.fileName,
          started: false,
          timestamp: new Date(),
        };
      }

      const started = await this.startCreator5Print(
        params.fileName,
        params.leveling,
        materialMappings
      );
      if (!started) {
        throw new Error('Failed to start Creator 5 job');
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
   * Material-station file upload for the Creator 5. This is the entry point the
   * material-aware uploader (`upload-file-ad5x` IPC) calls; it overrides the AD5X
   * method name but runs the Creator 5 two-step flow, NOT the AD5X upload-time
   * mapping. Material matching is always used on the Creator 5, so `useMatlStation`
   * is always true here.
   *
   * @param filePath Local file to upload.
   * @param startPrint Whether to start the print after upload.
   * @param levelingBeforePrint Whether to bed-level before printing.
   * @param materialMappings Per-tool material mappings (always provided by the UI,
   *   even for a single-color file).
   */
  public async uploadFileAD5X(
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: Creator5MaterialMapping[]
  ): Promise<JobStartResult> {
    return this.uploadCreator5File(filePath, startPrint, levelingBeforePrint, materialMappings);
  }

  /**
   * The Creator 5 two-step upload: upload the file (never auto-start via `printNow`,
   * since the material mapping is applied by the follow-up `/printGcode`), then — when
   * requested — start the print with the mappings. `useMatlStation` is always true and
   * `gcodeToolCnt` follows the mapping count (≥1), matching the AD5X "always material
   * station" behaviour.
   */
  private async uploadCreator5File(
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: Creator5MaterialMapping[],
    fileNameOverride?: string
  ): Promise<JobStartResult> {
    const fileName = fileNameOverride || basename(filePath);
    const toolCount = materialMappings && materialMappings.length > 0 ? materialMappings.length : 1;

    try {
      const uploaded = await this.fiveMClient.jobControl.uploadFileCreator5({
        filePath,
        startPrint: false,
        levelingBeforePrint,
        useMatlStation: true,
        gcodeToolCnt: toolCount,
      });
      if (!uploaded) {
        throw new Error('Failed to upload job to Creator 5');
      }

      if (startPrint) {
        const started = await this.startCreator5Print(fileName, levelingBeforePrint, materialMappings);
        if (!started) {
          throw new Error('Failed to start Creator 5 job after upload');
        }
      }

      return {
        success: true,
        fileName,
        started: startPrint,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName,
        started: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue the Creator 5 native print-start (`POST /printGcode`) for a file already on
   * the printer, with optional per-tool material mappings.
   */
  private async startCreator5Print(
    fileName: string,
    levelingBeforePrint: boolean,
    materialMappings?: Creator5MaterialMapping[]
  ): Promise<boolean> {
    return await this.fiveMClient.jobControl.startCreator5Job({
      fileName,
      levelingBeforePrint,
      materialMappings:
        materialMappings && materialMappings.length > 0 ? materialMappings : undefined,
    });
  }
}
