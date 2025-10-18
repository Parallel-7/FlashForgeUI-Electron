/**
 * @fileoverview Backend implementation for Adventurer 5M Pro printer with enhanced features.
 *
 * Provides backend functionality specific to the Adventurer 5M Pro model:
 * - Dual API support (FiveMClient + FlashForgeClient)
 * - Built-in RTSP camera support (rtsp://printer-ip:8554/stream)
 * - Built-in LED control via new API
 * - Filtration control (off/internal/external modes)
 * - Full job management capabilities (local/recent jobs, upload, start/pause/resume/cancel)
 * - Real-time status monitoring
 * - Enhanced features over standard 5M model
 *
 * Key exports:
 * - Adventurer5MProBackend class: Backend for Adventurer 5M Pro printers
 *
 * This backend extends DualAPIBackend to leverage common dual-API functionality while
 * defining Pro-specific features. Key differences from standard 5M include built-in
 * RTSP camera and filtration control capabilities.
 */

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
