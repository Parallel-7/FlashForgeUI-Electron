/**
 * @fileoverview Backend implementation for Adventurer 5M standard printer with dual API support.
 *
 * Provides backend functionality specific to the Adventurer 5M standard model:
 * - Dual API support (FiveMClient + FlashForgeClient)
 * - No built-in camera (custom camera URL supported)
 * - LED control via G-code (auto-detected from product endpoint)
 * - No filtration control (5M standard lacks this feature)
 * - Full job management capabilities (local/recent jobs, upload, start/pause/resume/cancel)
 * - Real-time status monitoring
 * - Custom LED and camera configuration via per-printer settings
 *
 * Key exports:
 * - Adventurer5MBackend class: Backend for Adventurer 5M standard printers
 *
 * This backend extends DualAPIBackend to leverage common dual-API functionality while
 * defining model-specific features. The main difference from the Pro model is the lack
 * of built-in camera and filtration control features.
 */

import { DualAPIBackend } from './DualAPIBackend.js';
import {
  PrinterFeatureSet,
  MaterialStationStatus
} from '@shared/types/printer-backend/index.js';

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

