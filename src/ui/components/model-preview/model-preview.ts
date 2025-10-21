/**
 * @fileoverview Model Preview Component
 * 
 * This component displays 3D model thumbnails and job preview information.
 * It shows the current job's thumbnail when available, and provides appropriate
 * placeholder messages for different states (no job, job without thumbnail).
 * The component integrates with the polling system to display real-time data
 * and handles thumbnail loading, error states, and visual updates.
 * 
 * Key features:
 * - Displays job thumbnails from polling data
 * - Shows placeholder messages for different states
 * - Handles thumbnail loading and error states
 * - Updates in real-time with polling data
 * - Supports both "rounded" and "square" UI modes
 * - Follows component-scoped CSS patterns
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData } from '../../../types/polling';
import './model-preview.css';

/**
 * Model preview states for visual feedback
 */
enum PreviewState {
  NO_JOB = 'no-job',
  HAS_THUMBNAIL = 'has-thumbnail',
  NO_THUMBNAIL = 'no-thumbnail',
  LOADING = 'loading',
  ERROR = 'error'
}

/**
 * Model Preview Component
 * 
 * Displays 3D model thumbnails and job preview information based on current
 * printer job status and thumbnail data from the polling system.
 */
export class ModelPreviewComponent extends BaseComponent {
  /** Component identifier */
  public readonly componentId = 'model-preview';

  /** Current preview state */
  private currentState: PreviewState = PreviewState.NO_JOB;

  /** Currently displayed job name for state tracking */
  private currentJobName: string | null = null;

  /** HTML template for the component */
  public readonly templateHTML = `
    <div class="panel-header">Model Preview</div>
    <div class="panel-content" id="model-preview">
      <div class="preview-placeholder">
        <div class="preview-placeholder-text">No active job</div>
      </div>
    </div>
  `;

  /**
   * Setup event listeners for the component
   */
  protected async setupEventListeners(): Promise<void> {
    // No interactive elements in this component, so no event listeners needed
    // Thumbnail images are handled via error events when created
  }

  /**
   * Update component with new polling data
   * @param data - Component update data containing polling information
   */
  public update(data: ComponentUpdateData): void {
    try {
      this.assertInitialized();
      
      const pollingData = data.pollingData;
      if (!pollingData) {
        this.clearPreview();
        return;
      }

      this.updatePreview(pollingData);
      this.updateState(data);
      
    } catch (error) {
      console.error('Model Preview Component update error:', error);
      this.setState(PreviewState.ERROR);
      this.showError('Failed to update preview');
    }
  }

  /**
   * Update the model preview based on current polling data
   * @param data - Polling data from the printer
   */
  private updatePreview(data: PollingData): void {
    const job = data.printerStatus?.currentJob;
    const isJobActive = job && job.isActive;

    if (!isJobActive) {
      this.clearPreview();
      return;
    }

    // Check if job has changed
    const newJobName = job.displayName || job.fileName;
    const jobChanged = this.currentJobName !== newJobName;
    this.currentJobName = newJobName;

    if (data.thumbnailData) {
      // Job is active and has thumbnail data
      this.showThumbnail(data.thumbnailData, newJobName, jobChanged);
    } else {
      // Job is active but no thumbnail available
      this.showNoThumbnailPlaceholder(newJobName);
    }
  }

  /**
   * Display thumbnail image with hard pixel size constraints
   * @param thumbnailData - Base64 encoded thumbnail data
   * @param jobName - Name of the current job
   * @param jobChanged - Whether the job has changed since last update
   */
  private showThumbnail(thumbnailData: string, jobName: string, jobChanged: boolean): void {
    const previewContainer = this.findElement('#model-preview');
    if (!previewContainer) {
      console.warn('Model preview container not found');
      return;
    }

    // Only recreate the image if job changed or we don't have an image
    const existingImg = previewContainer.querySelector('img');
    if (!jobChanged && existingImg && this.currentState === PreviewState.HAS_THUMBNAIL) {
      // Image already exists and job hasn't changed, no need to update
      return;
    }

    this.setState(PreviewState.LOADING);

    const img = document.createElement('img');
    img.src = thumbnailData; // thumbnailData already includes the data URL prefix
    img.alt = jobName || 'Model Preview';
    // Apply hard pixel constraints to prevent image from expanding beyond container limits
    // This ensures the image never pushes job info out of view regardless of image size
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.objectFit = 'contain';

    // Handle successful image load
    img.onload = () => {
      this.setState(PreviewState.HAS_THUMBNAIL);
    };

    // Handle image load errors
    img.onerror = () => {
      console.warn('Failed to load model thumbnail');
      this.showNoThumbnailPlaceholder(jobName);
    };

    // Clear existing content and add new image
    previewContainer.innerHTML = '';
    previewContainer.appendChild(img);
  }

  /**
   * Show placeholder for active job without thumbnail
   * @param jobName - Name of the current job
   */
  private showNoThumbnailPlaceholder(jobName: string): void {
    this.setState(PreviewState.NO_THUMBNAIL);
    
    const previewContainer = this.findElement('#model-preview');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-placeholder-text">
            <p>Preview for:</p>
            <p><strong>${this.escapeHtml(jobName)}</strong></p>
            <p>No thumbnail available</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Clear the preview and show no active job message
   */
  private clearPreview(): void {
    this.setState(PreviewState.NO_JOB);
    this.currentJobName = null;
    
    const previewContainer = this.findElement('#model-preview');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-placeholder-text">No active job</div>
        </div>
      `;
    }
  }

  /**
   * Show error message in preview area
   * @param message - Error message to display
   */
  private showError(message: string): void {
    const previewContainer = this.findElement('#model-preview');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-placeholder-text">${this.escapeHtml(message)}</div>
        </div>
      `;
    }
  }

  /**
   * Update component visual state
   * @param newState - New preview state
   */
  private setState(newState: PreviewState): void {
    if (this.currentState === newState) return;

    // Remove all state classes
    if (this.container) {
      this.container.classList.remove(
        'has-thumbnail',
        'no-thumbnail',
        'loading',
        'error'
      );

      // Add new state class
      switch (newState) {
        case PreviewState.HAS_THUMBNAIL:
          this.container.classList.add('has-thumbnail');
          break;
        case PreviewState.NO_THUMBNAIL:
          this.container.classList.add('no-thumbnail');
          break;
        case PreviewState.LOADING:
          this.container.classList.add('loading');
          break;
        case PreviewState.ERROR:
          this.container.classList.add('error');
          break;
        // NO_JOB has no special class
      }
    }

    this.currentState = newState;
  }

  /**
   * Escape HTML in text content to prevent XSS
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Component cleanup - reset state
   */
  protected cleanup(): void {
    this.currentState = PreviewState.NO_JOB;
    this.currentJobName = null;
    super.cleanup();
  }

  /**
   * Get current component state for debugging
   * @returns Current preview state and job information
   */
  public getPreviewState(): { state: PreviewState; jobName: string | null } {
    return {
      state: this.currentState,
      jobName: this.currentJobName
    };
  }
}
