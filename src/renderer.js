// src/renderer.js
import {
    updatePrinterStatus,
    updateTemperatures,
    updateJobInfo,
    resetUI,
    updateCameraView,
    logMessage,
    showInputDialog,
} from './utils/UIUtils.js';

import {
    setupIPCListeners,
    setupWindowControls,
    setupTemperatureControls,
    setupFiltrationControls,
    setupJobControls,
    setupSettingsAndConnection,
    createCommandSender,
    cleanupIPCListeners
} from './utils/EventUtils.js';

import { showToast } from './utils/CSSUtils.js';

let previewEnabled = false;
let cameraStreamUrl = null;
let cameraImgElement = null;

/**
 * Clean up camera stream resources
 * @param {HTMLImageElement} imgElement - The camera image element to clean up
 * @returns {null} Always returns null for assignment
 */
function cleanupCameraStream(imgElement) {
    if (imgElement) {
        // Force abort connection to MJPEG stream if available
        if (imgElement._cameraStream) {
            try {
                imgElement._cameraStream.abort();
            } catch (e) {
                console.error('Error aborting camera stream:', e);
            }
        }
        
        // Remove from DOM if present
        if (imgElement.parentNode) {
            imgElement.parentNode.removeChild(imgElement);
        }
        
        // Clear src to help close connections
        imgElement.src = '';
    }
    
    return null;
}

// --- Handler Functions ---

function handlePrinterData(data) {
    const info = data?.printerInfo;
    if (!info) return;
    
    // Pass the client type to the info object
    info.clientType = data.clientType;

    updatePrinterStatus(info);
    updateTemperatures(info);
    updateJobInfo(info);

    // Handle camera stream URL update
    const newStreamUrl = info.CameraStreamUrl;
    const urlChanged = cameraStreamUrl !== newStreamUrl;
    
    // Update the stream URL variable
    if (newStreamUrl !== undefined) {
        cameraStreamUrl = newStreamUrl;
    }
    
    // Update camera view if preview is enabled and either:
    // 1. The URL has changed, or
    // 2. The camera image element is null (first time or after toggle off)
    if (previewEnabled && (urlChanged || !cameraImgElement)) {
        cameraImgElement = updateCameraView(cameraStreamUrl, previewEnabled, cameraImgElement);
    }
    // If the URL becomes null and was previously set, update the view to show the error
    else if (!newStreamUrl && cameraStreamUrl && previewEnabled) {
        cameraImgElement = updateCameraView(null, previewEnabled, cameraImgElement);
    }
}

function hideElement(element) {
    const elem = document.getElementById(element);
    if (elem) {
        elem.style.display = 'none';
    }
}

function setText(element, text) {
    const elem = document.getElementById(element);
    if (elem) {
        elem.innerText = text;
    }
}

function handlePrinterConnected(data) {
    console.log("[handlePrinterConnected] Event received:", data);
    let ip = data?.ipAddress || 'unknown';
    let name = data?.name || 'Printer';
    let firmware = data?.firmware || 'unknown';
    let clientType = data?.clientType || 'unknown';
    
    // Continue even if some values are missing, but log a warning
    if (!data?.ipAddress || !data?.name || !data?.firmware) {
        console.warn('Printer connected event missing some data:', data);
    }

    logMessage("Connected to " + name + " @ " + ip);
    logMessage("Firmware Version: " + firmware);

    showToast(`Connected to ${name}`, 'success');

    const connectBtn = document.getElementById('btn-connect');
    if (connectBtn) { connectBtn.textContent = 'Connect'; }

    window.api.send('request-printer-data');
    
    // Hide features not available on legacy printers
    if (clientType === 'legacy') {


        hideElement("filtration-section");
        hideElement("printer-info-section");
        //hideElement('cooling-fan');
        //hideElement('chamber-fan');
        hideElement('btn-clear-status');
        hideElement('btn-upload-job');

        setText("run-time", 'Not available');
        setText("filament-used", 'Not available');
    }
}

function handlePrinterDisconnected() {
    console.log("Printer disconnected event received.");
    logMessage("Printer disconnected.");
    showToast("Printer disconnected.", "error");

    resetUI();

    const statusEl = document.getElementById('printer-status');
    if (statusEl) {
        statusEl.textContent = 'Disconnected';
    }

    // Properly clean up camera resources using centralized function
    cameraImgElement = cleanupCameraStream(cameraImgElement);
    cameraStreamUrl = null;
    
    // Update the camera view to show disconnected state
    updateCameraView(null, false, null);

    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) {
        previewEnabled = false;
        previewBtn.textContent = 'Preview On';
    }

    const connectBtn = document.getElementById('btn-connect');
    if (connectBtn) { connectBtn.textContent = 'Connect'; }
    
    // Show all UI elements that might have been hidden for specific printer types
    const filtrationControls = document.getElementById('filtration-controls');
    if (filtrationControls) {
        filtrationControls.style.display = 'block';
    }
    
    const clearStatusBtn = document.getElementById('btn-clear-status');
    if (clearStatusBtn) {
        clearStatusBtn.style.display = 'block';
    }
}

// todo only the upload job should have startNow option
function handleJobSelectionResult(data) {
    logMessage(`Selected job: ${data.filename}`);
    logMessage(`Leveling: ${data.leveling ? 'Yes' : 'No'}`);
    logMessage(`Start now: ${data.startNow ? 'Yes' : 'No'}`);
    if(data.startNow) {
        showToast(`Starting job: ${data.filename}`, 'info');
    } else {
        showToast(`Job ${data.filename} selected`, 'info');
    }
}

// Handler for legacy thumbnail results
function handleLegacyThumbnailResult(data) {
    console.log(`Received legacy thumbnail result for: ${data.filename}`);
    
    const modelPreview = document.getElementById('model-preview');
    if (!modelPreview) return;
    
    // Check if this thumbnail is for the current file being displayed
    const currentFilename = modelPreview.getAttribute('data-filename');
    if (currentFilename !== data.filename) {
        console.log('Received thumbnail is not for the current file, ignoring');
        return;
    }
    
    // Update the preview with the thumbnail
    if (data.thumbnail) {
        console.log('Updating model preview with legacy thumbnail');
        modelPreview.innerHTML = `<img src="data:image/png;base64,${data.thumbnail}" alt="Model Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;  
    } else {
        console.log('No thumbnail available for this file');
        modelPreview.innerHTML = '<span>No preview available</span>';
    }
}


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer process started - DOM loaded');

    previewEnabled = false;
    const previewBtn = document.getElementById('btn-preview');
    if(previewBtn) previewBtn.textContent = 'Preview On';

    // Check if window.api is available
    if (!window.api) {
        console.error('API is not available. Preload script might not be loaded correctly.');
        return;
    }
    
    // Setup IPC listeners using the handler functions
    setupIPCListeners(window.api, {
        onPrinterData: handlePrinterData,
        onPrinterConnected: handlePrinterConnected,
        onPrinterDisconnected: handlePrinterDisconnected,
        onJobSelectionResult: handleJobSelectionResult,
        onLogMessage: logMessage,
        onLegacyThumbnailResult: handleLegacyThumbnailResult
    });

    // Setup window controls
    setupWindowControls(window.api);

    // Setup button listeners
    setupButtons();

    // Log startup
    logMessage('Application UI loaded');

    // Setup cleanup when window is unloaded
    window.addEventListener('beforeunload', cleanupResources);
});

// --- Resource Cleanup ---

/**
 * Cleanup resources when window is closed
 */
function cleanupResources() {
    console.log('Cleaning up resources in renderer');
    if (window.api) { cleanupIPCListeners(window.api); }
    // Prevent multiple calls if page reloads etc.
    window.removeEventListener('beforeunload', cleanupResources);
}

// --- Button Setup ---

/**
 * Setup button event listeners
 */
function setupButtons() {
    const api = window.api; // Use window.api directly

    // Helper to add listener if element exists
    const addClickListener = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        } else {
            console.warn(`Button with ID #${id} not found.`);
        }
    };

    // Control buttons - using createCommandSender for consistent handling
    addClickListener('btn-led-on', createCommandSender(api, 'led-on', 'LED On'));
    addClickListener('btn-led-off', createCommandSender(api, 'led-off', 'LED Off'));
    addClickListener('btn-clear-status', createCommandSender(api, 'clear-status', 'Clear Status'));
    addClickListener('btn-home-axes', createCommandSender(api, 'home-axes', 'Home Axes'));
    addClickListener('btn-pause', createCommandSender(api, 'pause-print', 'Pause Print'));
    addClickListener('btn-resume', createCommandSender(api, 'resume-print', 'Resume Print'));
    addClickListener('btn-stop', createCommandSender(api, 'cancel-print', 'Stop Print'));

    // Preview toggle
    addClickListener('btn-preview', (e) => {
        // Toggle the preview state
        previewEnabled = !previewEnabled;
        
        // Update button text
        const btn = e.target;
        btn.textContent = previewEnabled ? 'Preview Off' : 'Preview On';
        
        // Force cleanup of previous image element using centralized function
        cameraImgElement = cleanupCameraStream(cameraImgElement);
        
        // Longer delay for browser to clean up connections before creating new ones
        setTimeout(() => {
            // Update view based on new state
            cameraImgElement = updateCameraView(cameraStreamUrl, previewEnabled, cameraImgElement);
            logMessage(`Command: Preview ${previewEnabled ? 'On' : 'Off'}`);
        }, 100); // 100ms delay should be enough
    });

    // Setup temperature controls (uses showInputDialog passed from this scope)
    setupTemperatureControls(api, showInputDialog);

    // Setup filtration controls
    setupFiltrationControls(api);

    // Setup job controls
    setupJobControls(api);

    // Setup settings and connection buttons
    setupSettingsAndConnection(api);
    
    // Setup status button
    addClickListener('btn-status', () => {
        api.send('open-status-dialog');
    });
    
    // Setup camera restoration button (for troubleshooting stuck streams)
    addClickListener('btn-restore-camera', () => {
        logMessage('Attempting to restore camera stream...');
        showToast('Restoring camera stream...', 'info');
        
        api.send('restore-camera-stream');
        
        // Listen for the response
        const responseHandler = (response) => {
            if (response.success) {
                logMessage('Camera stream restoration successful');
                showToast('Camera stream restored successfully', 'success');
            } else {
                logMessage(`Camera stream restoration failed: ${response.error || response.message}`);
                showToast('Camera stream restoration failed', 'error');
            }
            // Remove the listener after handling
            api.removeListener('restore-camera-stream-response', responseHandler);
        };
        
        api.on('restore-camera-stream-response', responseHandler);
    });
}