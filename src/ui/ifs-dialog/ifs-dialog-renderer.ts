// ifs-dialog-renderer.ts
// IFS Dialog renderer process logic for material station display

import type { MaterialSlotData, MaterialStationData } from './ifs-dialog-preload';


// Initialize dialog when DOM is loaded
document.addEventListener('DOMContentLoaded', (): void => {
    console.log('IFS Dialog renderer loaded');
    
    // Check if IFS dialog API is available
    if (!window.ifsDialogAPI) {
        console.error('IFS Dialog: API not available');
        return;
    }

    // Set up event handlers
    setupEventHandlers();
    
    // Set up IPC listeners
    setupIPCListeners();
    
    // Request initial material station data
    window.ifsDialogAPI.requestMaterialStation();
    
    console.log('IFS Dialog initialized');
});

/**
 * Set up all event handlers for dialog interaction
 */
function setupEventHandlers(): void {
    // Close button handler
    const closeButton = document.getElementById('btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', (): void => {
            if (window.ifsDialogAPI) {
                window.ifsDialogAPI.closeDialog();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (window.ifsDialogAPI) {
                window.ifsDialogAPI.closeDialog();
            }
        }
    });
}

/**
 * Set up IPC listeners for receiving data from main process
 */
function setupIPCListeners(): void {
    if (!window.ifsDialogAPI) return;

    // Listen for material station updates
    window.ifsDialogAPI.receive('ifs-dialog-update-material-station', (data: unknown) => {
        const materialStationData = data as MaterialStationData;
        console.log('Received material station data:', materialStationData);
        updateMaterialStationDisplay(materialStationData);
    });

    // Listen for dialog initialization
    window.ifsDialogAPI.receive('ifs-dialog-init', () => {
        console.log('IFS Dialog initialized by main process');
        // Request fresh material station data
        window.ifsDialogAPI?.requestMaterialStation();
    });
}

/**
 * Update the material station display with new data
 */
function updateMaterialStationDisplay(data: MaterialStationData): void {
    // Update connection status
    updateConnectionStatus(data.connected, data.errorMessage);
    
    // Update material slots
    updateMaterialSlots(data.slots);
    
    // Update active slot information
    updateActiveSlotInfo(data.activeSlot);
}

/**
 * Update the connection status indicator
 */
function updateConnectionStatus(connected: boolean, errorMessage: string | null): void {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (statusIndicator && statusText) {
        if (connected) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.className = 'status-indicator';
            statusText.textContent = errorMessage || 'Disconnected';
        }
    }
}

/**
 * Update all material slots with current data
 */
function updateMaterialSlots(slots: MaterialSlotData[]): void {
    // Update each slot (AD5X typically has 4 slots)
    // Backend uses 0-based indexing (0-3), UI uses 1-based indexing (1-4)
    for (let uiSlot = 1; uiSlot <= 4; uiSlot++) {
        const backendSlotId = uiSlot - 1; // Convert UI slot (1-4) to backend slot (0-3)
        const slotData = slots.find(slot => slot.slotId === backendSlotId);
        updateSingleSlot(uiSlot, slotData);
    }
}

/**
 * Update a single material slot
 */
function updateSingleSlot(slotNumber: number, slotData?: MaterialSlotData): void {
    const slotElement = document.getElementById(`slot-${slotNumber}`);
    const spoolElement = document.getElementById(`spool-${slotNumber}`);
    const materialTypeElement = document.getElementById(`material-type-${slotNumber}`);
    
    if (!slotElement || !spoolElement || !materialTypeElement) {
        console.warn(`Slot ${slotNumber} elements not found`);
        return;
    }
    
    if (!slotData || slotData.isEmpty) {
        // Empty slot
        slotElement.classList.remove('active');
        slotElement.classList.add('empty');
        spoolElement.classList.remove('has-material');
        materialTypeElement.classList.remove('has-material');
        materialTypeElement.classList.add('empty');
        
        // Reset spool color to default
        spoolElement.style.backgroundColor = '';
        spoolElement.className = 'spool';
        
        materialTypeElement.textContent = 'Empty';
    } else {
        // Slot has material
        slotElement.classList.remove('empty');
        slotElement.classList.toggle('active', slotData.isActive);
        spoolElement.classList.add('has-material');
        materialTypeElement.classList.add('has-material');
        materialTypeElement.classList.remove('empty');
        
        // Set spool color
        if (slotData.materialColor) {
            spoolElement.style.backgroundColor = slotData.materialColor;
            spoolElement.className = 'spool has-material';
        }
        
        // Set material type text
        materialTypeElement.textContent = slotData.materialType || 'Unknown';
    }
}

/**
 * Update the active slot information in the footer
 */
function updateActiveSlotInfo(activeSlot: number | null): void {
    const activeSlotText = document.getElementById('active-slot-text');
    
    if (activeSlotText) {
        if (activeSlot !== null && activeSlot >= 0) {
            // activeSlot is already 1-based for display
            activeSlotText.textContent = `Slot ${activeSlot}`;
        } else {
            activeSlotText.textContent = 'None';
        }
    }
}





// Export for potential use in other modules
export { updateMaterialStationDisplay, updateConnectionStatus }; 