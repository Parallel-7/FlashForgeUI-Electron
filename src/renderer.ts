// src/renderer.ts
// Main renderer process with real-time data polling integration

import './index.css';
import { getGlobalStateTracker, STATE_EVENTS, type StateChangeEvent } from './services/printer-state';
import { updateAllPanels, initializeUIAnimations, resetUI, handleUIError } from './services/ui-updater';
import type { PollingData } from './types/polling';
import type { ResolvedCameraConfig } from './types/camera';


let previewEnabled = false;
let cameraStreamElement: HTMLImageElement | null = null;

// Track filtration availability from backend
let filtrationAvailable = false;

// Track IFS button visibility for AD5X printers
let ifsButtonVisible = false;

// Track legacy printer status for feature detection
let isLegacyPrinter = false;

// Basic UI state management
interface UIState {
  printerStatus: string;
  currentJob: string;
  progress: number;
  bedTemp: string;
  extruderTemp: string;
  layerInfo: string;
  eta: string;
  jobTime: string;
  weight: string;
  length: string;
}

// Loading state management
interface LoadingState {
  isVisible: boolean;
  state: 'hidden' | 'loading' | 'success' | 'error';
  message: string;
  progress: number;
  canCancel: boolean;
}

const defaultUIState: UIState = {
  printerStatus: 'Disconnected',
  currentJob: 'No active job',
  progress: 0,
  bedTemp: '0°C/0°C',
  extruderTemp: '0°C/0°C',
  layerInfo: '0 / 0',
  eta: '--:--',
  jobTime: '00:00',
  weight: '0g',
  length: '0m'
};

const defaultLoadingState: LoadingState = {
  isVisible: false,
  state: 'hidden',
  message: '',
  progress: 0,
  canCancel: false
};

// Current loading state
let currentLoadingState: LoadingState = { ...defaultLoadingState };

// Loading management functions
function updateLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay');
  const messageEl = document.getElementById('loading-message');
  const progressContainer = document.getElementById('loading-progress-container');
  const progressFill = document.getElementById('loading-progress-fill');
  const progressText = document.getElementById('loading-progress-text');
  const cancelBtn = document.getElementById('loading-cancel-btn');

  if (!overlay || !messageEl) {
    console.error('Loading overlay elements not found');
    return;
  }

  // Update visibility
  if (currentLoadingState.isVisible) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    return;
  }

  // Update state class
  overlay.className = `loading-overlay state-${currentLoadingState.state}`;

  // Update message
  messageEl.textContent = currentLoadingState.message;

  // Update progress
  if (progressContainer && progressFill && progressText) {
    if (currentLoadingState.state === 'loading' && currentLoadingState.progress > 0) {
      progressContainer.classList.add('visible');
      progressFill.style.width = `${currentLoadingState.progress}%`;
      progressText.textContent = `${Math.round(currentLoadingState.progress)}%`;
    } else {
      progressContainer.classList.remove('visible');
    }
  }

  // Update cancel button
  if (cancelBtn) {
    if (currentLoadingState.canCancel && currentLoadingState.state === 'loading') {
      cancelBtn.classList.add('visible');
    } else {
      cancelBtn.classList.remove('visible');
    }
  }
}



function setupLoadingEventListeners(): void {
  if (!window.api) {
    console.error('API not available for loading event listeners');
    return;
  }

  // Listen for loading state changes from main process
  window.api.receive('loading-state-changed', (eventData: unknown) => {
    const data = eventData as {
      state: 'hidden' | 'loading' | 'success' | 'error';
      message?: string;
      progress?: number;
      canCancel?: boolean;
    };

    currentLoadingState = {
      isVisible: data.state !== 'hidden',
      state: data.state,
      message: data.message || '',
      progress: data.progress || 0,
      canCancel: data.canCancel || false
    };
    updateLoadingOverlay();
  });

  // Setup cancel button event listener
  const cancelBtn = document.getElementById('loading-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (currentLoadingState.canCancel && window.api?.loading) {
        window.api.loading.cancel();
        logMessage('Loading operation cancelled by user');
      }
    });
  }
}

// Basic logging function
function logMessage(message: string): void {
  const logOutput = document.getElementById('log-output');
  if (logOutput) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }
}

// Basic UI update functions
function updateUIElement(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setupWindowControls(): void {
  const minimizeBtn = document.getElementById('btn-minimize');
  const maximizeBtn = document.getElementById('btn-maximize');
  const closeBtn = document.getElementById('btn-close');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      logMessage('Minimize button clicked');
      if (window.api) {
        window.api.send('window-minimize');
      } else {
        logMessage('ERROR: API not available for minimize');
      }
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      logMessage('Maximize button clicked');
      if (window.api) {
        window.api.send('window-maximize');
      } else {
        logMessage('ERROR: API not available for maximize');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      logMessage('Close button clicked');
      if (window.api) {
        window.api.send('window-close');
      } else {
        logMessage('ERROR: API not available for close');
      }
    });
  }
}

async function handleTemperatureDialog(buttonId: string): Promise<void> {
  if (!window.api || !window.api.showInputDialog) {
    logMessage('ERROR: Input dialog API not available');
    return;
  }

  const isBedTemp = buttonId === 'btn-bed-set';
  const targetType = isBedTemp ? 'bed' : 'extruder';
  const maxTemp = isBedTemp ? 120 : 300;
  const defaultTemp = isBedTemp ? 60 : 200;

  try {
    const result = await window.api.showInputDialog({
      title: `Set ${targetType.charAt(0).toUpperCase() + targetType.slice(1)} Temperature`,
      message: `Enter target temperature (0-${maxTemp}°C):`,
      defaultValue: defaultTemp.toString(),
      inputType: 'text',
      placeholder: `e.g. ${defaultTemp}`
    });

    if (result !== null) {
      const temperature = parseInt(result, 10);
      
      if (isNaN(temperature)) {
        logMessage(`ERROR: Invalid temperature value: ${result}`);
        return;
      }
      
      if (temperature < 0 || temperature > maxTemp) {
        logMessage(`ERROR: Temperature out of range (0-${maxTemp}°C): ${temperature}`);
        return;
      }
      
      logMessage(`Setting ${targetType} temperature to ${temperature}°C`);
      
      // Send IPC message to actually set the temperature
      if (window.api) {
        const response = await window.api.invoke(isBedTemp ? 'set-bed-temp' : 'set-extruder-temp', temperature) as { success: boolean; error?: string };
        if (response.success) {
          logMessage(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} temperature command sent successfully`);
        } else {
          logMessage(`ERROR: Failed to set ${targetType} temperature: ${response.error || 'Unknown error'}`);
        }
      }
    } else {
      logMessage(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} temperature setting cancelled`);
    }
  } catch (error) {
    logMessage(`ERROR: Failed to show temperature dialog: ${error}`);
  }
}

async function handleCameraToggle(button: HTMLElement): Promise<void> {
  const cameraView = document.querySelector('.camera-view');
  
  if (!cameraView || !window.api?.camera) {
    logMessage('ERROR: Camera view or API not available');
    return;
  }
  
  try {
    // Toggle preview state
    previewEnabled = !previewEnabled;
    button.textContent = previewEnabled ? 'Preview Off' : 'Preview On';
    
    if (previewEnabled) {
      // Check camera availability
      const cameraConfigRaw = await window.api.camera.getConfig();
      const cameraConfig = cameraConfigRaw as ResolvedCameraConfig | null;
      
      if (!cameraConfig) {
        // No printer connected
        cameraView.innerHTML = '<div class="no-camera">Please connect to a printer first</div>';
        (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
        previewEnabled = false;
        button.textContent = 'Preview On';
        logMessage('Cannot enable camera - no printer connected');
        return;
      }
      
      if (!cameraConfig.isAvailable) {
        // Camera not available
        const reason = cameraConfig.unavailableReason || 'Camera not available';
        cameraView.innerHTML = `<div class="no-camera">${reason}</div>`;
        (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
        previewEnabled = false;
        button.textContent = 'Preview On';
        logMessage(`Cannot enable camera: ${reason}`);
        
        // Show helpful message based on reason
        if (reason.includes('does not have a built-in camera')) {
          logMessage('Enable custom camera in settings to use an external camera');
        } else if (reason.includes('URL')) {
          logMessage('Please configure camera URL in settings');
        }
        return;
      }
      
      // Camera is available - get proxy URL and show stream
      const proxyUrl = await window.api.camera.getProxyUrl();
      const streamUrl = `${proxyUrl}`; // The proxy URL already includes /camera
      
      logMessage(`Enabling camera preview from: ${cameraConfig.sourceType} camera`);
      
      // Clear existing content
      cameraView.innerHTML = '';
      
      // Create image element for MJPEG stream
      cameraStreamElement = document.createElement('img');
      cameraStreamElement.src = streamUrl;
      cameraStreamElement.style.width = '100%';
      cameraStreamElement.style.height = '100%';
      cameraStreamElement.style.objectFit = 'fill'; // Stretch to fill entire space
      cameraStreamElement.alt = 'Camera Stream';
      
      // Handle stream errors
      cameraStreamElement.onerror = () => {
        logMessage('Camera stream error - attempting to restore...');
        // Try to restore the stream
        void window.api.camera.restoreStream().then(restored => {
          if (!restored) {
            cameraView.innerHTML = '<div class="no-camera">Camera stream error</div>';
          }
        });
      };
      
      // Handle successful load
      cameraStreamElement.onload = () => {
        logMessage('Camera stream connected successfully');
      };
      
      cameraView.appendChild(cameraStreamElement);
      (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
      
    } else {
      // Disable camera preview
      logMessage('Disabling camera preview');
      
      // Stop the stream by properly cleaning up the image element
      if (cameraStreamElement) {
        // Remove error handlers to prevent false error events when clearing src
        cameraStreamElement.onerror = null;
        cameraStreamElement.onload = null;
        
        // Clear the source to stop the stream
        cameraStreamElement.src = '';
        cameraStreamElement = null;
      }
      
      // Restore the no-camera message
      cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';
      (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
      
      // Notify backend that preview is disabled
      await window.api.camera.setEnabled(false);
    }
    
  } catch (error) {
    logMessage(`ERROR: Camera toggle failed: ${error}`);
    previewEnabled = false;
    button.textContent = 'Preview On';
    cameraView.innerHTML = '<div class="no-camera">Camera error</div>';
  }
}

function setupBasicButtons(): void {
  // Add click listeners to all buttons for visual feedback
  const buttons = [
    'btn-connect', 'btn-settings', 'btn-status', 'btn-ifs',
    'btn-led-on', 'btn-led-off', 'btn-clear-status', 'btn-home-axes',
    'btn-pause', 'btn-resume', 'btn-stop', 'btn-upload-job',
    'btn-start-recent', 'btn-start-local', 'btn-swap-filament', 'btn-send-cmds',
    'btn-preview',
    'btn-bed-set', 'btn-bed-off', 'btn-extruder-set', 'btn-extruder-off',
    'btn-external-filtration', 'btn-internal-filtration', 'btn-no-filtration'
  ];

  buttons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', async () => {

        
        // Special handling for preview button
        if (buttonId === 'btn-preview') {
          void handleCameraToggle(button);
          return;
        }
        
        // Special handling for temperature setting buttons
        if (buttonId === 'btn-bed-set' || buttonId === 'btn-extruder-set') {
          void handleTemperatureDialog(buttonId);
          return;
        }
        
        // Send IPC message if API is available
        if (window.api) {
          // Map button IDs to IPC channels (for dialogs and simple sends only)
          const channelMap: { [key: string]: string | { channel: string; data?: unknown } } = {
            'btn-connect': 'open-printer-selection',
            'btn-settings': 'open-settings-window',
            'btn-status': 'open-status-dialog',
            'btn-ifs': 'open-ifs-dialog',
            'btn-upload-job': 'open-job-uploader',
            'btn-start-recent': 'show-recent-files',
            'btn-start-local': 'show-local-files',
            'btn-send-cmds': 'open-send-commands',
            'btn-external-filtration': { channel: 'set-filtration', data: 'external' },
            'btn-internal-filtration': { channel: 'set-filtration', data: 'internal' },
            'btn-no-filtration': { channel: 'set-filtration', data: 'off' }
          };
          
          const mapping = channelMap[buttonId];
          if (mapping) {
            if (typeof mapping === 'string') {
              // Simple send for most buttons
              console.log(`Sending IPC message: ${mapping}`);
              window.api.send(mapping);
            } else if (typeof mapping === 'object' && mapping.channel) {
              // Handle buttons that need invoke with data (like filtration)
              if (mapping.channel === 'set-filtration') {
                try {
                  const response = await window.api.invoke(mapping.channel, mapping.data) as { success: boolean; error?: string };
                  if (response.success) {
                    logMessage(`Filtration mode set to ${mapping.data}`);
                  } else {
                    logMessage(`ERROR: Failed to set filtration: ${response.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  logMessage(`ERROR: Filtration control failed: ${error}`);
                }
              }
            }
          } else {
            // For buttons that need invoke (control commands that return responses)
            const invokeMap: { [key: string]: string } = {
              'btn-led-on': 'led-on',
              'btn-led-off': 'led-off',
              'btn-home-axes': 'home-axes',
              'btn-pause': 'pause-print',
              'btn-resume': 'resume-print',
              'btn-stop': 'cancel-print',
              'btn-clear-status': 'clear-status',
              'btn-bed-off': 'turn-off-bed-temp',
              'btn-extruder-off': 'turn-off-extruder-temp'
            };
            
            const invokeChannel = invokeMap[buttonId];
            if (invokeChannel) {
              try {
                const response = await window.api.invoke(invokeChannel) as { success: boolean; error?: string };
                if (response.success) {
                  logMessage(`Command ${invokeChannel} executed successfully`);
                } else {
                  logMessage(`ERROR: Command ${invokeChannel} failed: ${response.error || 'Unknown error'}`);
                }
              } catch (error) {
                logMessage(`ERROR: Failed to execute ${invokeChannel}: ${error}`);
              }
            }
          }
        }
      });
    }
  });
}

function initializeUI(): void {
  // Set initial UI state
  updateUIElement('printer-status', defaultUIState.printerStatus);
  updateUIElement('current-job', defaultUIState.currentJob);
  updateUIElement('bed-temp', defaultUIState.bedTemp);
  updateUIElement('extruder-temp', defaultUIState.extruderTemp);
  updateUIElement('layer-info', defaultUIState.layerInfo);
  updateUIElement('eta', defaultUIState.eta);
  updateUIElement('job-time', defaultUIState.jobTime);
  updateUIElement('weight', defaultUIState.weight);
  updateUIElement('length', defaultUIState.length);
  
  // Set progress bar
  const progressBar = document.getElementById('progress-bar') as HTMLProgressElement;
  const progressPercentage = document.getElementById('progress-percentage');
  if (progressBar) {
    progressBar.value = defaultUIState.progress;
  }
  if (progressPercentage) {
    progressPercentage.textContent = `${defaultUIState.progress}%`;
  }
  
  // Set initial preview button state
  const previewBtn = document.getElementById('btn-preview');
  if (previewBtn) {
    previewBtn.textContent = 'Preview On';
  }
  
  // Initialize UI animations for smooth updates
  initializeUIAnimations();
  
  // Initialize filtration button states (disabled by default until backend reports availability)
  updateFiltrationButtonStates();
  
  // Initialize legacy printer button states (disabled by default until backend is initialized)
  updateLegacyPrinterButtonStates();
  


}

/**
 * Update button states based on printer state and backend features
 * Disables certain buttons during printing/paused states for safety
 * Disables print control buttons when printer is ready/completed
 */
function updateButtonStates(printerState: string): void {
  // Use the new state categories
  const isActiveState = printerState === 'Printing' || 
                       printerState === 'Paused' ||
                       printerState === 'Calibrating' ||
                       printerState === 'Heating' ||
                       printerState === 'Pausing';
                       

                      
  const canControlPrint = printerState === 'Printing' ||
                         printerState === 'Paused' ||
                         printerState === 'Heating' ||
                         printerState === 'Calibrating';
                         
  const isBusy = printerState === 'Busy' || printerState === 'Error';
  
  // Buttons that should be disabled during active states
  const buttonsToDisable = [
    'btn-bed-set',
    'btn-bed-off',
    'btn-extruder-set',
    'btn-extruder-off',
    'btn-start-recent',
    'btn-start-local',
    'btn-upload-job',
    'btn-home-axes'
  ];
  
  // Buttons that should be disabled when printer is in ready/completed states
  const printControlButtons = [
    'btn-pause',
    'btn-resume',
    'btn-stop'
  ];
  
  // Disable safety buttons during active states
  buttonsToDisable.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (isActiveState || isBusy) {
        // Disable button
        button.classList.add('disabled');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
      } else {
        // Enable button
        button.classList.remove('disabled');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
      }
    }
  });
  
  // Handle print control buttons with more specific logic
  printControlButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      let shouldDisable = false;
      
      // Specific logic for each print control button
      if (buttonId === 'btn-pause') {
        shouldDisable = printerState !== 'Printing';
      } else if (buttonId === 'btn-resume') {
        shouldDisable = printerState !== 'Paused';
      } else if (buttonId === 'btn-stop') {
        shouldDisable = !canControlPrint;
      }
      
      if (shouldDisable) {
        button.classList.add('disabled');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
      } else {
        button.classList.remove('disabled');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
      }
    }
  });
  
  // Update filtration button states based on backend features
  updateFiltrationButtonStates();
  
  // Update legacy printer button states based on printer type
  updateLegacyPrinterButtonStates();
  

}

/**
 * Update filtration button states based on backend feature availability
 */
function updateFiltrationButtonStates(): void {
  const filtrationButtons = [
    'btn-external-filtration',
    'btn-internal-filtration', 
    'btn-no-filtration'
  ];
  
  filtrationButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (filtrationAvailable) {
        button.classList.remove('disabled');
        (button as HTMLButtonElement).disabled = false;
      } else {
        button.classList.add('disabled');
        (button as HTMLButtonElement).disabled = true;
      }
    }
  });
}

/**
 * Update IFS button visibility based on material station availability
 */
function updateIFSButtonVisibility(): void {
  const ifsButton = document.getElementById('btn-ifs');
  if (ifsButton) {
    if (ifsButtonVisible) {
      ifsButton.classList.remove('hidden');
    } else {
      ifsButton.classList.add('hidden');
    }
  }
}

/**
 * Update legacy printer button states based on printer backend type
 * Disables unsupported features for legacy printers
 */
function updateLegacyPrinterButtonStates(): void {
  // Buttons that should be disabled for legacy printers
  const legacyUnsupportedButtons = [
    'btn-clear-status',  // Clear Status - not supported on legacy printers
    'btn-upload-job'     // Upload Job - not supported on legacy printers
  ];
  
  // Buttons that should remain enabled for legacy printers
  const legacySupportedButtons = [
    'btn-start-local'    // Start Local Job - supported on legacy printers
  ];
  
  if (isLegacyPrinter) {
    // Disable unsupported buttons for legacy printers
    legacyUnsupportedButtons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('disabled', 'legacy-unsupported');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
        
        // Add title attribute to show why button is disabled
        button.setAttribute('title', 'Not supported on legacy printers');
        
        console.log(`[LegacyUI] Disabled ${buttonId} for legacy printer`);
      }
    });
    
    // Ensure supported buttons remain enabled (unless disabled by other logic)
    legacySupportedButtons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        // Only enable if not disabled by other state logic
        if (!button.classList.contains('disabled') || button.classList.contains('legacy-unsupported')) {
          button.classList.remove('disabled', 'legacy-unsupported');
          button.removeAttribute('disabled');
          (button as HTMLButtonElement).disabled = false;
          button.removeAttribute('title');
          
          console.log(`[LegacyUI] Ensured ${buttonId} is enabled for legacy printer`);
        }
      }
    });
    
    logMessage('Legacy printer detected - unsupported buttons disabled');
  } else {
    // For modern printers, remove legacy-specific restrictions
    [...legacyUnsupportedButtons, ...legacySupportedButtons].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button && button.classList.contains('legacy-unsupported')) {
        button.classList.remove('legacy-unsupported');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
        button.removeAttribute('title');
        
        console.log(`[LegacyUI] Removed legacy restrictions from ${buttonId} for modern printer`);
      }
    });
  }
}

/**
 * Detect if a printer backend type indicates a legacy printer
 */
function isLegacyBackendType(backendType: string): boolean {
  // Legacy printers use GenericLegacyBackend
  return backendType.toLowerCase().includes('legacy') || 
         backendType.toLowerCase().includes('generic');
}

// ============================================================================
// REAL-TIME POLLING INTEGRATION
// ============================================================================

/**
 * Initialize event listeners for polling updates from main process
 */
function initializePollingListeners(): void {
  if (!window.api) {
    console.error('API not available for polling listeners');
    return;
  }
  
  // Listen for polling updates from main process
  window.api.receive('polling-update', (data: unknown) => {
    const pollingData = data as PollingData;
    
    try {
      // Update filtration availability from backend data
      if (pollingData.printerStatus && pollingData.printerStatus.filtration) {
        const newFiltrationAvailable = pollingData.printerStatus.filtration.available;
        if (newFiltrationAvailable !== filtrationAvailable) {
          filtrationAvailable = newFiltrationAvailable;
          logMessage(`Filtration ${filtrationAvailable ? 'available' : 'not available'} on this printer`);
          updateFiltrationButtonStates();
        }
      }
      
      // Update IFS button visibility for AD5X printers with material station
      if (pollingData.materialStation && pollingData.isConnected) {
        const shouldShowIFS = pollingData.materialStation.connected;
        if (shouldShowIFS !== ifsButtonVisible) {
          ifsButtonVisible = shouldShowIFS;
          updateIFSButtonVisibility();

        }
      } else if (ifsButtonVisible) {
        // Hide IFS button when disconnected or no material station
        ifsButtonVisible = false;
        updateIFSButtonVisibility();
      }
      
      // Update all UI panels with new data
      updateAllPanels(pollingData);
      
      // Update state tracker based on printer status
      const stateTracker = getGlobalStateTracker();
      if (pollingData.printerStatus && pollingData.isConnected) {
        stateTracker.setState(pollingData.printerStatus.state, 'polling update');
      } else if (!pollingData.isConnected) {
        stateTracker.onDisconnected();
      }
      
    } catch (error) {
      handleUIError(error, 'polling update');
    }
  });
  
  console.log('Polling listeners initialized - waiting for updates from main process');

}

/**
 * Initialize state tracking and backend event listeners
 */
function initializeStateAndEventListeners(): void {
  const stateTracker = getGlobalStateTracker();
  
  // Set up state change listeners
  stateTracker.on(STATE_EVENTS.CHANGED, (event: StateChangeEvent) => {
    console.log('Printer state changed:', event.previousState, '→', event.currentState);

    updateButtonStates(event.currentState);
  });
  
  stateTracker.on(STATE_EVENTS.CONNECTED, () => {
    console.log('Printer connected');

  });
  
  stateTracker.on(STATE_EVENTS.DISCONNECTED, () => {
    console.log('Printer disconnected');
    logMessage('Printer disconnected');
    resetUI();
    
    // Reset filtration availability on disconnect
    filtrationAvailable = false;
    updateFiltrationButtonStates();
    
    // Reset IFS button visibility on disconnect
    ifsButtonVisible = false;
    updateIFSButtonVisibility();
    
    // Reset legacy printer flag on disconnect
    isLegacyPrinter = false;
    updateLegacyPrinterButtonStates();
    console.log('[LegacyUI] Reset legacy printer flag on state disconnect');
  });
  
  // Listen for backend events
  if (window.api) {
    window.api.receive('backend-initialized', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; printerName: string; modelType: string; backendType?: string; timestamp: string };
      console.log('Backend initialized:', data);
      logMessage(`Backend ready for ${data.printerName} (${data.modelType})`);
      
      // Detect legacy printer based on backend type or model type
      const backendType = data.backendType || data.modelType || '';
      isLegacyPrinter = isLegacyBackendType(backendType);
      
      if (isLegacyPrinter) {
        console.log('[LegacyUI] Legacy printer detected:', backendType);
        logMessage('Legacy printer detected - some features will be disabled');
      } else {
        console.log('[LegacyUI] Modern printer detected:', backendType);
      }
      
      // Update button states for legacy printer compatibility
      updateLegacyPrinterButtonStates();
    });
    
    window.api.receive('backend-initialization-failed', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; error: string; printerName: string; timestamp: string };
      console.error('Backend initialization failed:', data);
      logMessage(`Backend initialization failed for ${data.printerName}: ${data.error}`);
    });
    
    window.api.receive('backend-disposed', (...args: unknown[]) => {
      const data = args[0] as { timestamp: string };
      console.log('Backend disposed:', data);
      logMessage('Backend disconnected');
      
      // Reset legacy printer flag on disconnect
      isLegacyPrinter = false;
      console.log('[LegacyUI] Reset legacy printer flag on disconnect');
      
      resetUI();
    });
    
    // Handle log messages from main process
    window.api.receive('log-message', (...args: unknown[]) => {
      const message = args[0] as string;
      logMessage(message);
    });
    
    window.api.receive('printer-connected', (...args: unknown[]) => {
      const data = args[0] as { name: string; ipAddress: string; serialNumber: string; clientType: string };
      console.log('Printer connected event:', data);
      stateTracker.onConnected();
    });
  }
  
  console.log('State tracking and event listeners initialized');
}

// DOM Content Loaded handler
document.addEventListener('DOMContentLoaded', () => {
  console.log('Renderer process started - DOM loaded');
  
  // Check if window.api is available
  if (!window.api) {
    console.error('API is not available. Preload script might not be loaded correctly.');
    logMessage('ERROR: API not available - some features may not work');
  } else {

    
    // Set up IPC listeners for connection state changes (when properly configured)
    // TODO: Implement proper IPC listeners when API interface is updated
    console.log('IPC listeners would be set up here');
  }
  
  // Setup UI components
  setupWindowControls();
  setupBasicButtons();
  setupLoadingEventListeners();
  initializeUI();
  
  // Initialize state tracking and event listeners
  initializeStateAndEventListeners();
  
  // Initialize polling update listeners
  initializePollingListeners();
  
  // Signal to main process that renderer is fully ready
  if (window.api) {
    window.api.invoke('renderer-ready').then(() => {
      console.log('Renderer ready signal sent - auto-connect will start');
    }).catch((error: unknown) => {
      console.error('Failed to send renderer-ready signal:', error);
    });
  } else {
    console.error('API not available - cannot send renderer-ready signal');
  }
  
  console.log('Renderer initialization complete');
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  console.log('Cleaning up resources in renderer');
  
  // Clean up state tracker
  const stateTracker = getGlobalStateTracker();
  stateTracker.dispose();
  
  // Clean up IPC listeners
  if (window.api) {
    window.api.removeAllListeners();
  }
  
  console.log('Renderer cleanup complete');
});
