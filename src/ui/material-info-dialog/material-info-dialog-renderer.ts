/**
 * @fileoverview Renderer process for material information visualization dialog.
 *
 * Implements visual display of multi-color print material requirements with spool-styled
 * color representations. Shows per-tool material information including type, color, weight,
 * and material station slot assignments. Displays total filament weight and material station
 * usage indicators. Provides read-only visualization of print material requirements.
 *
 * Key features:
 * - Color-coded spool visualizations matching actual filament colors
 * - Per-tool material breakdown (type, color, weight)
 * - Material station slot ID display (1-based UI, 0 indicates direct feed)
 * - Total filament weight calculation and display
 * - Material station usage indicator
 * - Clean, visual representation for user verification
 */

// Material Info Dialog Renderer
// Handles material information display with spool styling

import type { MaterialInfoDialogData } from './material-info-dialog-preload.cts';
import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

interface MaterialInfoDialogAPI {
  readonly onInit: (callback: (data: MaterialInfoDialogData) => void) => void;
  readonly closeDialog: () => void;
  readonly receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

const getMaterialInfoDialogAPI = (): MaterialInfoDialogAPI => {
  const api = window.api?.dialog?.materialInfo as MaterialInfoDialogAPI | undefined;
  if (!api) {
    throw new Error('[MaterialInfoDialog] dialog API bridge is not available');
  }
  return api;
};


// Initialize dialog when DOM is loaded
document.addEventListener('DOMContentLoaded', (): void => {
    console.log('Material Info Dialog renderer loaded');
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
    
    const api = getMaterialInfoDialogAPI();

    // Set up event handlers
    setupEventHandlers(api);
    
    // Set up IPC listeners
    setupIPCListeners(api);

    registerThemeListener(api);
    
    console.log('Material Info Dialog initialized');
});

/**
 * Set up event handlers for user interactions
 */
function setupEventHandlers(api: MaterialInfoDialogAPI): void {
    // Close button
    const closeButton = document.getElementById('btn-close');
    closeButton?.addEventListener('click', () => {
        api.closeDialog();
    });
}

/**
 * Set up IPC listeners for communication with main process
 */
function setupIPCListeners(api: MaterialInfoDialogAPI): void {
    // Listen for initialization data
    api.onInit((data: MaterialInfoDialogData) => {
        console.log('Material Info Dialog: Received init data', data);
        displayMaterialInfo(data);
    });
}

function registerThemeListener(api: MaterialInfoDialogAPI): void {
    api.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}

/**
 * Display material information in the dialog
 */
function displayMaterialInfo(data: MaterialInfoDialogData): void {
    // Update file name
    const fileNameElement = document.getElementById('file-name');
    if (fileNameElement) {
        fileNameElement.textContent = data.fileName;
    }

    // Update file stats
    updateFileStats(data);

    // Display materials
    displayMaterials(data.toolDatas);
}

/**
 * Update file statistics display
 */
function updateFileStats(data: MaterialInfoDialogData): void {
    const totalWeightElement = document.getElementById('total-weight');
    const materialStationElement = document.getElementById('material-station-status');

    if (totalWeightElement) {
        if (data.totalFilamentWeight && data.totalFilamentWeight > 0) {
            totalWeightElement.textContent = `Total: ${data.totalFilamentWeight.toFixed(2)}g`;
        } else {
            totalWeightElement.textContent = 'Total: N/A';
        }
    }

    if (materialStationElement) {
        if (data.useMatlStation) {
            materialStationElement.innerHTML = '';
            const indicator = document.createElement('span');
            indicator.className = 'material-station-indicator';
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'factory');
            indicator.appendChild(icon);
            const label = document.createElement('span');
            label.textContent = 'Material Station';
            indicator.appendChild(label);
            materialStationElement.appendChild(indicator);
            window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['factory'], indicator);
        } else {
            materialStationElement.textContent = 'Direct Feed';
        }
    }
}

/**
 * Display materials with spool styling
 */
function displayMaterials(toolDatas: readonly MaterialInfoDialogData['toolDatas'][0][]): void {
    const materialsContainer = document.getElementById('materials-container');
    if (!materialsContainer) {
        console.error('Materials container not found');
        return;
    }

    // Clear existing content
    materialsContainer.innerHTML = '';

    if (toolDatas.length === 0) {
        materialsContainer.innerHTML = '<div class="no-materials">No material information available</div>';
        return;
    }

    // Create material items
    toolDatas.forEach(tool => {
        const materialItem = createMaterialItem(tool);
        materialsContainer.appendChild(materialItem);
    });
}

/**
 * Create a material item element with spool styling
 */
function createMaterialItem(tool: MaterialInfoDialogData['toolDatas'][0]): HTMLElement {
    const materialItem = document.createElement('div');
    materialItem.className = 'material-item';

    // Create spool container
    const spoolContainer = document.createElement('div');
    spoolContainer.className = 'spool-container';

    const spool = document.createElement('div');
    spool.className = 'spool has-material';
    
    // Set spool color
    if (tool.materialColor) {
        spool.style.backgroundColor = tool.materialColor;
    }

    const spoolCenter = document.createElement('div');
    spoolCenter.className = 'spool-center';

    spool.appendChild(spoolCenter);
    spoolContainer.appendChild(spool);

    // Create material info
    const materialInfo = document.createElement('div');
    materialInfo.className = 'material-info';

    // Material header with tool and slot info
    const materialHeader = document.createElement('div');
    materialHeader.className = 'material-header';

    const toolLabel = document.createElement('span');
    toolLabel.className = 'tool-label';
    toolLabel.textContent = `Tool ${tool.toolId}`;

    materialHeader.appendChild(toolLabel);

    // Add slot label if slot ID is valid
    // slotId = 0 means direct feed (no material station slot)
    // slotId = 1-4 means material station slot (already 1-based from API)
    if (tool.slotId > 0) {
        const slotLabel = document.createElement('span');
        slotLabel.className = 'slot-label';
        slotLabel.textContent = `Slot ${tool.slotId}`;
        materialHeader.appendChild(slotLabel);
    }

    // Material name
    const materialName = document.createElement('div');
    materialName.className = 'material-name';
    materialName.textContent = tool.materialName || 'Unknown Material';

    // Material weight
    const materialWeight = document.createElement('div');
    materialWeight.className = 'material-weight';
    materialWeight.textContent = `${tool.filamentWeight.toFixed(2)}g`;

    materialInfo.appendChild(materialHeader);
    materialInfo.appendChild(materialName);
    materialInfo.appendChild(materialWeight);

    materialItem.appendChild(spoolContainer);
    materialItem.appendChild(materialInfo);

    return materialItem;
}

// Export for module
export {}; 
