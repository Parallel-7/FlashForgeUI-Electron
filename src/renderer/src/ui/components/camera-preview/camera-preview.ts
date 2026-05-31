/**
 * @fileoverview Camera Preview with Integrated Job Info Component
 *
 * This component handles the display and management of camera preview streams
 * from FlashForge 3D printers using go2rtc as the streaming gateway. It provides
 * a seamless visual unit combining camera functionality with real-time job progress.
 *
 * Key features:
 * - Unified camera streaming via go2rtc (WebRTC/MSE/MJPEG fallback)
 * - Native <video> element playback (no canvas = no rotation drift)
 * - Integrated job information panel at the bottom
 * - Camera preview toggle button within the component
 * - Real-time job progress updates via polling system
 * - Progress bar styling based on printer state
 * - Automatic reconnection built into go2rtc
 *
 * @see src/main/services/Go2rtcService.ts for the streaming gateway
 */

import { logVerbose } from '@shared/logging.js';
import type { Go2rtcCameraStreamConfig, ResolvedCameraConfig } from '@shared/types/camera/camera.types.js';
import type { PrinterContextInfo } from '@shared/types/PrinterContext.js';
import type { CurrentJobInfo, PollingData, PrinterState } from '@shared/types/polling.js';
import { VideoRTC } from '../../../lib/video-rtc.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import './camera-preview.css';

// Register the video-rtc custom element if not already registered
if (!customElements.get('video-rtc')) {
  customElements.define('video-rtc', VideoRTC);
}

const CAMERA_PREVIEW_LOG_NAMESPACE = 'CameraPreviewComponent';

/**
 * Camera preview states for visual feedback
 */
type CameraState = 'disabled' | 'loading' | 'streaming' | 'error';

/**
 * Interface for the video-rtc custom element
 */
interface VideoRTCElement extends HTMLElement {
  src: string;
  mode: string;
  media: string;
}

/**
 * Camera preview component that displays streams from printers via go2rtc
 * Handles camera configuration, stream lifecycle, and job info display
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
      <div class="fps-overlay" id="fps-overlay" hidden>Streaming</div>
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

  /** Current video-rtc element */
  private videoRtcElement: VideoRTCElement | null = null;

  /** Current camera state for visual feedback */
  private currentState: CameraState = 'disabled';

  /** Currently displayed job info for change detection */
  private currentJobInfo: CurrentJobInfo | null = null;

  /** Current printer state for progress bar styling */
  private currentPrinterState: PrinterState | null = null;

  /** Active printer context ID */
  private activeContextId: string | null = null;

  /** Reference to remove the global visibility listener */
  private readonly visibilityChangeHandler: () => void;

  /** FPS/Status overlay state */
  private showFpsOverlay = false;

  /** Frame timestamps for FPS calculation (sliding window) */
  private frameTimestamps: number[] = [];

  /** Current calculated FPS */
  private currentFps = 0;

  /** FPS update interval ID */
  private fpsUpdateIntervalId: ReturnType<typeof setInterval> | null = null;

  /** requestVideoFrameCallback ID for cleanup */
  private videoFrameCallbackId: number | null = null;

  /** MutationObserver for MJPEG poster changes */
  private posterObserver: MutationObserver | null = null;

  /** Disposer for config update listener */
  private configUpdateDisposer: (() => void) | null = null;

  /** Current stream type for FPS tracking mode selection */
  private currentStreamType: 'mjpeg' | 'rtsp' | null = null;

  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(CAMERA_PREVIEW_LOG_NAMESPACE, message, ...args);
  }

  /**
   * Load FPS overlay setting from per-printer settings
   */
  private async loadFpsOverlaySetting(): Promise<void> {
    try {
      const settings = (await window.api.invoke('printer-settings:get')) as { showCameraFps?: boolean } | null;
      this.showFpsOverlay = settings?.showCameraFps ?? false;
      this.updateFpsOverlayVisibility();
    } catch (error) {
      console.warn('[CameraPreview] Failed to load FPS overlay setting:', error);
      this.showFpsOverlay = false;
    }
  }

  /**
   * Update FPS overlay element visibility based on setting and stream state
   */
  private updateFpsOverlayVisibility(): void {
    const fpsOverlay = this.findElementById('fps-overlay');
    if (!fpsOverlay) return;

    const shouldShow = this.showFpsOverlay && this.previewEnabled && this.currentState === 'streaming';
    if (shouldShow) {
      fpsOverlay.removeAttribute('hidden');
      this.updateFpsDisplay();
    } else {
      fpsOverlay.setAttribute('hidden', '');
    }
  }

  /**
   * Update the FPS display with current calculated FPS
   */
  private updateFpsDisplay(): void {
    const fpsOverlay = this.findElementById('fps-overlay');
    if (!fpsOverlay || fpsOverlay.hasAttribute('hidden')) return;

    if (this.currentFps > 0) {
      fpsOverlay.textContent = `${this.currentFps} FPS`;
    } else {
      fpsOverlay.textContent = 'Connecting...';
    }
  }

  /**
   * Record a frame timestamp for FPS calculation
   * Uses a 1-second sliding window
   */
  private recordFrame(): void {
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only frames from the last second
    const oneSecondAgo = now - 1000;
    this.frameTimestamps = this.frameTimestamps.filter((t) => t > oneSecondAgo);
  }

  /**
   * Calculate FPS from frame timestamps
   */
  private calculateFps(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const now = performance.now();
    const oneSecondAgo = now - 1000;
    const recentFrames = this.frameTimestamps.filter((t) => t > oneSecondAgo);

    return recentFrames.length;
  }

  /**
   * Start FPS tracking for video element
   */
  private startFpsTracking(): void {
    this.stopFpsTracking();
    this.frameTimestamps = [];
    this.currentFps = 0;

    // Start periodic FPS display update
    this.fpsUpdateIntervalId = setInterval(() => {
      this.currentFps = this.calculateFps();
      this.updateFpsDisplay();
    }, 500);

    // Try to find the internal video element from video-rtc
    const videoRtc = this.videoRtcElement;
    if (!videoRtc) return;

    // Wait a bit for video-rtc to create its internal video element
    setTimeout(() => {
      const video = videoRtc.querySelector('video');
      if (video) {
        this.setupVideoFrameCallback(video);
      } else {
        // Fallback: set up observer to detect when video is added
        this.setupVideoElementObserver(videoRtc);
      }
    }, 100);
  }

  /**
   * Set up frame tracking based on stream type
   * - MJPEG: Use poster observation (video-rtc updates poster attribute)
   * - RTSP/WebRTC: Use requestVideoFrameCallback for accurate frame counting
   */
  private setupVideoFrameCallback(video: HTMLVideoElement): void {
    // For MJPEG streams, always use poster observation since video-rtc
    // updates the poster attribute rather than playing actual video frames
    if (this.currentStreamType === 'mjpeg') {
      this.setupPosterObserver(video);
      return;
    }

    // For RTSP/WebRTC streams, use requestVideoFrameCallback if available
    if ('requestVideoFrameCallback' in video) {
      const trackFrame = (): void => {
        this.recordFrame();
        // Continue tracking if still streaming
        if (this.previewEnabled && this.currentState === 'streaming') {
          this.videoFrameCallbackId = video.requestVideoFrameCallback(trackFrame);
        }
      };
      this.videoFrameCallbackId = video.requestVideoFrameCallback(trackFrame);
      this.logDebug('[FPS] Using requestVideoFrameCallback for frame tracking');
    } else {
      // Fallback: use poster observation
      this.setupPosterObserver(video);
    }
  }

  /**
   * Set up MutationObserver to detect video element creation
   */
  private setupVideoElementObserver(parent: HTMLElement): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            observer.disconnect();
            this.setupVideoFrameCallback(node);
            return;
          }
        }
      }
    });
    observer.observe(parent, { childList: true, subtree: true });

    // Clean up observer after 5 seconds if video never appears
    setTimeout(() => observer.disconnect(), 5000);
  }

  /**
   * Set up MutationObserver for MJPEG poster changes
   * Used when requestVideoFrameCallback is not available (MJPEG mode)
   */
  private setupPosterObserver(video: HTMLVideoElement): void {
    this.posterObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'poster') {
          this.recordFrame();
        }
      }
    });
    this.posterObserver.observe(video, { attributes: true, attributeFilter: ['poster'] });
    this.logDebug('[FPS] Using MutationObserver for MJPEG frame tracking');
  }

  /**
   * Stop FPS tracking and clean up resources
   */
  private stopFpsTracking(): void {
    if (this.fpsUpdateIntervalId !== null) {
      clearInterval(this.fpsUpdateIntervalId);
      this.fpsUpdateIntervalId = null;
    }

    // Note: We can't cancel requestVideoFrameCallback, but it will stop
    // when the condition check fails (previewEnabled = false)
    this.videoFrameCallbackId = null;

    if (this.posterObserver) {
      this.posterObserver.disconnect();
      this.posterObserver = null;
    }

    this.frameTimestamps = [];
    this.currentFps = 0;
  }

  constructor(parentElement: HTMLElement) {
    super(parentElement);
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
  }

  /**
   * Initialize component and set up initial state
   */
  protected async onInitialized(): Promise<void> {
    this.updateComponentState('disabled');
    this.logDebug('Camera preview component initialized (go2rtc mode)');
    await this.initializeActiveContext();
    await this.loadFpsOverlaySetting();
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Listen for config updates to reload FPS overlay setting
    this.configUpdateDisposer = window.api.config.onUpdated(() => {
      void this.loadFpsOverlaySetting();
    });
  }

  /**
   * Determine the currently active printer context
   */
  private async initializeActiveContext(): Promise<void> {
    try {
      const activeContext = (await window.api.printerContexts.getActive()) as PrinterContextInfo | null;
      this.activeContextId = activeContext && typeof activeContext.id === 'string' ? activeContext.id : null;
    } catch (error) {
      console.warn('[CameraPreview] Failed to determine active context:', error);
      this.activeContextId = null;
    }
  }

  /**
   * Set up event listeners for the integrated component
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
    this.logDebug(`[CameraPreview] Context switched to ${contextId}`);
    this.activeContextId = contextId;

    // Reload FPS overlay setting for new printer context
    await this.loadFpsOverlaySetting();

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
      // If preview is disabled, clear any stale content and show "Preview Disabled" state
      this.cleanupCameraStream();
      cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';
    }
  }

  /**
   * Update component with new polling data
   */
  update(data: ComponentUpdateData): void {
    this.updateState(data);

    if (!data.pollingData) {
      return;
    }

    const pollingData = data.pollingData as PollingData;
    const printerStatus = pollingData.printerStatus;

    if (!printerStatus) {
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
   * Handle camera preview toggle button click
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
   */
  async togglePreview(button: HTMLElement): Promise<void> {
    this.assertInitialized();

    const cameraView = this.findElement('.camera-view');

    if (!cameraView || !window.api?.camera) {
      console.error('Camera view or API not available');
      return;
    }

    try {
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
   * Enable camera preview - get go2rtc stream config and start video-rtc
   */
  private async enableCameraPreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
    this.updateComponentState('loading');

    this.logDebug('[CameraPreview] Enabling camera preview...');

    // Reload FPS overlay setting in case it changed since init
    await this.loadFpsOverlaySetting();

    if (!this.activeContextId) {
      await this.initializeActiveContext();
    }

    // Check camera availability first
    this.logDebug('[CameraPreview] Calling window.api.camera.getConfig()...');
    const cameraConfigRaw = await window.api.camera.getConfig();
    this.logDebug('[CameraPreview] Got camera config:', cameraConfigRaw);
    const cameraConfig = cameraConfigRaw as ResolvedCameraConfig | null;

    if (!cameraConfig) {
      this.handleCameraError(button, cameraView, 'Please connect to a printer first');
      return;
    }

    if (!cameraConfig.isAvailable) {
      const reason = cameraConfig.unavailableReason || 'Camera not available';
      this.handleCameraError(button, cameraView, reason);
      return;
    }

    // Get the go2rtc stream configuration
    this.logDebug('[CameraPreview] Getting go2rtc stream config...');
    const streamConfig = (await window.api.invoke('camera:get-stream-config')) as Go2rtcCameraStreamConfig | null;

    if (!streamConfig || !streamConfig.wsUrl) {
      this.handleCameraError(button, cameraView, 'Camera stream not available');
      return;
    }

    this.logDebug(`[CameraPreview] Stream config:`, streamConfig);

    // Store stream type for FPS tracking mode selection
    this.currentStreamType = streamConfig.streamType;

    // Create video-rtc element for unified streaming
    this.createVideoRtcStream(streamConfig.wsUrl, streamConfig.mode, cameraView);

    // Update button state
    button.textContent = 'Preview Off';
    this.updateComponentState('streaming');

    // Start FPS tracking if enabled
    if (this.showFpsOverlay) {
      this.startFpsTracking();
    }
  }

  /**
   * Disable camera preview - clean up stream and reset UI
   */
  private async disableCameraPreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
    this.logDebug('Disabling camera preview');

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
   * Create and setup video-rtc element for camera streaming
   * This handles both MJPEG and RTSP sources through go2rtc
   */
  private createVideoRtcStream(wsUrl: string, mode: string, cameraView: HTMLElement): void {
    // Clear existing content
    cameraView.innerHTML = '';

    // Create video-rtc element
    const element = document.createElement('video-rtc') as VideoRTCElement;
    element.src = wsUrl;
    element.mode = mode;
    element.media = 'video'; // Video only, no audio for camera feeds

    // Style the element
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.objectFit = 'cover';
    element.style.display = 'block';

    // Add to view
    cameraView.appendChild(element);
    this.videoRtcElement = element;

    this.logDebug(`[CameraPreview] video-rtc element created: ${wsUrl} (mode: ${mode})`);
  }

  /**
   * Clean up video-rtc element
   */
  private cleanupCameraStream(): void {
    // Stop FPS tracking first
    this.stopFpsTracking();

    if (this.videoRtcElement) {
      try {
        this.videoRtcElement.remove();
        this.logDebug('[CameraPreview] video-rtc element removed');
      } catch (error) {
        console.warn('[CameraPreview] Error removing video-rtc element:', error);
      }
      this.videoRtcElement = null;
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
    this.logDebug(`Camera error: ${message}`);
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

    // Update FPS overlay visibility based on new state
    this.updateFpsOverlayVisibility();
  }

  /**
   * Handle visibility changes (tab switching)
   * video-rtc handles reconnection internally, we just update status
   */
  private handleVisibilityChange(): void {
    if (document.hidden || !this.previewEnabled) {
      return;
    }

    // When tab becomes visible, video-rtc will reconnect automatically
    this.logDebug('[CameraPreview] Tab visible, video-rtc will handle reconnection');
  }

  /**
   * Update job display with current job information
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
   */
  public getCurrentJobInfo(): CurrentJobInfo | null {
    return this.currentJobInfo;
  }

  /**
   * Get current printer state
   */
  public getCurrentPrinterState(): PrinterState | null {
    return this.currentPrinterState;
  }

  /**
   * Check if there is an active job
   */
  public hasActiveJob(): boolean {
    return this.currentJobInfo !== null && this.currentJobInfo.isActive;
  }

  /**
   * Component cleanup - stop stream and remove elements
   */
  protected cleanup(): void {
    this.logDebug('Cleaning up camera preview component');

    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);

    // Clean up IPC listeners
    if (this.configUpdateDisposer) {
      this.configUpdateDisposer();
      this.configUpdateDisposer = null;
    }
    window.api.removeListener('printer-context-switched');

    // Clean up camera stream
    this.cleanupCameraStream();

    // Reset camera state
    this.previewEnabled = false;
    this.currentState = 'disabled';
    this.currentStreamType = null;

    // Reset job info state
    this.currentJobInfo = null;
    this.currentPrinterState = null;
  }
}
