// src/services/PrinterDataTransformer.ts
// Service for transforming raw printer API data into structured types
// Separates data transformation logic from polling logic

import {
  safeExtractNumber,
  safeExtractString,
  safeExtractBoolean,
  safeExtractArray,
  isValidObject,
  hasValue
} from '../utils/extraction.utils';
import { secondsToMinutes } from '../utils/time.utils';
import type {
  PrinterStatus,
  CurrentJobInfo,
  MaterialStationStatus,
  MaterialSlot
} from '../types/polling';

/**
 * Maps printer states from backend to UI-friendly states
 */
const PRINTER_STATE_MAP: Record<string, PrinterStatus['state']> = {
  'idle': 'Ready',
  'ready': 'Ready',
  'printing': 'Printing',
  'print': 'Printing',
  'paused': 'Paused',
  'pause': 'Paused',
  'pausing': 'Pausing',
  'finished': 'Completed',
  'complete': 'Completed',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'canceled': 'Cancelled',
  'error': 'Error',
  'unknown': 'Busy',
  'busy': 'Busy',
  'calibrating': 'Calibrating',
  'heating': 'Heating',
  'offline': 'Busy',
  'disconnected': 'Busy'
};

/**
 * Service for transforming printer data from various backend formats
 */
export class PrinterDataTransformer {
  /**
   * Transform backend printer status to UI format
   */
  public transformPrinterStatus(backendData: unknown): PrinterStatus | null {
    if (!isValidObject(backendData)) {
      return null;
    }

    // Extract printer state
    const rawState = safeExtractString(backendData, 'printerState', 'unknown').toLowerCase();
    const state = this.mapPrinterState(rawState);

    // Extract temperatures
    const bedTemp = safeExtractNumber(backendData, 'bedTemperature', 0);
    const bedTarget = safeExtractNumber(backendData, 'bedTargetTemperature', 0);
    const nozzleTemp = safeExtractNumber(backendData, 'nozzleTemperature', 0);
    const nozzleTarget = safeExtractNumber(backendData, 'nozzleTargetTemperature', 0);

    // Extract current job info
    const currentJobName = safeExtractString(backendData, 'currentJob', '');
    const currentJob = this.extractCurrentJob(backendData, state, currentJobName);

    // Extract additional info
    const nozzleSize = safeExtractString(backendData, 'nozzleSize', '0.4mm');
    const filamentType = safeExtractString(backendData, 'filamentType', 'PLA');
    const printSpeedAdjust = safeExtractNumber(backendData, 'printSpeedAdjust', 100);
    const zAxisCompensation = safeExtractNumber(backendData, 'zAxisCompensation', 0);

    // Extract fan speeds
    const coolingFanSpeed = safeExtractNumber(backendData, 'coolingFanSpeed', 0);
    const chamberFanSpeed = safeExtractNumber(backendData, 'chamberFanSpeed', 0);

    // Extract filtration status
    const tvoc = safeExtractNumber(backendData, 'tvoc', 0);
    const filtrationInfo = this.extractFiltrationStatus(backendData);

    // Extract cumulative stats
    const cumulativePrintTime = safeExtractNumber(backendData, 'cumulativePrintTime', 0);
    const cumulativeFilament = safeExtractNumber(backendData, 'cumulativeFilament', 0);

    const finalStatus = {
      state,
      temperatures: {
        bed: {
          current: bedTemp,
          target: bedTarget,
          isHeating: bedTarget > 0 && Math.abs(bedTemp - bedTarget) > 2
        },
        extruder: {
          current: nozzleTemp,
          target: nozzleTarget,
          isHeating: nozzleTarget > 0 && Math.abs(nozzleTemp - nozzleTarget) > 2
        }
      },
      fans: {
        coolingFan: coolingFanSpeed,
        chamberFan: chamberFanSpeed
      },
      filtration: {
        mode: filtrationInfo.filtrationMode || 'none',
        tvocLevel: tvoc,
        available: filtrationInfo.hasFiltration || false
      },
      settings: {
        nozzleSize: parseFloat(nozzleSize) || 0.4,
        filamentType: filamentType || 'PLA',
        speedOffset: printSpeedAdjust,
        zAxisOffset: zAxisCompensation
      },
      currentJob: currentJob.fileName ? currentJob : null,
      connectionStatus: 'connected' as const,
      lastUpdate: new Date(),
      cumulativeStats: {
        totalPrintTime: cumulativePrintTime,
        totalFilamentUsed: cumulativeFilament
      }
    };

    return finalStatus;
  }

  /**
   * Transform backend material station data to UI format
   */
  public transformMaterialStation(backendData: unknown): MaterialStationStatus | null {
    if (!isValidObject(backendData)) {
      return null;
    }

    const connected = safeExtractBoolean(backendData, 'connected', false);
    const activeSlot = safeExtractNumber(backendData, 'activeSlot', -1);
    const errorMessage = safeExtractString(backendData, 'errorMessage', '');
    const slots = safeExtractArray<unknown>(backendData, 'slots', []);

    const transformedSlots: MaterialSlot[] = slots
      .filter(isValidObject)
      .map((slot, index) => this.transformMaterialSlot(slot, index, activeSlot));

    return {
      connected,
      slots: transformedSlots,
      activeSlot: activeSlot > 0 ? activeSlot : null,
      errorMessage: errorMessage || null,
      lastUpdate: new Date()
    };
  }

  /**
   * Transform a single material slot
   */
  private transformMaterialSlot(
    slotData: Record<string, unknown>,
    index: number,
    activeSlot: number
  ): MaterialSlot {
    const slotId = safeExtractNumber(slotData, 'slotId', index) + 1; // Convert 0-based to 1-based
    const isEmpty = safeExtractBoolean(slotData, 'isEmpty', true);
    const materialType = safeExtractString(slotData, 'materialType', '');
    const materialColor = safeExtractString(slotData, 'materialColor', '');

    return {
      slotId,
      isEmpty,
      materialType: !isEmpty && materialType ? materialType : null,
      materialColor: !isEmpty && materialColor ? materialColor : null,
      isActive: slotId === activeSlot
    };
  }

  /**
   * Extract current job information
   */
  private extractCurrentJob(
    backendData: Record<string, unknown>,
    printerState: PrinterStatus['state'],
    fileName: string
  ): CurrentJobInfo {
    // Preserve job information during 'Completed' state for notifications
    const shouldPreserveJob = ['Printing', 'Paused', 'Completed'].includes(printerState) && hasValue(fileName);
    const isActive = ['Printing', 'Paused'].includes(printerState) && hasValue(fileName);

    if (!shouldPreserveJob) {
      return {
        fileName: '',
        displayName: '',
        startTime: new Date(),
        progress: {
          percentage: 0,
          currentLayer: null,
          totalLayers: null,
          timeRemaining: null,
          elapsedTime: 0,
          weightUsed: 0,
          lengthUsed: 0
        },
        isActive: false
      };
    }

    // Enhanced progress data extraction with legacy printer support
    const rawProgress = safeExtractNumber(backendData, 'progress', 0);
    const printDuration = safeExtractNumber(backendData, 'printDuration', 0);
    const remainingTime = safeExtractNumber(backendData, 'remainingTime', 0);
    const rawCurrentLayer = safeExtractNumber(backendData, 'currentLayer', 0);
    const rawTotalLayers = safeExtractNumber(backendData, 'totalLayers', 0);
    
    // Smart progress percentage conversion - handle both formats
    // Legacy GenericLegacyBackend: provides 0-100 integer from PrintStatus.getPrintPercent()
    // Modern backends: may provide 0.0-1.0 decimal format
    let progressPercentage = 0;
    if (rawProgress > 0) {
      if (rawProgress <= 1.0) {
        // Decimal format (0.0-1.0) from modern backends
        progressPercentage = rawProgress * 100;
        console.log(`[DataTransformer] Converting decimal progress: ${rawProgress} → ${progressPercentage}%`);
      } else {
        // Integer format (0-100) from legacy PrintStatus.getPrintPercent()
        progressPercentage = Math.min(rawProgress, 100); // Clamp to 100
        console.log(`[DataTransformer] Using integer progress: ${progressPercentage}%`);
      }
    }

    // Extract filament usage if available
    const filamentUsed = safeExtractNumber(backendData, 'estimatedRightLen', 0);
    const filamentWeight = safeExtractNumber(backendData, 'estimatedRightWeight', 0);

    // Extract formatted ETA if available
    const printEta = safeExtractString(backendData, 'printEta', '');

    // Calculate start time from elapsed time
    const startTime = new Date(Date.now() - printDuration * 1000);

    // Enhanced layer data processing
    const currentLayer = rawCurrentLayer > 0 ? rawCurrentLayer : null;
    const totalLayers = rawTotalLayers > 0 ? rawTotalLayers : null;
    
    // Log layer information for debugging
    if (currentLayer !== null || totalLayers !== null) {
      console.log(`[DataTransformer] Layer progress: ${currentLayer}/${totalLayers}`);
    }

    // Create progress object
    const progressData = {
      percentage: progressPercentage, // Now using smart conversion
      currentLayer,
      totalLayers,
      timeRemaining: remainingTime > 0 ? remainingTime : null, // Already in minutes from backend
      elapsedTime: secondsToMinutes(printDuration), // Convert seconds to minutes
      weightUsed: filamentWeight,
      lengthUsed: filamentUsed,
      formattedEta: printEta || undefined
    };
    
    // Validate progress data for type safety
    if (!this.validateJobProgress({
      percentage: progressData.percentage,
      currentLayer: progressData.currentLayer,
      totalLayers: progressData.totalLayers
    })) {
      console.warn(`[DataTransformer] Invalid progress data for job: ${fileName}`);
      // Use safe defaults for invalid data
      progressData.percentage = 0;
      progressData.currentLayer = null;
      progressData.totalLayers = null;
    }

    return {
      fileName,
      displayName: fileName,
      startTime,
      progress: progressData,
      isActive
    };
  }

  /**
   * Extract filtration status from backend data
   */
  private extractFiltrationStatus(backendData: Record<string, unknown>): {
    hasFiltration?: boolean;
    filtrationMode?: 'external' | 'internal' | 'none';
  } {
    // Check for 5M Pro fan status fields
    const externalFanOn = safeExtractBoolean(backendData, 'externalFanOn', false);
    const internalFanOn = safeExtractBoolean(backendData, 'internalFanOn', false);

    if ('externalFanOn' in backendData || 'internalFanOn' in backendData) {
      let mode: 'external' | 'internal' | 'none' = 'none';
      
      // Determine filtration mode based on which fans are active
      if (externalFanOn && internalFanOn) {
        // Both fans on - this shouldn't happen normally, but prioritize external
        mode = 'external';
      } else if (externalFanOn) {
        mode = 'external';
      } else if (internalFanOn) {
        mode = 'internal';
      }
      
      return {
        hasFiltration: true,
        filtrationMode: mode
      };
    }

    return {};
  }

  /**
   * Map raw printer state to normalized state
   */
  private mapPrinterState(rawState: string): PrinterStatus['state'] {
    const normalized = rawState.toLowerCase().trim();
    return PRINTER_STATE_MAP[normalized] || 'Busy';
  }

  /**
   * Validate job progress data for type safety
   */
  private validateJobProgress(progressData: {
    percentage: number;
    currentLayer: number | null;
    totalLayers: number | null;
  }): boolean {
    // Validate percentage range
    if (progressData.percentage < 0 || progressData.percentage > 100) {
      console.warn(`[DataTransformer] Invalid progress percentage: ${progressData.percentage}% (expected 0-100)`);
      return false;
    }
    
    // Validate layer data consistency
    if (progressData.currentLayer !== null && progressData.totalLayers !== null) {
      if (progressData.currentLayer > progressData.totalLayers) {
        console.warn(`[DataTransformer] Invalid layer data: current (${progressData.currentLayer}) > total (${progressData.totalLayers})`);
        return false;
      }
      if (progressData.currentLayer < 0 || progressData.totalLayers < 0) {
        console.warn('[DataTransformer] Invalid layer data: negative values not allowed');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate printer status data
   */
  public validatePrinterStatus(status: PrinterStatus): boolean {
    if (!status || typeof status !== 'object') {
      return false;
    }

    // Check required fields
    if (!status.state || !status.temperatures || !status.fans) {
      return false;
    }

    // Validate temperature ranges
    const { bed, extruder } = status.temperatures;
    if (bed.current < 0 || bed.current > 150 ||
        extruder.current < 0 || extruder.current > 350) {
      return false;
    }

    // Validate fan speeds
    if (status.fans.coolingFan < 0 || status.fans.coolingFan > 100 ||
        status.fans.chamberFan < 0 || status.fans.chamberFan > 100) {
      return false;
    }

    return true;
  }

  /**
   * Create empty/default printer status
   */
  public createDefaultStatus(): PrinterStatus {
    return {
      state: 'Busy',
      temperatures: {
        bed: { current: 0, target: 0, isHeating: false },
        extruder: { current: 0, target: 0, isHeating: false }
      },
      fans: {
        coolingFan: 0,
        chamberFan: 0
      },
      filtration: {
        mode: 'none',
        tvocLevel: 0,
        available: false
      },
      settings: {
        nozzleSize: 0.4,
        filamentType: 'PLA',
        speedOffset: 100,
        zAxisOffset: 0
      },
      currentJob: null,
      connectionStatus: 'disconnected',
      lastUpdate: new Date()
    };
  }

  /**
   * Create empty/default material station status
   */
  public createDefaultMaterialStation(): MaterialStationStatus {
    return {
      connected: false,
      slots: [],
      activeSlot: null,
      errorMessage: null,
      lastUpdate: new Date()
    };
  }
}

// Export singleton instance
export const printerDataTransformer = new PrinterDataTransformer();
