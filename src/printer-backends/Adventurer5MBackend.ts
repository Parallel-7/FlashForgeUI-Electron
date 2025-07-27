// src/printer-backends/Adventurer5MBackend.ts
// Backend implementation for Adventurer 5M standard using dual API
// REFACTORED: Now extends DualAPIBackend to reduce code duplication

import { DualAPIBackend } from './DualAPIBackend';
import {
  PrinterFeatureSet,
  MaterialStationStatus
} from '../types/printer-backend';

/**
 * Backend implementation for Adventurer 5M standard
 * Uses dual API with enhanced features
 */
export class Adventurer5MBackend extends DualAPIBackend {
  
  /**
   * Get child-specific base features for Adventurer 5M standard
   * LED and filtration will be auto-detected from product endpoint
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        builtin: false,
        customUrl: null,
        customEnabled: false
      },
      ledControl: {
        builtin: false,
        customControlEnabled: false, // Will be overridden by settings
        usesLegacyAPI: true
      },
      filtration: {
        available: false,
        controllable: false,
        reason: 'Hardware does not support filtration control'
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
   * Get material station status - not supported on 5M
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    return null; // 5M doesn't have material station
  }
  
  // Feature detection methods specific to 5M
  
  protected supportsMaterialStation(): boolean {
    return false; // 5M doesn't have material station
  }
  
  protected getMaterialStationSlotCount(): number {
    return 0; // 5M doesn't have material station
  }
}
