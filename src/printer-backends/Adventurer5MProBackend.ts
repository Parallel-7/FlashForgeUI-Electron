// src/printer-backends/Adventurer5MProBackend.ts
// Backend implementation for Adventurer 5M Pro using dual API
// REFACTORED: Now extends DualAPIBackend to reduce code duplication

import { DualAPIBackend } from './DualAPIBackend';
import {
  PrinterFeatureSet,
  MaterialStationStatus
} from '../types/printer-backend';

/**
 * Backend implementation for Adventurer 5M Pro
 * Uses dual API with enhanced features including filtration
 */
export class Adventurer5MProBackend extends DualAPIBackend {
  
  /**
   * Get child-specific base features for Adventurer 5M Pro
   * LED and filtration will be auto-detected from product endpoint
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        builtin: true,
        customUrl: null,
        customEnabled: false
      },
      ledControl: {
        builtin: true,
        customControlEnabled: false, // Will be overridden by settings
        usesLegacyAPI: true
      },
      filtration: {
        available: true,
        controllable: true,
        reason: 'Hardware supports filtration control'
      },
      gcodeCommands: {
        available: true,
        usesLegacyAPI: true,
        supportedCommands: this.getSupportedGCodeCommands()
      },
      statusMonitoring: {
        available: true,
        usesNewAPI: true,
        usesLegacyAPI: true,
        realTimeUpdates: true
      },
      jobManagement: {
        localJobs: true,
        recentJobs: true,
        uploadJobs: true,
        startJobs: true,
        pauseResume: true,
        cancelJobs: true,
        usesNewAPI: true
      },
      materialStation: {
        available: false,
        slotCount: 0,
        perSlotInfo: false,
        materialDetection: false
      }
    };
  }
  
  /**
   * Get additional status fields specific to 5M Pro
   * Override from DualAPIBackend to add filtration fan fields
   */
  protected getAdditionalStatusFields(machineInfo: unknown): Record<string, unknown> {
    // 5M Pro adds fan status for filtration mode detection
    const info = machineInfo as Record<string, unknown> | null;
    return {
      externalFanOn: info?.ExternalFanOn || false,
      internalFanOn: info?.InternalFanOn || false
    };
  }
  
  /**
   * Get material station status - not supported on 5M Pro
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    return null; // 5M Pro doesn't have material station
  }
  
  // Feature detection methods specific to 5M Pro
  
  protected supportsMaterialStation(): boolean {
    return false; // 5M Pro doesn't have material station
  }
  
  protected getMaterialStationSlotCount(): number {
    return 0; // 5M Pro doesn't have material station
  }
}
