/**
 * @fileoverview AD5X data transformation functions for converting API responses to UI-friendly structures.
 *
 * Provides transformation functions to convert ff-api data structures to UI-specific types:
 * - Material station transformation (MatlStationInfo → MaterialStationStatus)
 * - Slot information transformation (SlotInfo → MaterialSlotInfo)
 * - Status determination and state mapping
 * - Empty state creation for error conditions
 *
 * Key exports:
 * - transformMaterialStation(): Convert API material station to UI structure
 * - transformSlotInfo(): Convert API slot to UI slot (0-based indexing, isEmpty flag)
 * - createEmptyMaterialStation(): Generate disconnected state for error cases
 * - determineOverallStatus(): Map API state to UI status indicators
 *
 * Transformations handle:
 * - Index conversion (1-based API → 0-based UI)
 * - Field inversions (hasFilament → isEmpty for UI clarity)
 * - Status mapping (stateAction/stateStep → ready/warming/error/disconnected)
 * - Error state creation with appropriate default values
 */

import { 
  MatlStationInfo, 
  SlotInfo,
  MaterialStationStatus, 
  MaterialSlotInfo, 
  AD5XMaterialMapping 
} from './ad5x-types';

/**
 * Transform ff-api MatlStationInfo to our MaterialStationStatus
 * Provides UI-friendly structure with connected state and error handling
 */
export function transformMaterialStation(info: MatlStationInfo): MaterialStationStatus {
  return {
    connected: true,
    slots: info.slotInfos.map((slot, index) => transformSlotInfo(slot, index)),
    activeSlot: info.currentSlot,
    overallStatus: determineOverallStatus(info),
    errorMessage: null
  };
}

/**
 * Transform ff-api SlotInfo to our MaterialSlotInfo
 * Converts to 0-based indexing and inverts hasFilament to isEmpty for UI clarity
 */
export function transformSlotInfo(slot: SlotInfo, index: number): MaterialSlotInfo {
  return {
    slotId: index, // Convert to 0-based for UI
    materialType: slot.hasFilament ? slot.materialName : null,
    materialColor: slot.hasFilament ? slot.materialColor : null,
    isEmpty: !slot.hasFilament
  };
}

/**
 * Create empty material station status for error cases
 */
export function createEmptyMaterialStation(): MaterialStationStatus {
  return {
    connected: false,
    slots: [],
    activeSlot: null,
    overallStatus: 'disconnected',
    errorMessage: 'Material station not available'
  };
}

/**
 * Determine overall status based on material station state
 */
function determineOverallStatus(info: MatlStationInfo): 'ready' | 'warming' | 'error' | 'disconnected' {
  // AD5X state interpretation based on stateAction and stateStep
  if (info.stateAction === 0 && info.stateStep === 0) {
    return 'ready';
  }
  
  // Loading or unloading states
  if (info.stateAction > 0) {
    return 'warming'; // Using 'warming' to indicate busy state
  }
  
  return 'ready'; // Default to ready for unknown states
}

/**
 * Create material mappings array for IPC communication
 * Ensures consistent format for AD5X job start operations
 */
export function createMaterialMappings(
  mappings: ReadonlyArray<{
    toolId: number;
    slotId: number;
    materialName: string;
    toolMaterialColor: string;
    slotMaterialColor: string;
  }>
): AD5XMaterialMapping[] {
  return mappings.map(m => ({
    toolId: m.toolId,
    slotId: m.slotId,
    materialName: m.materialName,
    toolMaterialColor: m.toolMaterialColor,
    slotMaterialColor: m.slotMaterialColor
  }));
}

