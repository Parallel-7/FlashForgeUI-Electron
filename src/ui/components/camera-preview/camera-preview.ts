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
import type { JSMpegPlayerInstance, JSMpegStatic } from '../../../types/jsmpeg';
import './camera-preview.css';

// Import JSMpeg library (no official types available)
const JSMpeg: JSMpegStatic = require('@cycjimmy/jsmpeg-player') as JSMpegStatic;

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

  /** Current camera stream element (img for MJPEG, canvas for RTSP) */
  private cameraStreamElement: HTMLImageElement | HTMLCanvasElement | null = null;

  /** JSMpeg player instance for RTSP streams */
  private jsmpegPlayer: JSMpegPlayerInstance | null = null;

  /** Current camera state for visual feedback */
  private currentState: CameraState = 'disabled';

  /** Currently displayed job info for change detection */
  private currentJobInfo: CurrentJobInfo | null = null;

  /** Current printer state for progress bar styling */
  private currentPrinterState: PrinterState | null = null;

  /** Heartbeat interval identifier */
  private heartbeatIntervalId: number | null = null;

  /** Timestamp when the last MJPEG frame rendered */
  private lastFrameTimestamp: number | null = null;

  /** True while a watchdog restart is in progress */
  private isRestartingStream = false;

  /** Heartbeat cadence and timeout thresholds */
  private readonly heartbeatCheckIntervalMs = 5000;
  private readonly heartbeatTimeoutMs = 10000;

  /** Reference to remove the global visibility listener */
  private readonly visibilityChangeHandler: () => void;

  constructor(parentElement: HTMLElement) {
    super(parentElement);
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
  }

  /**
   * Initialize component and set up initial state
   */
  protected async onInitialized(): Promise<void> {
    this.updateComponentState('disabled');
    console.log('Camera preview component initialized');
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Set up event listeners for the integrated component
   * Includes camera preview toggle button and context switching
   */
  protected async setupEventListeners(): Promise<void> {
    const previewButton = this.findElementById<HTMLButtonElement>('btn-preview');

    if (previewButton) {
      this.addEventListener(previewButton, 'click', this.handleCameraPreviewToggle.bind(this));
    } else {
      console.warn('Camera Preview: Preview button not found during setup');
    }

    // Listen for context switches to reload camera for new printer
    window.api.receive('printer-context-switched', (...args: unknown[]) => {
      const event = args[0] as { contextId: string };
      void this.handleContextSwitch(event.contextId);
    });
  }

  /**
   * Handle context switch - reload camera stream for new printer
   */
  private async handleContextSwitch(contextId: string): Promise<void> {
    console.log(`[CameraPreview] Context switched to ${contextId}`);

    const button = this.findElementById<HTMLButtonElement>('btn-preview');
    const cameraView = this.findElement('.camera-view');
    if (!button || !cameraView) return;

    // If preview is enabled, reload it for the new context
    if (this.previewEnabled) {
      // Disable current preview
      await this.disableCameraPreview(button, cameraView);

      // Re-enable for new context
      await this.enableCameraPreview(button, cameraView);
    } else {
      // If preview is disabled, clear any stale image and show "Preview Disabled" state
      this.cleanupCameraStream();
      cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';
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

    console.log('[CameraPreview] Enabling camera preview...');

    // Check camera availability
    console.log('[CameraPreview] Calling window.api.camera.getConfig()...');
    const cameraConfigRaw = await window.api.camera.getConfig();
    console.log('[CameraPreview] Got camera config:', cameraConfigRaw);
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

    console.log(`Enabling camera preview from: ${cameraConfig.sourceType} camera (${cameraConfig.streamType})`);

    // Handle based on stream type
    if (cameraConfig.streamType === 'rtsp') {
      // RTSP: Use node-rtsp-stream WebSocket + JSMpeg player
      console.log('[CameraPreview] Setting up RTSP stream (node-rtsp-stream + JSMpeg)');

      // Get the RTSP stream WebSocket URL from backend
      const rtspStreamInfo = await window.api.invoke('camera:get-rtsp-relay-info') as { wsUrl: string } | null;

      if (!rtspStreamInfo || !rtspStreamInfo.wsUrl) {
        this.handleCameraError(button, cameraView, 'RTSP stream not available');
        return;
      }

      console.log('[CameraPreview] RTSP stream WebSocket URL:', rtspStreamInfo.wsUrl);
      this.createRtspStream(rtspStreamInfo.wsUrl, cameraView);
      this.stopHeartbeat();
      this.lastFrameTimestamp = null;
    } else {
      // MJPEG: Use proxy URL
      console.log('[CameraPreview] Calling window.api.camera.getProxyUrl()...');
      const proxyUrl = await window.api.camera.getProxyUrl();
      console.log('[CameraPreview] Got proxy URL:', proxyUrl);
      const streamUrl = `${proxyUrl}`; // The proxy URL already includes /camera
      console.log('[CameraPreview] Final stream URL:', streamUrl);
      this.createMjpegStream(streamUrl, cameraView);
    }

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
    this.stopHeartbeat();
    this.lastFrameTimestamp = null;

    // Restore the no-camera message
    cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';

    // Update button and state
    button.textContent = 'Preview On';
    this.updateComponentState('disabled');

    // Notify backend that preview is disabled
    await window.api.camera.setEnabled(false);
  }

  /**
   * Create and setup MJPEG camera stream using img element
   */
  private createMjpegStream(streamUrl: string, cameraView: HTMLElement): void {
    // Clear existing content
    cameraView.innerHTML = '';

    // Create image element for MJPEG stream
    const imgElement = document.createElement('img');
    imgElement.src = streamUrl;
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'cover';
    imgElement.alt = 'Camera Stream';

    imgElement.onload = () => {
      this.lastFrameTimestamp = Date.now();
      this.updateComponentState('streaming');
    };

    imgElement.onerror = () => {
      console.error('MJPEG stream failed to load');
      this.updateComponentState('error');
      if (this.previewEnabled) {
        void this.restartMjpegStream('img-error');
      }
    };

    // Add to view
    cameraView.appendChild(imgElement);
    this.cameraStreamElement = imgElement;
    this.lastFrameTimestamp = Date.now();
    this.startHeartbeat();
  }

  /**
   * Create and setup RTSP camera stream using JSMpeg + node-rtsp-stream
   */
  private createRtspStream(wsUrl: string, cameraView: HTMLElement): void {
    // Clear existing content
    cameraView.innerHTML = '';

    // Create canvas element for JSMpeg player
    const canvasElement = document.createElement('canvas');
    canvasElement.id = 'rtsp-canvas';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';
    canvasElement.style.objectFit = 'cover';

    // Add to view first so JSMpeg can access it
    cameraView.appendChild(canvasElement);
    this.cameraStreamElement = canvasElement;

    try {
      // Initialize JSMpeg player with WebSocket URL from node-rtsp-stream
      this.jsmpegPlayer = new JSMpeg.Player(wsUrl, {
        canvas: canvasElement,
        autoplay: true,
        audio: false,
        // Optional callbacks
        onSourceCompleted: () => {
          console.log('[CameraPreview] RTSP stream completed');
        },
        onSourceEstablished: () => {
          console.log('[CameraPreview] RTSP stream established');
          this.updateComponentState('streaming');
        },
      });

      console.log('[CameraPreview] JSMpeg player initialized for RTSP stream');
    } catch (error) {
      console.error('[CameraPreview] Failed to initialize JSMpeg player:', error);
      this.updateComponentState('error');
    }
  }

  /**
   * Clean up camera stream element (handles img, canvas, and JSMpeg player)
   */
  private cleanupCameraStream(): void {
    // Clean up JSMpeg player if it exists
    if (this.jsmpegPlayer) {
      try {
        // The player is already typed as JSMpegPlayerInstance | null
        this.jsmpegPlayer.destroy();
        console.log('[CameraPreview] JSMpeg player destroyed');
      } catch (error) {
        console.warn('[CameraPreview] Error destroying JSMpeg player:', error);
      }
      this.jsmpegPlayer = null;
    }

    if (this.cameraStreamElement) {
      // Remove event handlers to prevent false error events
      if (this.cameraStreamElement instanceof HTMLImageElement) {
        this.cameraStreamElement.onerror = null;
        this.cameraStreamElement.onload = null;
        this.cameraStreamElement.src = '';
      }
      // Canvas elements don't need special cleanup beyond JSMpeg player

      this.cameraStreamElement = null;
    }

    this.lastFrameTimestamp = null;
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
   * Restart the MJPEG stream when a heartbeat or visibility change detects a stall
   */
  private async restartMjpegStream(reason: string): Promise<void> {
    if (this.isRestartingStream || !this.previewEnabled) {
      return;
    }

    const cameraView = this.findElement('.camera-view');
    if (!cameraView) {
      return;
    }

    const button = this.findElementById<HTMLButtonElement>('btn-preview');
    const originalText = button?.textContent;

    console.warn(`[CameraPreview] Restarting MJPEG stream (${reason})`);
    this.isRestartingStream = true;
    this.updateComponentState('loading');
    if (button) {
      button.textContent = 'Loading...';
    }

    try {
      this.cleanupCameraStream();

      const restored = await window.api.camera.restoreStream();
      if (!restored) {
        console.warn('[CameraPreview] Camera proxy was not restarted by backend');
      }

      const proxyUrl = await window.api.camera.getProxyUrl();
      this.createMjpegStream(proxyUrl, cameraView);
      if (button) {
        button.textContent = 'Preview Off';
      }
      this.updateComponentState('streaming');
    } catch (error) {
      console.error('[CameraPreview] Failed to restart MJPEG stream:', error);
      if (button && originalText) {
        button.textContent = originalText;
      }
      this.updateComponentState('error');
    } finally {
      this.isRestartingStream = false;
    }
  }

  /**
   * Start heartbeat interval to monitor MJPEG freshness
   */
  private startHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      return;
    }

    this.heartbeatIntervalId = window.setInterval(() => {
      if (document.hidden || !this.previewEnabled || this.isRestartingStream) {
        return;
      }

      if (!this.lastFrameTimestamp) {
        return;
      }

      const elapsed = Date.now() - this.lastFrameTimestamp;
      if (elapsed >= this.heartbeatTimeoutMs) {
        void this.restartMjpegStream('heartbeat-timeout');
      }
    }, this.heartbeatCheckIntervalMs);
  }

  /**
   * Stop the heartbeat when the preview is disabled
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * When the window regains focus, ensure the MJPEG stream is still alive
   */
  private handleVisibilityChange(): void {
    if (document.hidden || !this.previewEnabled || this.isRestartingStream) {
      return;
    }

    if (!this.lastFrameTimestamp) {
      return;
    }

    const elapsed = Date.now() - this.lastFrameTimestamp;
    if (elapsed >= this.heartbeatTimeoutMs) {
      void this.restartMjpegStream('visibility-change');
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
    
    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.lastFrameTimestamp = null;
    this.isRestartingStream = false;

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
