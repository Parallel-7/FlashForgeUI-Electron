/**
 * @fileoverview AD5X utility functions for type guards, validation, and material station operations.
 *
 * Provides centralized utility functions for AD5X printer operations:
 * - Type guards for AD5X-specific data structures
 * - Material compatibility validation
 * - Material station status extraction and transformation
 * - Multi-color job detection
 * - Job validation and analysis
 *
 * Key exports:
 * - isAD5XJobInfo(): Type guard for AD5X job detection
 * - isMultiColorJob(): Detect if job requires material station
 * - validateMaterialCompatibility(): Check tool-slot material matching
 * - extractMaterialStationStatus(): Extract and transform material station from machine info
 *
 * This module centralizes logic previously scattered across multiple dialog files,
 * providing a single source of truth for AD5X-specific validation and extraction logic.
 * Used by AD5XBackend and material-related dialogs for consistent material management.
 */

import {
  AD5XJobInfo,
  hasValidMaterialStationInfo,
  MaterialStationStatus,
  isAD5XMachineInfo,
} from './ad5x-types.js';
import { transformMaterialStation, createEmptyMaterialStation } from './ad5x-transforms.js';

/**
 * Type guard to check if a job is an AD5X job with material data
 */
export function isAD5XJobInfo(value: unknown): value is AD5XJobInfo {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  return (
    'fileName' in obj && 
    typeof obj.fileName === 'string' && 
    ('toolDatas' in obj || '_type' in obj)
  );
}


/**
 * Extract material station status from AD5X machine info
 * Handles validation and transformation in one place
 */
export function extractMaterialStationStatus(machineInfo: unknown): MaterialStationStatus | null {
  if (!isAD5XMachineInfo(machineInfo)) {
    return null;
  }
  
  if (!hasValidMaterialStationInfo(machineInfo)) {
    return null;
  }
  
  try {
    return transformMaterialStation(machineInfo.MatlStationInfo);
  } catch (error) {
    console.error('Error extracting material station status:', error);
    return createEmptyMaterialStation();
  }
}


