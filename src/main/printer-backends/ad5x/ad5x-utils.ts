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
  FFGcodeToolData, 
  SlotInfo,
  hasValidMaterialStationInfo,
  MaterialStationStatus,
  isAD5XMachineInfo
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
 * Check if an AD5X job is a multi-color job requiring material station
 */
export function isMultiColorJob(job: AD5XJobInfo): boolean {
  return !!(job.toolDatas && job.toolDatas.length > 0);
}

/**
 * Validate material compatibility between tool requirement and slot content
 * Direct string comparison - exact match required
 */
export function validateMaterialCompatibility(
  tool: FFGcodeToolData, 
  slot: SlotInfo
): boolean {
  if (!slot.hasFilament) return false;
  return tool.materialName === slot.materialName;
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

/**
 * Validate tool ID is within AD5X range (0-3)
 */
export function isValidToolId(toolId: number): boolean {
  return toolId >= 0 && toolId <= 3;
}

/**
 * Validate slot ID is within AD5X range (1-4)
 * Note: Slots are 1-based in the API
 */
export function isValidSlotId(slotId: number): boolean {
  return slotId >= 1 && slotId <= 4;
}

/**
 * Check if material color is in valid hex format (#RRGGBB)
 */
export function isValidMaterialColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Get display name for a material slot (1-based for UI)
 */
export function getSlotDisplayName(slotId: number): string {
  return `Slot ${slotId + 1}`;
}

/**
 * Get display name for a tool (1-based for UI)
 */
export function getToolDisplayName(toolId: number): string {
  return `Tool ${toolId + 1}`;
}

/**
 * Check if color difference exists between tool and slot
 * Used for warning users about color mismatches
 */
export function hasColorDifference(
  toolColor: string, 
  slotColor: string | null
): boolean {
  if (!slotColor) return false;
  return toolColor.toLowerCase() !== slotColor.toLowerCase();
}



/**
 * Create a user-friendly error message for material mismatch
 */
export function createMaterialMismatchError(
  toolId: number,
  toolMaterial: string,
  slotId: number,
  slotMaterial: string | null
): string {
  return `Material type mismatch: ${getToolDisplayName(toolId)} requires ${toolMaterial}, but ${getSlotDisplayName(slotId - 1)} contains ${slotMaterial || 'no material'}`;
}

/**
 * Create a warning message for color difference
 */
export function createColorDifferenceWarning(
  toolId: number,
  toolColor: string,
  slotId: number,
  slotColor: string
): string {
  return `Color difference detected: ${getToolDisplayName(toolId)} expects ${toolColor} but ${getSlotDisplayName(slotId - 1)} has ${slotColor}. This is allowed but may affect print appearance.`;
}

