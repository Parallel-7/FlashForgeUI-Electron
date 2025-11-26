/**
 * @fileoverview Preload script for material matching dialog with IFS slot assignment.
 *
 * Establishes secure IPC communication for mapping print job material requirements to physical
 * material station slots. Handles bi-directional communication for slot status queries, material
 * compatibility validation, and user-confirmed mappings. Supports material type matching with
 * color difference warnings and validation errors.
 *
 * Key exports:
 * - materialMatchingAPI: Secure API for material matching workflow
 * - Material station status queries with slot availability
 * - Mapping confirmation with toolId-to-slotId assignments
 * - Material color and type information for validation
 * - Dialog lifecycle management with result callbacks
 */

// Material Matching Dialog Preload Script
// Provides secure IPC bridge for material matching operations

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for material matching
interface MaterialMatchingInitData {
  readonly fileName: string;
  readonly toolDatas: readonly {
    readonly toolId: number;
    readonly materialName: string;
    readonly materialColor: string;
    readonly filamentWeight: number;
  }[];
  readonly leveling: boolean;
}

interface MaterialMapping {
  readonly toolId: number;
  readonly slotId: number;
  readonly materialName: string;
  readonly toolMaterialColor: string;
  readonly slotMaterialColor: string;
}

interface MaterialStationStatus {
  readonly connected: boolean;
  readonly slots: readonly {
    readonly slotId: number;
    readonly materialType: string | null;
    readonly materialColor: string | null;
    readonly isEmpty: boolean;
  }[];
  readonly activeSlot: number;
  readonly overallStatus: string;
  readonly errorMessage: string | null;
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('materialMatchingAPI', {
  // Listen for initialization data
  onInit: (callback: (data: MaterialMatchingInitData) => void) => {
    ipcRenderer.on('material-matching:init', (_event, data: MaterialMatchingInitData) => {
      callback(data);
    });
  },
  
  // Close the dialog
  closeDialog: () => {
    ipcRenderer.send('material-matching:close');
  },
  
  // Confirm material mappings
  confirmMappings: (mappings: MaterialMapping[]) => {
    ipcRenderer.send('material-matching:confirm', mappings);
  },
  
  // Get material station status
  getMaterialStationStatus: (): Promise<MaterialStationStatus | null> => {
    return ipcRenderer.invoke('get-material-station-status');
  }
,
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});

