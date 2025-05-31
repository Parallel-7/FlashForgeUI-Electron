// src/UIUtils.js

/**
 * UI Utilities for FlashForge UI
 * This module centralizes common UI update functions and event handling
 */

import {applyStatusClass} from './CSSUtils.js';

/**
 * Updates UI elements with printer status information
 * @param {Object} info - Printer information object
 */
export function updatePrinterStatus(info) {
    if (!info) return;

    // Update printer status
    const status = info.Status?.toLowerCase() || 'idle';
    const statusEl = document.getElementById('printer-status');
    statusEl.textContent = status;

    // Apply appropriate status class using utility function
    applyStatusClass(statusEl, status);

    // Update run time and filament used
    updateElementText('run-time', info.FormattedTotalRunTime || '0h:0m');
    updateElementText('filament-used', `${info.CumulativeFilament?.toFixed(2) || 0}m`);

    // Update printer details
    updateElementText('nozzle-size', info.NozzleSize || '0.4mm');
    updateElementText('filament-type', info.FilamentType || 'PLA');
    updateElementText('speed-offset', info.PrintSpeedAdjust || 100);
    updateElementText('z-offset', info.ZAxisCompensation?.toFixed(3) || '0.000');

    // Update fan info
    const coolingFanEl = document.querySelector('#cooling-fan span');
    if (coolingFanEl) coolingFanEl.textContent = info.CoolingFanSpeed || 0;
    
    const chamberFanEl = document.querySelector('#chamber-fan span');
    if (chamberFanEl) chamberFanEl.textContent = info.ChamberFanSpeed || 0;

    // Update TVOC level
    updateElementText('tvoc-level', info.Tvoc || 0);

    // Update filtration status
    let filtrationStatus = 'None';
    if (info.ExternalFanOn) filtrationStatus = 'External';
    if (info.InternalFanOn) filtrationStatus = info.ExternalFanOn ? 'Both' : 'Internal';
    updateElementText('filtration-status', filtrationStatus);
}

/**
 * Updates temperature displays
 * @param {Object} info - Printer information object
 */
export function updateTemperatures(info) {
    if (!info) return;

    // Update bed temperature with rounding
    const bedTemp = Math.round(info.PrintBed?.current || 0);
    const bedSetTemp = Math.round(info.PrintBed?.set || 0);
    updateElementText('bed-temp', `${bedTemp}°C/${bedSetTemp}°C`);

    // Update extruder temperature with rounding
    const extruderTemp = Math.round(info.Extruder?.current || 0);
    const extruderSetTemp = Math.round(info.Extruder?.set || 0);
    updateElementText('extruder-temp', `${extruderTemp}°C/${extruderSetTemp}°C`);
}

/**
 * Updates job information
 * @param {Object} info - Printer information object
 */
export function updateJobInfo(info) {
    if (!info) return;

    // Check if we have a print job (either active or completed)
    const isPrinting = info.Status?.toLowerCase() === 'printing';
    const isCompleted = info.Status?.toLowerCase() === 'completed';
    const hasJob = isPrinting || isCompleted;

    // Update current job and progress
    updateElementText('current-job', hasJob ? info.PrintFileName || 'Unknown' : 'No active job');

    const progress = info.PrintProgressInt || 0;
    updateElementText('progress-percentage', `${progress}%`);
    
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.value = progress;

    // Update layer info
    const currentLayer = info.CurrentPrintLayer || 0;
    const totalLayers = info.TotalPrintLayers || 0;
    updateElementText('layer-info', `${currentLayer} / ${totalLayers}`);

    // Update job details
    // Only show ETA when actually printing
    if (isPrinting) {
        // Convert ETA from time remaining to actual completion time
        const etaTime = info.PrintEta || '--:--';
        if (etaTime && etaTime !== '--:--') {
            const [hours, minutes] = etaTime.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                const now = new Date();
                const completionTime = new Date(now.getTime() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000));
                const completionTimeStr = completionTime.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
                updateElementText('eta', completionTimeStr);
            } else {
                updateElementText('eta', etaTime); // Fallback to original format
            }
        } else {
            updateElementText('eta', etaTime);
        }
    } else {
        // Not printing, show placeholder
        updateElementText('eta', '--:--');
    }
    updateElementText('job-time', info.FormattedRunTime || '00:00');
    updateElementText('weight', `${info.EstWeight?.toFixed(1) || 0}g`);
    updateElementText('length', `${info.EstLength?.toFixed(2) || 0}m`);

    // Update model preview if available
    const modelPreview = document.getElementById('model-preview');
    if (modelPreview) {
        if (info.PrintFileThumbUrl) {
            // Modern printers provide the thumbnail URL directly
            modelPreview.innerHTML = `<img src="${info.PrintFileThumbUrl}" alt="Model Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        } else if (info.PrintFileName && (hasJob || info.clientType === 'legacy')) {
            // For legacy printers or when we have a job (including completed jobs), request the thumbnail via IPC
            // The renderer will handle actually fetching it through IPC
            modelPreview.setAttribute('data-filename', info.PrintFileName);
            
            // Only request if we haven't already requested for this filename
            if (modelPreview.getAttribute('data-requested-filename') !== info.PrintFileName) {
                console.log(`Requesting legacy thumbnail for job: ${info.PrintFileName}`);
                // Send the request to main process
                window.api.send('request-legacy-thumbnail', info.PrintFileName);
                // Mark as requested to avoid duplicate requests
                modelPreview.setAttribute('data-requested-filename', info.PrintFileName);
                // Show loading indicator
                modelPreview.innerHTML = '<span>Loading preview...</span>';
            }
        } else {
            modelPreview.innerHTML = '<span>No preview available</span>';
            // Clear any previous data
            modelPreview.removeAttribute('data-filename');
            modelPreview.removeAttribute('data-requested-filename');
        }
    }
}

/**
 * Resets the UI elements for job information
 * @param {boolean} preserveCompletedJob - If true, doesn't fully reset UI if there's a completed job
 */
export function resetUI(preserveCompletedJob = false) {
    // If we're preserving completed job info and the printer status is 'completed',
    // then don't reset the job name or model preview
    const printerStatus = document.getElementById('printer-status')?.textContent?.toLowerCase();
    const isCompleted = printerStatus === 'completed';
    
    if (!preserveCompletedJob || !isCompleted) {
        updateElementText('current-job', 'No active job');
        
        const modelPreview = document.getElementById('model-preview');
        if (modelPreview) {
            modelPreview.innerHTML = '<span>No preview available</span>';
            // Clear any previous data
            modelPreview.removeAttribute('data-filename');
            modelPreview.removeAttribute('data-requested-filename');
        }
        
        updateElementText('layer-info', '0 / 0');
        updateElementText('eta', '--:--');
        updateElementText('job-time', '00:00');
        updateElementText('weight', '0g');
        updateElementText('length', '0m');
    }
    
    updateElementText('progress-percentage', '0%');
    
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.value = 0;
}

/**
 * Updates camera view based on stream URL and preview state
 * This function properly handles MJPEG streams by creating a new element each time
 * @param {string} streamUrl - URL to camera stream (can be either direct printer URL or proxy URL)
 * @param {boolean} previewEnabled - Whether preview is enabled
 * @param {HTMLImageElement} cameraImgElement - Reference to previous camera image element
 * @returns {HTMLImageElement|null} - New camera image element or null if preview disabled
 */
export function updateCameraView(streamUrl, previewEnabled, cameraImgElement) {
    const cameraViewDiv = document.querySelector('.camera-view');
    if (!cameraViewDiv) return null;
    
    // Always clear the existing content first
    cameraViewDiv.innerHTML = '';
    
    // First, force the destruction of any existing image element
    // This helps ensure any active connections are properly closed
    if (cameraImgElement) {
        // Force aborted connection to MJPEG stream
        if (cameraImgElement._cameraStream) {
            try {
                cameraImgElement._cameraStream.abort();
            } catch (e) {
                console.error('Error aborting camera stream:', e);
            }
        }
        
        if (cameraImgElement.parentNode) {
            cameraImgElement.parentNode.removeChild(cameraImgElement);
        }
        // Force garbage collection hint
        cameraImgElement.src = '';
        cameraImgElement.remove();
        cameraImgElement = null;
    }
    
    // If preview is disabled, show the disabled message and return null
    if (!previewEnabled) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'no-camera';
        messageDiv.textContent = 'Preview Disabled';
        cameraViewDiv.appendChild(messageDiv);
        return null;
    }
    
    // If no stream URL available, show the unavailable message and return null
    if (!streamUrl) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'no-camera';
        messageDiv.textContent = 'Camera feed not available';
        cameraViewDiv.appendChild(messageDiv);
        return null;
    }
    
    // Create a completely new image element
    const newImg = document.createElement('img');
    newImg.style.maxWidth = '100%';
    newImg.style.maxHeight = '100%';
    newImg.setAttribute('autoplay', '');
    
    // Error handling must be set up before setting the source
    newImg.onerror = () => {
        // Only replace if still in DOM
        if (cameraViewDiv.contains(newImg)) {
            cameraViewDiv.innerHTML = '';
            const messageDiv = document.createElement('div');
            messageDiv.className = 'no-camera';
            messageDiv.textContent = 'Error loading camera feed';
            cameraViewDiv.appendChild(messageDiv);
        }
    };
    
    // Set up load event handler
    newImg.onload = () => {
        console.log('Camera feed loaded successfully');
    };
    
    // Now set the source to start loading the stream
    // Use our dedicated camera service URL
    try {
        // Add cache-busting parameter with timestamp to prevent browser caching
        const timestamp = Date.now();
        let cameraUrl;
        
        // Get the camera URL from window object (set in preload.js)
        if (window.CAMERA_URL) {
            cameraUrl = window.CAMERA_URL;
        } else {
            // Fallback to default camera URL
            cameraUrl = 'http://localhost:8181/camera';
        }
        
        // Add cache buster
        cameraUrl = `${cameraUrl}${cameraUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
        
        console.log(`Camera: Using camera service URL: ${cameraUrl}`);
        
        // Create an AbortController to allow aborting the fetch
        newImg._cameraStream = new AbortController(); // Store reference for cleanup
        
        // Set the image source
        newImg.src = cameraUrl;
    } catch (error) {
        // Fallback in case of any error
        console.error('Error setting camera URL:', error);
        const fallbackUrl = `http://localhost:8181/camera?_t=${Date.now()}`;
        console.log(`Camera: Using fallback URL: ${fallbackUrl}`);
        newImg.src = fallbackUrl;
    }
    
    // Add to the DOM
    cameraViewDiv.appendChild(newImg);
    
    return newImg;
}

/**
 * Add a message to the log panel with optimized DOM operations
 * @param {string} message - Message to log
 */
export function logMessage(message) {
    const logOutputDiv = document.getElementById('log-output');
    if (!logOutputDiv) return;
    
    const logPanelDiv = logOutputDiv.parentElement; // Get the parent (.log-panel) which scrolls
    const time = new Date().toLocaleTimeString();
    
    // Create the new entry
    const entry = document.createElement('div');
    entry.textContent = `${time} - ${message}`;
    
    // Use DocumentFragment for better performance when removing multiple elements
    if (logOutputDiv.childElementCount >= 100) {
        const fragment = document.createDocumentFragment();
        // Get all children except the ones to remove
        Array.from(logOutputDiv.children)
            .slice(logOutputDiv.childElementCount - 99)
            .forEach(child => fragment.appendChild(child));
        
        // Clear and repopulate in one operation
        logOutputDiv.innerHTML = '';
        logOutputDiv.appendChild(fragment);
    }
    
    // Add the new entry
    logOutputDiv.appendChild(entry);

    // Auto-scroll the PARENT panel to bottom
    if (logPanelDiv) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
            logPanelDiv.scrollTop = logPanelDiv.scrollHeight;
        });
    }
}

/**
 * Shows an input dialog and returns the user input
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} - Resolves with user input or null if canceled
 */
export function showInputDialog(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        // Set up one-time listener for the response
        const handleResponse = (result) => {
            window.api.removeListener('dialog-response', handleResponse);
            resolve(result);
        };
        
        window.api.receive('dialog-response', handleResponse);

        // Show the dialog
        window.api.send('show-input-dialog', {
            title,
            message,
            defaultValue
        });
    });
}

/**
 * Helper function to update text content of an element by ID
 * @param {string} elementId - ID of the element to update
 * @param {string|number} text - Text content to set
 */
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = text;
}

