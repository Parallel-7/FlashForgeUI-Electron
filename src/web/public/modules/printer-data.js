// src/web/public/modules/printer-data.js

/**
 * Printer Data Module
 * Handles printer status updates, temperature displays, and job information
 */
class PrinterDataManager {
  constructor(domManager, uiUtils) {
    this.dom = domManager;
    this.ui = uiUtils;
    this.clientType = null;
    this.currentPreviewJobName = null;
    this.currentModelPreviewId = 0;
  }

  /**
   * Process incoming printer data
   * @param {Object} data Printer data from server
   * @param {Function} requestThumbnail Function to request thumbnails
   */
  handlePrinterData(data, requestThumbnail) {
    const info = data?.printerInfo;
    if (!info) return;

    // Store client type globally
    this.clientType = data.clientType;
    window.clientType = data.clientType;

    // Update all printer information
    this.updatePrinterStatus(info, data.machineState, data.clientType);
    this.updateTemperatures(info);
    this.updateJobInfo(info, requestThumbnail);

    // Provide / Update camera stream URL
    const newStreamUrl = info.CameraStreamUrl;
    if (newStreamUrl !== window.cameraStreamUrl) {
      window.cameraStreamUrl = newStreamUrl;
    }
  }

  /**
   * Update printer status display
   * @param {Object} info Printer information
   * @param {string} machineState Machine state
   * @param {string} clientType Client type (legacy/fivem)
   */
  updatePrinterStatus(info, machineState, clientType) {
    // Use a more robust status determination with proper fallback
    const status = info.Status || machineState || 'Unknown';
    this.dom.updateText('printerStatus', status);
    console.log('Printer status update:', { status: info.Status, machineState });

    // Update runtime and filament usage
    if (info.FormattedTotalRunTime) {
      this.dom.updateText('runTime', info.FormattedTotalRunTime);
    }

    if (info.CumulativeFilament) {
      this.dom.updateText('filamentUsed', this.ui.formatFilament(info.CumulativeFilament));
    }

    // Update fan speeds
    this.updateFanSpeeds(info);

    // Update filtration status
    this.updateFiltrationStatus(info);

    // Update TVOC level
    this.dom.updateText('tvocLevel', info.Tvoc !== undefined ? info.Tvoc : '0');

    // Update printer specifications
    this.updatePrinterSpecs(info);

    // Show/hide features based on client type
    this.toggleFeatureVisibility(clientType);
  }

  /**
   * Update fan speed displays
   * @param {Object} info Printer information
   */
  updateFanSpeeds(info) {
    const elements = this.dom.getElements();
    
    if (elements.coolingFanSpan && info.CoolingFanSpeed) {
      elements.coolingFanSpan.textContent = info.CoolingFanSpeed;
    }
    
    if (elements.chamberFanSpan && info.ChamberFanSpeed) {
      elements.chamberFanSpan.textContent = info.ChamberFanSpeed;
    }
  }

  /**
   * Update filtration status display
   * @param {Object} info Printer information
   */
  updateFiltrationStatus(info) {
    const filtrationState = info.FiltrationState !== undefined ? info.FiltrationState : info.Filtration;
    const internalFanOn = info.InternalFanOn;
    const externalFanOn = info.ExternalFanOn;

    let filtrationStatus = 'None';

    if (filtrationState !== undefined) {
      if (filtrationState === 1 || filtrationState === 'Internal') {
        filtrationStatus = 'Internal';
      } else if (filtrationState === 2 || filtrationState === 'External') {
        filtrationStatus = 'External';
      }
    } else if (internalFanOn || externalFanOn) {
      if (internalFanOn && externalFanOn) {
        filtrationStatus = 'Both';
      } else if (internalFanOn) {
        filtrationStatus = 'Internal';
      } else if (externalFanOn) {
        filtrationStatus = 'External';
      }
    }

    this.dom.updateText('filtrationStatus', filtrationStatus);
    console.log('Updated filtration status to:', filtrationStatus);
  }

  /**
   * Update printer specifications display
   * @param {Object} info Printer information
   */
  updatePrinterSpecs(info) {
    if (info.NozzleSize) {
      this.dom.updateText('nozzleSize', this.ui.formatNozzleSize(info.NozzleSize));
    }

    if (info.FilamentType) {
      this.dom.updateText('filamentType', info.FilamentType);
    }

    // Speed offset (multiple possible field names)
    const speedOffset = info.SpeedMultiplier || info.PrintSpeedAdjust;
    if (speedOffset) {
      this.dom.updateText('speedOffset', speedOffset);
    }

    // Z offset (multiple possible field names)
    const zOffset = info.ZOffset || info.ZAxisCompensation;
    if (zOffset !== undefined) {
      const formattedOffset = typeof zOffset === 'number' ? zOffset.toFixed(3) : zOffset;
      this.dom.updateText('zOffset', formattedOffset);
    }
  }

  /**
   * Toggle feature visibility based on client type
   * @param {string} clientType Client type (legacy/fivem)
   */
  toggleFeatureVisibility(clientType) {
    const isLegacy = clientType === 'legacy';
    
    this.dom.toggleVisibility('filtrationSection', !isLegacy);
    this.dom.toggleVisibility('printerInfoSection', !isLegacy);
    this.dom.toggleVisibility('coolingFan', !isLegacy);
    this.dom.toggleVisibility('chamberFan', !isLegacy);
    this.dom.toggleVisibility('clearStatusBtn', !isLegacy);
  }

  /**
   * Update temperature displays
   * @param {Object} info Printer information
   */
  updateTemperatures(info) {
    // Bed temperature
    const bedTempFormatted = this.ui.formatTemperature(
      info.PrintBed,
      { current: info.BedTemp, target: info.BedTargetTemp }
    );
    this.dom.updateText('bedTemp', bedTempFormatted);

    // Extruder temperature
    const extruderTempFormatted = this.ui.formatTemperature(
      info.Extruder,
      { current: info.ExtruderTemp, target: info.ExtruderTargetTemp }
    );
    this.dom.updateText('extruderTemp', extruderTempFormatted);
  }

  /**
   * Update job information display
   * @param {Object} info Printer information
   * @param {Function} requestThumbnail Function to request thumbnails
   */
  updateJobInfo(info, requestThumbnail) {
    const jobName = info.PrintFileName || info.JobName || 'No active job';
    this.dom.updateText('currentJob', jobName);

    // Update progress
    const progress = info.PrintProgressInt || 0;
    this.dom.updateText('progressPercentage', `${progress}%`);
    this.dom.setAttribute('progressBar', 'value', progress);

    // Update layer information
    const currentLayer = info.CurrentPrintLayer || 0;
    const totalLayers = info.TotalPrintLayers || 0;
    this.dom.updateText('layerInfo', `${currentLayer} / ${totalLayers}`);

    // Update timing information
    this.dom.updateText('eta', this.ui.formatETA(info.PrintEta));
    this.dom.updateText('jobTime', info.FormattedRunTime || '00:00');

    // Update material information
    this.dom.updateText('weight', this.ui.formatWeight(info.EstWeight));
    this.dom.updateText('length', this.ui.formatLength(info.EstLength));

    // Handle model preview
    this.handleModelPreview(jobName, requestThumbnail);
  }

  /**
   * Handle model preview requests
   * @param {string} jobName Current job name
   * @param {Function} requestThumbnail Function to request thumbnails
   */
  handleModelPreview(jobName, requestThumbnail) {
    if (jobName !== 'No active job') {
      if (this.currentPreviewJobName !== jobName) {
        this.currentPreviewJobName = jobName;
        console.log(`New job for preview: ${jobName}, client type: ${this.clientType}`);
        
        this.dom.updateHTML('modelPreview', '<span>Loading preview...</span>');
        
        if (this.clientType === 'legacy') {
          requestThumbnail.requestLegacyThumbnail(jobName);
        } else {
          requestThumbnail.requestModelPreview(jobName);
        }
      }
    } else {
      // No active job, clear preview
      if (this.currentPreviewJobName !== null) {
        this.dom.updateHTML('modelPreview', '<span>No preview available</span>');
      }
      this.currentPreviewJobName = null;
    }
  }

  /**
   * Handle printer connected event
   * @param {Object} data Connection data
   * @param {Function} sendCommand Function to send commands
   */
  handlePrinterConnected(data, sendCommand) {
    const ip = data?.ipAddress || 'unknown';
    const name = data?.name || 'Printer';

    this.ui.logMessage(`Connected to ${name} @ ${ip}`);
    this.ui.showToast(`Connected to ${name}`, 'success');
    this.ui.updateConnectionStatus(`Connected to ${name}`, true);

    // Request initial printer data
    sendCommand('request-printer-data');
  }

  /**
   * Handle printer disconnected event
   */
  handlePrinterDisconnected() {
    this.ui.logMessage('Printer disconnected');
    this.ui.showToast('Printer disconnected', 'error');
    this.ui.updateConnectionStatus('Server connected, printer disconnected', false);

    // Reset UI elements
    this.resetUI(false);
    this.dom.updateText('printerStatus', 'Disconnected');
    this.currentPreviewJobName = null;

    // Clean up camera resources (if camera manager exists)
    if (window.cameraManager) {
      window.cameraManager.cleanup();
    }
  }

  /**
   * Reset UI to default state
   * @param {boolean} preserveCompletedJob Whether to preserve completed job info
   */
  resetUI(preserveCompletedJob) {
    const printerStatus = this.dom.getElement('printerStatus')?.textContent?.toLowerCase();
    const isCompleted = printerStatus === 'completed';

    if (!preserveCompletedJob || !isCompleted) {
      this.dom.updateText('currentJob', 'No active job');
      this.dom.updateText('layerInfo', '0 / 0');
      this.dom.updateText('eta', '--:--');
      this.dom.updateText('jobTime', '00:00');
      this.dom.updateText('weight', '0g');
      this.dom.updateText('length', '0m');
      this.dom.updateHTML('modelPreview', '<span>No preview available</span>');
      this.currentPreviewJobName = null;
    }
    
    this.ui.resetUIElements();
  }

  /**
   * Handle legacy thumbnail result
   * @param {Object} message Thumbnail result message
   */
  handleLegacyThumbnailResult(message) {
    const { filename, thumbnail, error } = message;
    const currentJob = this.dom.getElement('currentJob')?.textContent;

    console.log(`Received legacy thumbnail result for: ${filename}`);
    console.log(`Current job is: ${currentJob}`);
    console.log(`Has thumbnail: ${thumbnail ? 'Yes' : 'No'}`);
    if (error) console.log(`Error: ${error}`);

    if (currentJob?.toLowerCase() !== filename.toLowerCase()) {
      console.log('Ignoring thumbnail - not for current job');
      return;
    }

    if (thumbnail) {
      console.log('Updating model preview with thumbnail image');
      this.dom.updateHTML('modelPreview', `<img src="data:image/png;base64,${thumbnail}" alt="Model Preview">`);
    } else {
      console.log('No thumbnail available, showing fallback message');
      this.dom.updateHTML('modelPreview', '<span>No preview available</span>');
    }
  }

  /**
   * Handle model preview result for modern printers
   * @param {Object} message Model preview result message
   */
  handleModelPreviewResult(message) {
    const { filename, thumbnail, error } = message;
    const currentJob = this.dom.getElement('currentJob')?.textContent;

    console.log(`Received model preview result for: ${filename}`);
    console.log(`Current job is: ${currentJob}`);
    console.log(`Has thumbnail: ${thumbnail ? 'Yes' : 'No'}`);
    if (error) console.log(`Error: ${error}`);

    if (currentJob?.toLowerCase() !== filename.toLowerCase()) {
      console.log('Ignoring model preview - not for current job');
      return;
    }

    if (thumbnail) {
      console.log('Updating model preview with modern printer thumbnail');
      this.dom.updateHTML('modelPreview', `<img src="data:image/png;base64,${thumbnail}" alt="Model Preview">`);
    } else {
      console.log('No model preview available, showing fallback message');
      this.dom.updateHTML('modelPreview', '<span>No preview available</span>');
    }
  }

  /**
   * Request legacy thumbnail
   * @param {string} filename Filename to request thumbnail for
   * @param {Function} sendCommand Function to send commands
   */
  requestLegacyThumbnail(filename, sendCommand) {
    console.log(`Requesting legacy thumbnail for: ${filename}, clientType is ${this.clientType}`);
    sendCommand('request-legacy-thumbnail', { filename });
  }

  /**
   * Request model preview for modern printers
   * @param {string} filename Filename to request preview for
   * @param {Function} sendCommand Function to send commands
   */
  requestModelPreview(filename, sendCommand) {
    console.log(`Requesting model preview for modern printer: ${filename}`);
    this.currentModelPreviewId++;
    
    sendCommand('request-model-preview', {
      filename,
      requestId: this.currentModelPreviewId
    });
  }
}

// Export for use by other modules
window.PrinterDataManager = PrinterDataManager;
