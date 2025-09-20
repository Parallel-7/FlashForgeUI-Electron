/**
 * @fileoverview Job Info Component
 * 
 * This component displays current job information including job name, progress,
 * and provides camera preview control functionality. It integrates with the
 * polling system to show real-time job progress and updates the progress bar
 * visual state based on printer status.
 * 
 * Key features:
 * - Displays current job name (displayName or fileName fallback)
 * - Shows progress percentage and visual progress bar
 * - State-based progress bar styling (printing/paused/completed/error)
 * - Camera preview toggle button functionality
 * - Communication with CameraPreviewComponent via ComponentManager
 * - Proper cleanup and error handling
 * 
 * The component receives updates through the polling system and manages
 * its own UI state while communicating with other components for camera control.
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData, PrinterState, CurrentJobInfo } from '../../../types/polling';
import { componentManager } from '../ComponentManager';
import type { CameraPreviewComponent } from '../camera-preview/camera-preview';
import './job-info.css';

/**
 * Job Info Component that displays current print job information and progress
 * Also handles camera preview toggle functionality via ComponentManager communication
 */
export class JobInfoComponent extends BaseComponent {
  /** Component identifier */
  readonly componentId = 'job-info';

  /** HTML template content - matches existing job-info.html structure */
  readonly templateHTML = `
    <div class="job-info-panel">
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

  /** Currently displayed job info for change detection */
  private currentJobInfo: CurrentJobInfo | null = null;

  /** Current printer state for progress bar styling */
  private currentPrinterState: PrinterState | null = null;

  /**
   * Initialize component and set up initial state
   */
  protected async onInitialized(): Promise<void> {
    this.updateJobDisplay(null);
    console.log('Job Info component initialized');
  }

  /**
   * Set up event listeners for camera preview button
   */
  protected async setupEventListeners(): Promise<void> {
    const previewButton = this.findElementById<HTMLButtonElement>('btn-preview');
    
    if (previewButton) {
      this.addEventListener(previewButton, 'click', this.handleCameraPreviewToggle.bind(this));
    } else {
      console.warn('Job Info: Preview button not found during setup');
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
   * Update job display with current job information
   * Handles job name display and progress updates
   */
  private updateJobDisplay(jobInfo: CurrentJobInfo | null): void {
    const currentJobElement = this.findElementById('current-job');
    const progressPercentageElement = this.findElementById('progress-percentage');
    const progressBarElement = this.findElementById<HTMLProgressElement>('progress-bar');

    if (!currentJobElement || !progressPercentageElement || !progressBarElement) {
      console.warn('Job Info: Required elements not found for job display update');
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
   * Handle camera preview toggle button click
   * Communicates with CameraPreviewComponent via ComponentManager
   */
  private async handleCameraPreviewToggle(event: Event): Promise<void> {
    this.assertInitialized();

    const button = event.target as HTMLButtonElement;
    if (!button) {
      console.error('Job Info: Invalid button element in camera toggle');
      return;
    }

    try {
      // Get camera preview component from manager
      const cameraComponent = componentManager.getComponent<CameraPreviewComponent>('camera-preview');
      
      if (!cameraComponent) {
        console.error('Job Info: Camera preview component not found in manager');
        button.textContent = 'Camera Error';
        return;
      }

      if (!cameraComponent.isInitialized()) {
        console.warn('Job Info: Camera preview component not initialized');
        button.textContent = 'Camera Not Ready';
        return;
      }

      // Toggle camera preview through the camera component
      await cameraComponent.togglePreview(button);

    } catch (error) {
      console.error('Job Info: Camera preview toggle failed:', error);
      button.textContent = 'Camera Error';
      
      // Reset button after error
      setTimeout(() => {
        button.textContent = 'Preview On';
      }, 2000);
    }
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
   * Component cleanup - reset state and clear references
   */
  protected cleanup(): void {
    console.log('Cleaning up Job Info component');
    
    // Reset component state
    this.currentJobInfo = null;
    this.currentPrinterState = null;
  }
}