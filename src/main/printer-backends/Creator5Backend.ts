/**
 * @fileoverview Backend implementation for Creator 5 / Creator 5 Pro printers.
 *
 * The Creator 5 series is functionally "AD5X + per-tool temperatures": it has the
 * same 4-slot material station and material-mapping print flow as the AD5X, plus a
 * 4-nozzle tool array and (on the Pro) 5M-Pro-style camera/LED/filtration hardware.
 *
 * This backend therefore extends {@link AD5XBackend} to inherit the material-station
 * machinery (monitoring, slot configuration, multi-color job starting, recent-job
 * handling) and the dual HTTP + TCP transport, and layers on:
 * - Per-tool nozzle temperatures (`toolTemps`) surfaced in status.
 * - Camera enabled (both Creator 5 and Creator 5 Pro have a built-in camera; the
 *   stream URL is detected at runtime from the printer's `cameraStreamUrl`).
 * - Filtration / aux fan forced on for the Creator 5 Pro, whose `/product` response
 *   under-reports the fan control states despite the hardware being present.
 * - Door-sensor capability gated to the Creator 5 Pro only (the plain Creator 5 has
 *   no real sensor, so its door status is cosmetic and must not be surfaced).
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
import { AD5XBackend } from './AD5XBackend.js';

/**
 * Backend implementation for the Creator 5 / Creator 5 Pro.
 * Extends the AD5X backend (shared material station + dual API) and adds the
 * Creator 5's per-tool temperatures and Pro-only hardware capabilities.
 *
 * Unlike the other dual-API backends, the Creator 5 series is **HTTP-only**: the
 * printer runs no legacy TCP server (no port 8899), so there is no secondary
 * FlashForgeClient. The FiveMClient is created in `httpOnly` mode and is the entire
 * connection. TCP-only operations inherited from DualAPIBackend (raw G-code,
 * homing, legacy status fallback) are unavailable; see the overrides below.
 */
export class Creator5Backend extends AD5XBackend {
  /**
   * HTTP-only client initialization. The base {@link DualAPIBackend.initializeClients}
   * requires a secondary FlashForgeClient and throws without one; the Creator 5 has
   * no TCP channel, so we validate only the primary FiveMClient here and leave the
   * legacy client unset.
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
   * Child-specific base features for the Creator 5 series.
   *
   * Mirrors the AD5X material-station feature set, but enables the built-in
   * camera (present on both Creator 5 and Creator 5 Pro). LED and filtration are
   * resolved by {@link getBaseFeatures} from the product endpoint (with a Pro
   * filtration override applied there).
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    const features = super.getChildBaseFeatures();

    return {
      ...features,
      // Both Creator 5 and Creator 5 Pro have a built-in camera; it is enabled at
      // runtime from the printer's reported `cameraStreamUrl` (same path as the 5M
      // Pro), so no static feature flag is needed here.
      // The Creator 5 series is HTTP-only and exposes NO raw G-code / M-code
      // passthrough: the firmware's only command surface is the HTTP /control
      // command set, and there is no legacy TCP channel and no gcode_cmd/rawCmd
      // route (Ghidra RE of firmwareExe 1.9.2 — creator5-analysis §5). Override
      // the AD5X default (which advertises legacy-API G-code) so the UI does not
      // surface a manual-command / G-code console affordance the printer can't
      // honor. (sendGCode already guards the absent legacy client at runtime.)
      gcodeCommands: {
        available: false,
        usesLegacyAPI: false,
        supportedCommands: [],
      },
      // Status comes solely from the HTTP /detail endpoint — there is no legacy
      // TCP status path on these printers.
      statusMonitoring: {
        ...features.statusMonitoring,
        usesNewAPI: true,
        usesLegacyAPI: false,
      },
    };
  }

  /**
   * Resolve full feature set, then apply Creator 5 Pro hardware overrides.
   *
   * The base {@link DualAPIBackend.getBaseFeatures} derives filtration from the
   * product endpoint, but the Creator 5 Pro under-reports its fan control states
   * (both 0) despite shipping with 5M-Pro-style filtration / aux fan. Force it on
   * by model so the control surfaces. The plain Creator 5 keeps the product-derived
   * value.
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
   * Surface Creator 5-specific status fields on top of the AD5X/base status.
   *
   * Adds the per-tool nozzle temperature array and the door-sensor capability so
   * the renderer can show a 4-tool temperature grid and only present door status
   * when a real sensor exists (Creator 5 Pro).
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
   * Overrides {@link AD5XBackend.startJob} to use the Creator 5-native start
   * command: the Creator 5 performs material matching at print-start
   * (`POST /printGcode`) rather than at upload time. File uploads reuse the shared
   * upload path; starting an already-uploaded local file uses `startCreator5Job`
   * with optional per-tool material mappings.
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    try {
      // File upload case (optionally auto-start). Material matching for a
      // multi-tool file is done via a follow-up start with mappings.
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

      const materialMappings = params.additionalParams?.materialMappings as
        | Creator5MaterialMapping[]
        | undefined;

      const success = await this.fiveMClient.jobControl.startCreator5Job({
        fileName: params.fileName,
        levelingBeforePrint: params.leveling,
        materialMappings:
          materialMappings && materialMappings.length > 0 ? materialMappings : undefined,
      });

      if (!success) {
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

  protected getMaterialStationSlotCount(): number {
    return 4; // Creator 5 material station has 4 slots
  }
}
