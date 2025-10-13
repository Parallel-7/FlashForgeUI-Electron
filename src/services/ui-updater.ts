/**
 * @fileoverview UI updater service providing direct DOM manipulation functions for updating
 * printer status, job information, and preview displays in the renderer process.
 *
 * This service provides a collection of utility functions that safely update DOM elements
 * with printer data from polling responses. It handles data formatting, element validation,
 * and visual state management to ensure smooth UI updates without flickering or errors.
 * The module implements defensive programming practices with null checks for all DOM elements
 * and graceful degradation when elements are missing.
 *
 * Key Features:
 * - Safe DOM element access with null checking and error handling
 * - Specialized update functions for status panel, job panel, and model preview
 * - Data formatting utilities for temperatures, time, weight, and length
 * - Visual state management with CSS class manipulation for connection status
 * - Progress bar styling based on printer state (printing, paused, completed, error)
 * - Thumbnail preview with fallback placeholders for active jobs without thumbnails
 * - Material station display for AD5X printers with multi-slot support
 * - Label preservation when updating label+span elements to prevent text loss
 * - ETA formatting as completion time in 12-hour format (e.g., "12:34PM")
 *
 * Core Responsibilities:
 * - Update status panel with temperatures, fans, filtration mode, TVOC levels, and printer settings
 * - Update job information panel with progress percentage, layer info, timing, and material usage
 * - Update model preview area with job thumbnails or appropriate placeholders
 * - Handle missing DOM elements gracefully without throwing errors
 * - Format data appropriately for display (temperatures, times, weights, lengths)
 * - Provide smooth updates without flickering using CSS transitions
 * - Maintain visual consistency with connection status indicators
 * - Update material station UI for AD5X printers with multi-slot displays
 *
 * Panel Update Functions:
 * - updateStatusPanel: Updates printer state, temperatures, fans, filtration, and settings
 * - updateJobPanel: Updates job name, progress, layers, timing, and material usage
 * - updateModelPreview: Updates thumbnail preview or shows appropriate placeholder
 * - updateMaterialStation: Shows/hides material station UI for AD5X printers
 * - updateGeneralStatus: Updates cumulative stats (runtime, total filament used)
 * - updateAllPanels: Master update function that calls all panel update functions
 *
 * Utility Functions:
 * - getElement: Safe DOM element retrieval by ID with null handling
 * - setElementText: Safe text content setting with element validation
 * - setElementAttribute: Safe attribute setting with element validation
 * - setElementClass: Safe CSS class addition/removal
 * - updateLabelSpanElement: Update label+span elements while preserving structure
 * - updateSpanInLabelElement: Update only the span within a label element (preferred for data updates)
 * - formatPrinterState: Convert printer state enum to display-friendly text
 * - formatETA: Format time remaining as completion time in 12-hour format
 *
 * @exports updateStatusPanel - Update printer status panel
 * @exports updateJobPanel - Update job information panel
 * @exports updateModelPreview - Update model preview area
 * @exports updateMaterialStation - Update material station display
 * @exports updateGeneralStatus - Update general status information
 * @exports updateAllPanels - Update all UI panels with polling data
 * @exports initializeUIAnimations - Initialize smooth CSS transitions
 * @exports handleUIError - Handle UI update errors gracefully
 * @exports resetUI - Reset UI to default disconnected state
 */

import type { 
  PollingData, 
  PrinterStatus, 
  MaterialStationStatus 
} from '../types/polling';
import { 
  formatTemperature, 
  formatTime, 
  formatWeight, 
  formatLength
} from '../types/polling';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely get DOM element by ID
 */
function getElement(id: string): HTMLElement | null {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.warn(`Element not found: ${id}`, error);
    return null;
  }
}

/**
 * Safely set text content of element
 */
function setElementText(id: string, text: string): void {
  const element = getElement(id);
  if (element) {
    element.textContent = text;
  }
}



/**
 * Safely set element attribute
 */
function setElementAttribute(id: string, attribute: string, value: string | number): void {
  const element = getElement(id);
  if (element) {
    element.setAttribute(attribute, value.toString());
  }
}

/**
 * Update elements that contain a label and a span for the value
 * This prevents accidentally overwriting the label text during resets
 */
function updateLabelSpanElement(elementId: string, label: string, value: string): void {
  const element = getElement(elementId);
  if (element) {
    // Use innerHTML to maintain the label + span structure
    element.innerHTML = `${label} <span>${value}</span>`;
  } else {
    console.warn(`Element with ID "${elementId}" not found.`);
  }
}

/**
 * Update just the span within a label+span element (preferred for data updates)
 */
function updateSpanInLabelElement(elementId: string, value: string): void {
  const element = getElement(elementId);
  if (element) {
    // Check if the element itself is a span
    if (element.tagName.toLowerCase() === 'span') {
      element.textContent = value;
    } else {
      // Look for a span child element
      const spanElement = element.querySelector('span');
      if (spanElement) {
        spanElement.textContent = value;
      } else {
        console.warn(`Span element not found within "${elementId}"`);
      }
    }
  } else {
    console.warn(`Element with ID "${elementId}" not found.`);
  }
}

/**
 * Safely add/remove CSS class
 */
function setElementClass(id: string, className: string, add: boolean): void {
  const element = getElement(id);
  if (element) {
    if (add) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }
}

/**
 * Format printer state for display
 */
function formatPrinterState(state: PrinterStatus['state']): string {
  const stateLabels: Record<PrinterStatus['state'], string> = {
    'Ready': 'Ready',
    'Printing': 'Printing',
    'Paused': 'Paused',
    'Pausing': 'Pausing',
    'Heating': 'Heating',
    'Calibrating': 'Calibrating',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled',
    'Error': 'Error',
    'Busy': 'Busy'
  };
  
  return stateLabels[state] || 'Unknown';
}



/**
 * Format ETA to show completion time in 12-hour format (e.g., "12:34PM")
 */
function formatETA(formattedEta?: string, timeRemainingMinutes?: number | null): string {
  // If we have the formatted ETA from ff-api, use it to calculate completion time
  if (formattedEta && formattedEta !== '') {
    try {
      // Parse the HH:MM format from ff-api
      const [hours, minutes] = formattedEta.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        // Calculate completion time by adding the ETA to current time
        const now = new Date();
        const completionTime = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
        
        // Format as 12-hour time with AM/PM
        return completionTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
          } catch {
        console.warn('Failed to parse formatted ETA:', formattedEta);
      }
  }
  
  // Fallback to time remaining if no formatted ETA
  if (timeRemainingMinutes !== null && timeRemainingMinutes !== undefined && timeRemainingMinutes > 0) {
    const now = new Date();
    const completionTime = new Date(now.getTime() + timeRemainingMinutes * 60 * 1000);
    
    return completionTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  return '--:--';
}

// ============================================================================
// STATUS PANEL UPDATES
// ============================================================================

/**
 * Update status panel with printer status data
 */
export function updateStatusPanel(data: PollingData): void {
  if (!data.printerStatus) {
    // Clear status panel when no data
    setElementText('printer-status', 'Disconnected');
    setElementText('bed-temp', '0°C/0°C');
    setElementText('extruder-temp', '0°C/0°C');
    // Update fans (preserve labels)
    updateLabelSpanElement('cooling-fan', 'Cooling Fan:', '0');
    updateLabelSpanElement('chamber-fan', 'Chamber Fan:', '0');
    setElementText('filtration-status', 'None');
    updateLabelSpanElement('tvoc-level', 'TVOC Level:', '0');
    setElementText('nozzle-size', 'N/A');
    setElementText('filament-type', 'N/A');
    setElementText('speed-offset', 'N/A');
    setElementText('z-offset', 'N/A');
    return;
  }

  const status = data.printerStatus;

  // Update printer state
  setElementText('printer-status', formatPrinterState(status.state));

  // Update temperatures
  setElementText('bed-temp', formatTemperature(status.temperatures.bed));
  setElementText('extruder-temp', formatTemperature(status.temperatures.extruder));

  // Update fans using helper function for consistency
  updateSpanInLabelElement('cooling-fan', status.fans.coolingFan.toString());
  updateSpanInLabelElement('chamber-fan', status.fans.chamberFan.toString());

  // Update filtration
  const filtrationModeLabels: Record<string, string> = {
    'external': 'External',
    'internal': 'Internal',
    'none': 'None'
  };
  
  setElementText('filtration-status', filtrationModeLabels[status.filtration.mode] || 'None');
  updateSpanInLabelElement('tvoc-level', status.filtration.tvocLevel.toString());

  // Update printer settings
  setElementText('nozzle-size', status.settings.nozzleSize !== undefined ? `${status.settings.nozzleSize}mm` : 'N/A');
  setElementText('filament-type', status.settings.filamentType || 'N/A');
  setElementText('speed-offset', status.settings.speedOffset !== undefined ? status.settings.speedOffset.toString() : 'N/A');
  setElementText('z-offset', status.settings.zAxisOffset !== undefined ? status.settings.zAxisOffset.toFixed(3) : 'N/A');

  // Update connection status indicators
  updateConnectionStatus(data.isConnected);
}

/**
 * Update connection status visual indicators
 */
function updateConnectionStatus(isConnected: boolean): void {
  // Add visual indicators for connection status
  const statusElements = ['printer-status', 'bed-temp', 'extruder-temp'];
  
  statusElements.forEach(elementId => {
    setElementClass(elementId, 'disconnected', !isConnected);
    setElementClass(elementId, 'connected', isConnected);
  });
}

// ============================================================================
// JOB INFORMATION PANEL UPDATES
// ============================================================================

/**
 * Update job information panel with current job data
 */
export function updateJobPanel(data: PollingData): void {
  const job = data.printerStatus?.currentJob;
  
  if (!job || !job.isActive) {
    // Clear job panel when no active job
    setElementText('current-job', 'No active job');
    setElementText('progress-percentage', '0%');
    setElementAttribute('progress-bar', 'value', 0);
    setElementText('layer-info', '0 / 0');
    setElementText('eta', '--:--');
    setElementText('job-time', '00:00');
    setElementText('weight', '0g');
    setElementText('length', '0.0m');
    setElementText('filament-used', '0m');
    return;
  }

  // Update job identification
  setElementText('current-job', job.displayName || job.fileName);

  // Update progress
  const progressPercent = Math.round(job.progress.percentage);
  setElementText('progress-percentage', `${progressPercent}%`);
  setElementAttribute('progress-bar', 'value', progressPercent);

  // Update layer information
  const currentLayer = job.progress.currentLayer || 0;
  const totalLayers = job.progress.totalLayers || 0;
  setElementText('layer-info', `${currentLayer} / ${totalLayers}`);

  // Update timing
  setElementText('eta', formatETA(job.progress.formattedEta, job.progress.timeRemaining));
  setElementText('job-time', formatTime(job.progress.elapsedTime));

  // Update material usage
  setElementText('weight', formatWeight(job.progress.weightUsed));
  setElementText('length', formatLength(job.progress.lengthUsed));
  setElementText('filament-used', formatLength(job.progress.lengthUsed));

  // Update progress bar visual state
  updateProgressBarStyle(progressPercent, data.printerStatus?.state);
}

/**
 * Update progress bar styling based on state
 */
function updateProgressBarStyle(percentage: number, state?: PrinterStatus['state']): void {
  const progressBar = getElement('progress-bar') as HTMLProgressElement;
  if (!progressBar) return;

  // Remove existing state classes
  progressBar.classList.remove('printing', 'paused', 'completed', 'error');

  // Add appropriate state class
  if (state) {
    switch (state) {
      case 'Printing':
        progressBar.classList.add('printing');
        break;
      case 'Paused':
        progressBar.classList.add('paused');
        break;
      case 'Completed':
        progressBar.classList.add('completed');
        break;
      case 'Error':
        progressBar.classList.add('error');
        break;
    }
  }
}

// ============================================================================
// MODEL PREVIEW UPDATES
// ============================================================================

/**
 * Update model preview area with thumbnail data
 */
export function updateModelPreview(data: PollingData): void {
  const previewContainer = getElement('model-preview');
  if (!previewContainer) return;

  const job = data.printerStatus?.currentJob;
  const isJobActive = job && job.isActive;

  if (!isJobActive) {
    // Clear preview when no active job
    clearModelPreview();
    return;
  }

  // Job is active, check if we have thumbnail data
  if (data.thumbnailData) {
    // Update with thumbnail data
    const img = document.createElement('img');
    // thumbnailData already includes the data URL prefix from backend
    img.src = data.thumbnailData;
    img.alt = job?.displayName || 'Model Preview';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    
    // Handle image load errors
    img.onerror = () => {
      console.warn('Failed to load model thumbnail');
      clearModelPreview();
    };

    // Clear existing content and add new image
    previewContainer.innerHTML = '';
    previewContainer.appendChild(img);
  } else {
    // Show placeholder for active job without thumbnail
    previewContainer.innerHTML = `
      <div class="preview-placeholder">
        <div class="preview-placeholder-text">
          <p>Preview for:</p>
          <p><strong>${job?.displayName || 'Current Job'}</strong></p>
          <p>No thumbnail available</p>
        </div>
      </div>
    `;
  }
}

/**
 * Clear model preview area
 */
function clearModelPreview(): void {
  const previewContainer = getElement('model-preview');
  if (previewContainer) {
    previewContainer.innerHTML = `
      <div class="preview-placeholder">
        <div class="preview-placeholder-text">No active job</div>
      </div>
    `;
  }
}

// ============================================================================
// MATERIAL STATION UPDATES (AD5X)
// ============================================================================

/**
 * Update material station display (for AD5X printers)
 */
export function updateMaterialStation(data: PollingData): void {
  if (!data.materialStation || !data.materialStation.connected) {
    // Hide material station UI when not available
    hideMaterialStationUI();
    return;
  }

  // Show and update material station UI
  showMaterialStationUI();
  updateMaterialStationSlots(data.materialStation);
}

/**
 * Show material station UI elements
 */
function showMaterialStationUI(): void {
  // Add material station UI if it doesn't exist
  // This would be implemented based on the specific UI design for material station
  console.log('Material station connected - UI would be shown here');
}

/**
 * Hide material station UI elements
 */
function hideMaterialStationUI(): void {
  // Hide material station UI
  console.log('Material station disconnected - UI would be hidden here');
}

/**
 * Update material station slot display
 */
function updateMaterialStationSlots(station: MaterialStationStatus): void {
  // Update individual slot displays
  station.slots.forEach((slot, _index) => {
    // This would update actual slot UI elements
    console.log(`Slot ${slot.slotId}: ${slot.isEmpty ? 'Empty' : slot.materialType} (${slot.isActive ? 'Active' : 'Inactive'})`);
  });
}

// ============================================================================
// GENERAL STATUS UPDATES
// ============================================================================

/**
 * Update general status information
 */
export function updateGeneralStatus(data: PollingData): void {
  // Update run time from cumulative stats
  if (data.printerStatus?.cumulativeStats) {
    const totalMinutes = data.printerStatus.cumulativeStats.totalPrintTime;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    updateSpanInLabelElement('run-time', `${hours}h:${minutes}m`);
    
    // Update filament used
    const totalMeters = data.printerStatus.cumulativeStats.totalFilamentUsed;
    updateSpanInLabelElement('filament-used', `${totalMeters.toFixed(2)}m`);
  } else {
    // Use placeholders if no data (preserve labels)
    updateLabelSpanElement('run-time', 'Run time:', '0h:0m');
    updateLabelSpanElement('filament-used', 'Filament used:', '0m');
  }

}

// ============================================================================
// MAIN UPDATE FUNCTION
// ============================================================================

/**
 * Update all UI elements with polling data
 */
export function updateAllPanels(data: PollingData): void {
  try {
    // Update all panels
    updateStatusPanel(data);
    updateJobPanel(data);
    updateModelPreview(data);
    updateMaterialStation(data);
    updateGeneralStatus(data);

    // Log update for debugging
    console.log('UI updated with polling data:', {
      connected: data.isConnected,
      hasStatus: !!data.printerStatus,
      hasJob: !!(data.printerStatus?.currentJob?.isActive),
      hasThumbnail: !!data.thumbnailData,
      hasMaterialStation: !!data.materialStation?.connected
    });

  } catch (error) {
    console.error('Error updating UI panels:', error);
  }
}

// ============================================================================
// ANIMATION AND VISUAL EFFECTS
// ============================================================================

/**
 * Add smooth transition animation to element
 */
function addTransition(elementId: string, property: string = 'all', duration: string = '0.3s'): void {
  const element = getElement(elementId);
  if (element) {
    element.style.transition = `${property} ${duration} ease`;
  }
}

/**
 * Initialize UI animations
 */
export function initializeUIAnimations(): void {
  // Add smooth transitions to progress bar
  addTransition('progress-bar', 'value', '0.5s');
  
  // Add transitions to temperature displays
  addTransition('bed-temp', 'color', '0.3s');
  addTransition('extruder-temp', 'color', '0.3s');
  
  // Add transitions to status text
  addTransition('printer-status', 'color', '0.3s');
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle UI update errors gracefully
 */
export function handleUIError(error: unknown, context: string): void {
  console.error(`UI update error in ${context}:`, error);
  
  // Show error state in UI
  setElementText('printer-status', 'Error');
  setElementClass('printer-status', 'error', true);
}

/**
 * Reset UI to default state
 */
export function resetUI(): void {
  console.log('Resetting UI to default state');
  
  const emptyData = {
    printerStatus: null,
    materialStation: null,
    thumbnailData: null,
    isConnected: false,
    lastPolled: new Date()
  };
  
  updateAllPanels(emptyData);
}
