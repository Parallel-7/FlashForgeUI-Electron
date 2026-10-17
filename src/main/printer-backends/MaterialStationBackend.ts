/**
 * @fileoverview Shared base for material-station printers (AD5X and Creator 5 / 5 Pro).
 *
 * Both the AD5X and the Creator 5 series have a 4-slot material station, configure
 * slots via the same `msConfig_cmd`, surface recent jobs with per-tool material data,
 * and extract material-station status from the same machine-info shape. That — and
 * ONLY that — common machinery lives here.
 *
 * Everything that differs between the two models (the upload wire format, the
 * print-start command, transport, per-tool temperatures, capabilities) is deliberately
 * NOT in this class. `AD5XBackend` and `Creator5Backend` are siblings that each extend
 * this base and implement their own model-specific behaviour, so neither can silently
 * inherit the other's assumptions.
 *
 * Key exports:
 * - MaterialStationBackend abstract class: shared material-station foundation
 */

import {
  BasicJobInfo,
  JobListResult,
  MaterialStationStatus,
  PrinterFeatureSet,
} from '@shared/types/printer-backend/index.js';
import { AD5XJobInfo, extractMaterialStationStatus, isAD5XMachineInfo } from './ad5x/index.js';
import { DualAPIBackend } from './DualAPIBackend.js';

/**
 * Abstract foundation for printers with a material station. Holds the machinery that
 * is genuinely identical between the AD5X and Creator 5 series; model-specific job
 * upload / start / temperature behaviour is implemented by the concrete subclasses.
 */
export abstract class MaterialStationBackend extends DualAPIBackend {
  /** Last validated machine info, kept for material-station status extraction. */
  private lastMachineInfo: unknown = null;

  /**
   * Material-station base feature set shared by the AD5X and Creator 5 series:
   * a 4-slot station, new-API status + job management with upload/start. Concrete
   * subclasses start from this and layer on their model-specific differences
   * (camera, LED, filtration, gcode passthrough, status transport).
   */
  protected materialStationBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        oemStreamUrl: '',
        fallbackStreamUrl: '',
        customUrl: null,
        customEnabled: false,
      },
      ledControl: {
        builtin: false,
        customControlEnabled: false,
        usesLegacyAPI: true,
      },
      filtration: {
        available: false,
        controllable: false,
        reason: 'Hardware does not support filtration control',
      },
      gcodeCommands: {
        available: true,
        usesLegacyAPI: true,
        supportedCommands: this.getSupportedGCodeCommands(),
      },
      statusMonitoring: {
        available: true,
        usesNewAPI: true,
        usesLegacyAPI: true,
        realTimeUpdates: true,
      },
      jobManagement: {
        localJobs: false,
        recentJobs: true,
        uploadJobs: true,
        startJobs: true,
        pauseResume: true,
        cancelJobs: true,
        usesNewAPI: true,
      },
      materialStation: {
        available: true,
        slotCount: this.getMaterialStationSlotCount(),
        perSlotInfo: true,
        materialDetection: true,
      },
    };
  }

  /**
   * Initialise the backend, then start material-station monitoring.
   */
  protected async initializeBackend(): Promise<void> {
    await super.initializeBackend();

    console.log(`- Material station: Available with ${this.getMaterialStationSlotCount()} slots`);
    this.initializeMaterialStationMonitoring();
  }

  /**
   * Log the initial material-station status (best-effort).
   */
  private initializeMaterialStationMonitoring(): void {
    try {
      const status = this.getMaterialStationStatus();
      if (status) {
        console.log(`Material station initialized with ${status.slots.length} slots`);
      }
    } catch (error) {
      console.warn('Failed to initialize material station monitoring:', error);
    }
  }

  /**
   * Process machine info, retaining the last valid payload for material-station
   * status extraction.
   */
  protected async processMachineInfo(machineInfo: unknown): Promise<void> {
    await super.processMachineInfo(machineInfo);

    if (isAD5XMachineInfo(machineInfo)) {
      this.lastMachineInfo = machineInfo;
    } else {
      console.warn('Invalid machine info structure received from API');
      this.lastMachineInfo = null;
    }
  }

  /**
   * Recent jobs preserve the full per-tool material data so the job picker can drive
   * material matching. The `_type: 'ad5x'` tag is a generic "has material-station
   * data" marker the picker keys on, not a model claim — it applies to the Creator 5
   * too.
   */
  public async getRecentJobs(): Promise<JobListResult> {
    try {
      const recentJobs = await this.fiveMClient.files.getRecentFileList();

      if (!recentJobs || !Array.isArray(recentJobs)) {
        throw new Error('Failed to get recent jobs');
      }

      const jobs: AD5XJobInfo[] = recentJobs.map((fileEntry) => ({
        fileName: fileEntry.gcodeFileName,
        printingTime: fileEntry.printingTime,
        toolCount: fileEntry.gcodeToolCnt,
        toolDatas: fileEntry.gcodeToolDatas,
        totalFilamentWeight: fileEntry.totalFilamentWeight,
        useMatlStation: fileEntry.useMatlStation,
        _type: 'ad5x' as const,
      }));

      return {
        success: true,
        jobs,
        totalCount: jobs.length,
        source: 'recent',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        jobs: [],
        totalCount: 0,
        source: 'recent',
        timestamp: new Date(),
      };
    }
  }

  protected transformJobList(jobs: BasicJobInfo[], _source: 'local' | 'recent'): BasicJobInfo[] {
    return jobs;
  }

  /**
   * Material station status (slots), stamped with the printer model so the polling
   * layer and renderer can select the correct fixed filament palette.
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    const status = extractMaterialStationStatus(this.lastMachineInfo);
    return status ? { ...status, printerModelType: this.modelType } : null;
  }

  /**
   * Configure a material-station slot's material and color via `msConfig_cmd`. The
   * command and wire format are firmware-confirmed identical on the AD5X and the
   * Creator 5 series.
   *
   * @param slot - Target slot number (1-4)
   * @param materialName - Recognized material name (e.g. "PLA")
   * @param hexRgb - Color hex (with or without leading '#'); the '#' is stripped by ff-api
   * @returns True if the printer accepted the configuration
   */
  public async configureSlot(slot: number, materialName: string, hexRgb: string): Promise<boolean> {
    return await this.fiveMClient.control.configureSlot(slot, materialName, hexRgb);
  }

  protected supportsMaterialStation(): boolean {
    return true;
  }

  protected supportsLocalJobs(): boolean {
    return false;
  }

  protected supportsStartJobs(): boolean {
    return true;
  }

  protected getMaterialStationSlotCount(): number {
    return 4;
  }
}
