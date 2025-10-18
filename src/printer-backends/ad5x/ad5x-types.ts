/**
 * @fileoverview AD5X type definitions and re-exports for material station and job management.
 *
 * Centralizes all AD5X-related types with two-layer type system:
 * - ff-api types: Raw API response structures from printer
 * - UI-specific types: Transformed structures for consistent UI presentation
 *
 * Key exports:
 * - Material station types (MatlStationInfo, SlotInfo from ff-api)
 * - Job types (FFGcodeToolData, AD5XMaterialMapping, job params)
 * - UI types (MaterialStationStatus, MaterialSlotInfo for consistent rendering)
 * - Type guards (isAD5XMachineInfo, hasValidMaterialStationInfo)
 *
 * The two-layer approach separates API concerns from UI concerns:
 * - ff-api types match the printer's raw responses exactly
 * - UI types provide 0-based indexing, isEmpty flags, and friendly field names
 * This separation enables API evolution without breaking UI components.
 */

// Re-export types from ff-api
export { 
  MatlStationInfo,
  SlotInfo
} from 'ff-api';

// Direct re-exports from ff-api index
export { 
  FFGcodeToolData,
  FFGcodeFileEntry,
  AD5XMaterialMapping,
  AD5XLocalJobParams,
  AD5XSingleColorJobParams
} from 'ff-api';

// Keep our UI-specific types that transform the data structure
export { 
  MaterialStationStatus, 
  MaterialSlotInfo 
} from '../../types/printer-backend';

// AD5X job info extends the base job info with material station data
export { AD5XJobInfo } from '../../types/printer-backend';

// Import MatlStationInfo for type definitions
import type { MatlStationInfo as MatlStationInfoType } from 'ff-api';

// Type for the raw machine info structure from AD5X API responses
export interface AD5XMachineInfo {
  readonly MatlStationInfo?: MatlStationInfoType;
  // Other fields exist but are not needed for material station extraction
  [key: string]: unknown;
}

// Type guard for AD5XMachineInfo
export function isAD5XMachineInfo(data: unknown): data is AD5XMachineInfo {
  return typeof data === 'object' && data !== null;
}

// Type guard for valid material station info
export function hasValidMaterialStationInfo(
  data: AD5XMachineInfo
): data is AD5XMachineInfo & { MatlStationInfo: MatlStationInfoType } {
  return (
    data.MatlStationInfo !== undefined &&
    typeof data.MatlStationInfo === 'object' &&
    data.MatlStationInfo !== null &&
    'slotInfos' in data.MatlStationInfo &&
    Array.isArray(data.MatlStationInfo.slotInfos)
  );
}
