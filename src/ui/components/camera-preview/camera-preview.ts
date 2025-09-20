/**
 * @fileoverview Camera Preview with Integrated Job Info Component
 * 
 * This component handles the display and management of camera preview streams
 * from FlashForge 3D printers while integrating job information display at the bottom.
 * It provides a seamless visual unit that fills the left side properly, combining
 * camera functionality with real-time job progress information.
 * 
 * Key features:
 * - MJPEG camera stream display with proper cleanup
 * - Integrated job information panel at the bottom
 * - Camera preview toggle button within the component
 * - Real-time job progress updates via polling system
 * - Progress bar styling based on printer state
 * - Camera configuration resolution via window.api.camera
 * - State management for disabled/loading/streaming/error states
 * - Proper image element lifecycle management
 * - Integration with camera proxy service
 * 
 * The component creates one cohesive visual unit that matches the original
 * seamless design where camera and job info were integrated together.
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { ResolvedCameraConfig } from '../../../types/camera/camera.types';
import type { PollingData, PrinterState, CurrentJobInfo } from '../../../types/polling';
import './camera-preview.css';

/**
 * Camera preview states for visual feedback
 */
type CameraState = 'disabled' | 'loading' | 'streaming' | 'error';

/**
 * Camera preview component that displays MJPEG streams from printers
 * Handles camera configuration, proxy integration, and stream lifecycle
 */
export class CameraPreviewComponent extends BaseComponent {
  /** Component identifier */
  readonly componentId = 'camera-preview';

  /** HTML template content - integrated camera and job info */
  readonly templateHTML = `
    <div class="camera-stream-area">
      <div class="camera-view">
        <div class="no-camera">Preview Disabled</div>
      </div>
    </div>
    <div class="job-info-overlay">
      <div class="job-row">
        <span>Current Job:</span>
        <span id="current-job">No active job</span>
      </div>
      <div class="progress-row">
        <span>Progress:</span>
        <span id="progress-percentage">0%</span>
      </div>
      <progress id="progress-bar" value="0" max="100"></progress>
      <div class="camera-controls">
        <button id="btn-preview">Preview On</button>
      </div>
    </div>
  `;

  /** Current preview enabled state */
  private previewEnabled = false;

  /** Current camera stream element */
  private cameraStreamElement: HTMLImageElement | null = null;

  /** Current camera state for visual feedback */
  private currentState: CameraState = 'disabled';

  /** Currently displayed job info for change detection */
  private currentJobInfo: CurrentJobInfo | null = null;

  /** Current printer state for progress bar styling */
  private currentPrinterState: PrinterState | null = null;

  /**
   * Initialize component and set up initial state
   */
  protected async onInitialized(): Promise<void> {
    this.updateComponentState('disabled');
    console.log('Camera preview component initialized');
  }

  /**
   * Set up event listeners for the integrated component
   * Includes camera preview toggle button
   */
  protected async setupEventListeners(): Promise<void> {
    const previewButton = this.findElementById<HTMLButtonElement>('btn-preview');
    
    if (previewButton) {
      this.addEventListener(previewButton, 'click', this.handleCameraPreviewToggle.bind(this));
    } else {
      console.warn('Camera Preview: Preview button not found during setup');
    }
  }

  /**
   * Update component with new polling data
   * Updates job information, progress, and progress bar state styling
   */
  update(data: ComponentUpdateData): void {
    this.updateState(data);

    if (!data.pollingData) {
      return;
    }

    const pollingData = data.pollingData as PollingData;
    const printerStatus = pollingData.printerStatus;

    if (!printerStatus) {
      // No printer connected - clear job display
      this.updateJobDisplay(null);
      this.currentPrinterState = null;
      this.updateProgressBarState('Ready');
      return;
    }

    // Update job information if available
    const jobInfo = printerStatus.currentJob;
    this.updateJobDisplay(jobInfo);

    // Update printer state and progress bar styling
    if (this.currentPrinterState !== printerStatus.state) {
      this.currentPrinterState = printerStatus.state;
      this.updateProgressBarState(printerStatus.state);
    }
  }

  /**
   * Handle camera preview toggle button click (internal event handler)
   * Integrated version of the toggle functionality
   */
  private async handleCameraPreviewToggle(event: Event): Promise<void> {
    this.assertInitialized();

    const button = event.target as HTMLButtonElement;
    if (!button) {
      console.error('Camera Preview: Invalid button element in camera toggle');
      return;
    }

    await this.togglePreview(button);
  }

  /**
   * Toggle camera preview on/off
   * This method can be called internally or externally
   * @param button - The button element that triggered the toggle (for state updates)
   */
  async togglePreview(button: HTMLElement): Promise<void> {
    this.assertInitialized();
    
    const cameraView = this.findElement('.camera-view');
    
    if (!cameraView || !window.api?.camera) {
      console.error('Camera view or API not available');
      return;
    }

    try {
      // Toggle preview state
      this.previewEnabled = !this.previewEnabled;
      button.textContent = this.previewEnabled ? 'Loading...' : 'Preview Off';

      if (this.previewEnabled) {
        await this.enableCameraPreview(button, cameraView);
      } else {
        await this.disableCameraPreview(button, cameraView);
      }

    } catch (error) {
      console.error('Camera toggle failed:', error);
      this.handleCameraError(button, cameraView, 'Camera error');
    }
  }

  /**
   * Enable camera preview - check configuration and start stream
   */
  private async enableCameraPreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
    this.updateComponentState('loading');

    // Check camera availability
    const cameraConfigRaw = await window.api.camera.getConfig();
    const cameraConfig = cameraConfigRaw as ResolvedCameraConfig | null;

    if (!cameraConfig) {
      this.handleCameraError(button, cameraView, 'Please connect to a printer first');
      return;
    }

    if (!cameraConfig.isAvailable) {
      const reason = cameraConfig.unavailableReason || 'Camera not available';
      this.handleCameraError(button, cameraView, reason);
      
      // Show helpful message based on reason
      if (reason.includes('does not have a built-in camera')) {
        console.log('Enable custom camera in settings to use an external camera');
      } else if (reason.includes('URL')) {
        console.log('Please configure camera URL in settings');
      }
      return;
    }

    // Camera is available - get proxy URL and show stream
    const proxyUrl = await window.api.camera.getProxyUrl();
    const streamUrl = `${proxyUrl}`; // The proxy URL already includes /camera

    console.log(`Enabling camera preview from: ${cameraConfig.sourceType} camera`);

    // Create and setup stream
    this.createCameraStream(streamUrl, cameraView);
    
    // Update button state
    button.textContent = 'Preview Off';
    this.updateComponentState('streaming');
  }

  /**
   * Disable camera preview - clean up stream and reset UI
   */
  private async disableCameraPreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
    console.log('Disabling camera preview');

    // Clean up stream
    this.cleanupCameraStream();

    // Restore the no-camera message
    cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';

    // Update button and state
    button.textContent = 'Preview On';
    this.updateComponentState('disabled');

    // Notify backend that preview is disabled
    await window.api.camera.setEnabled(false);
  }

  /**
   * Create and setup camera stream image element
   */
  private createCameraStream(streamUrl: string, cameraView: HTMLElement): void {
    // Clear existing content
    cameraView.innerHTML = '';

    // Create image element for MJPEG stream
    this.cameraStreamElement = document.createElement('img');
    this.cameraStreamElement.src = streamUrl;
    this.cameraStreamElement.style.width = '100%';
    this.cameraStreamElement.style.height = '100%';
    this.cameraStreamElement.style.objectFit = 'cover';
    this.cameraStreamElement.alt = 'Camera Stream';

    // Handle stream errors
    this.cameraStreamElement.onerror = () => {
      console.log('Camera stream error - attempting to restore...');
      // Try to restore the stream
      void window.api.camera.restoreStream().then(restored => {
        if (!restored && cameraView) {
          cameraView.innerHTML = '<div class="no-camera">Camera stream error</div>';
          this.updateComponentState('error');
        }
      });
    };

    // Handle successful load
    this.cameraStreamElement.onload = () => {
      console.log('Camera stream connected successfully');
      this.updateComponentState('streaming');
    };

    cameraView.appendChild(this.cameraStreamElement);
  }

  /**
   * Clean up camera stream element
   */
  private cleanupCameraStream(): void {
    if (this.cameraStreamElement) {
      // Remove event handlers to prevent false error events
      this.cameraStreamElement.onerror = null;
      this.cameraStreamElement.onload = null;

      // Clear the source to stop the stream
      this.cameraStreamElement.src = '';
      this.cameraStreamElement = null;
    }
  }

  /**
   * Handle camera errors by updating UI and state
   */
  private handleCameraError(button: HTMLElement, cameraView: HTMLElement, message: string): void {
    this.previewEnabled = false;
    button.textContent = 'Preview On';
    cameraView.innerHTML = `<div class="no-camera">${message}</div>`;
    this.updateComponentState('error');
    console.log(`Camera error: ${message}`);
  }

  /**
   * Update component visual state
   */
  private updateComponentState(state: CameraState): void {
    if (!this.container) return;

    // Remove all state classes
    this.container.classList.remove('state-disabled', 'state-loading', 'state-streaming', 'state-error');
    
    // Add current state class
    this.container.classList.add(`state-${state}`);
    
    this.currentState = state;
  }

  /**
   * Update job display with current job information
   * Handles job name display and progress updates
   */
  private updateJobDisplay(jobInfo: CurrentJobInfo | null): void {
    const currentJobElement = this.findElementById('current-job');
    const progressPercentageElement = this.findElementById('progress-percentage');
    const progressBarElement = this.findElementById<HTMLProgressElement>('progress-bar');

    if (!currentJobElement || !progressPercentageElement || !progressBarElement) {
      console.warn('Camera Preview: Required elements not found for job display update');
      return;
    }

    if (!jobInfo || !jobInfo.isActive) {
      // No active job - clear display
      this.setElementText(currentJobElement, 'No active job');
      this.setElementText(progressPercentageElement, '0%');
      this.setElementAttribute(progressBarElement, 'value', '0');
      this.currentJobInfo = null;
      return;
    }

    // Display job name - prefer displayName over fileName
    const jobName = jobInfo.displayName || jobInfo.fileName;
    if (jobName !== this.currentJobInfo?.displayName && jobName !== this.currentJobInfo?.fileName) {
      this.setElementText(currentJobElement, jobName);
    }

    // Update progress percentage and bar
    const progressValue = Math.round(jobInfo.progress.percentage);
    this.setElementText(progressPercentageElement, `${progressValue}%`);
    this.setElementAttribute(progressBarElement, 'value', progressValue.toString());

    this.currentJobInfo = jobInfo;
  }

  /**
   * Update progress bar visual state based on printer state
   * Applies appropriate CSS classes for visual feedback
   */
  private updateProgressBarState(printerState: PrinterState): void {
    const progressBarElement = this.findElementById<HTMLProgressElement>('progress-bar');
    
    if (!progressBarElement) {
      return;
    }

    // Remove all state classes
    progressBarElement.classList.remove('printing', 'paused', 'completed', 'error');

    // Apply state-specific class for visual styling
    switch (printerState) {
      case 'Printing':
      case 'Heating':
      case 'Calibrating':
        this.addElementClass(progressBarElement, 'printing');
        break;
        
      case 'Paused':
      case 'Pausing':
        this.addElementClass(progressBarElement, 'paused');
        break;
        
      case 'Completed':
        this.addElementClass(progressBarElement, 'completed');
        break;
        
      case 'Error':
      case 'Cancelled':
        this.addElementClass(progressBarElement, 'error');
        break;
        
      default:
        // Ready, Busy, etc. - use default styling (no additional class)
        break;
    }
  }

  /**
   * Get current preview state
   */
  public isPreviewEnabled(): boolean {
    return this.previewEnabled;
  }

  /**
   * Get current camera state
   */
  public getCurrentState(): CameraState {
    return this.currentState;
  }

  /**
   * Get current job information
   * @returns Current job info or null if no active job
   */
  public getCurrentJobInfo(): CurrentJobInfo | null {
    return this.currentJobInfo;
  }

  /**
   * Get current printer state
   * @returns Current printer state or null if not connected
   */
  public getCurrentPrinterState(): PrinterState | null {
    return this.currentPrinterState;
  }

  /**
   * Check if there is an active job
   * @returns True if there is an active job being displayed
   */
  public hasActiveJob(): boolean {
    return this.currentJobInfo !== null && this.currentJobInfo.isActive;
  }

  /**
   * Component cleanup - stop stream and remove elements
   */
  protected cleanup(): void {
    console.log('Cleaning up camera preview component');
    
    // Clean up camera stream
    this.cleanupCameraStream();
    
    // Reset camera state
    this.previewEnabled = false;
    this.currentState = 'disabled';
    
    // Reset job info state
    this.currentJobInfo = null;
    this.currentPrinterState = null;
  }
}