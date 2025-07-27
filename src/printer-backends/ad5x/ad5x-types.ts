/**
 * AD5X Type Definitions and Re-exports
 * 
 * This module centralizes all AD5X-related types by re-exporting from ff-api
 * and maintaining our UI-specific types for consistent presentation layer.
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
