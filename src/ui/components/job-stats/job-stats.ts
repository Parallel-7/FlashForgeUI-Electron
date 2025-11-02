/**
 * @fileoverview Job Statistics Component
 * 
 * This component displays real-time job statistics including layer information, 
 * ETA, job timing, and material usage data. It extends the BaseComponent class
 * and integrates with the existing polling data system to provide live updates
 * of printer job progress.
 * 
 * Key features:
 * - Displays layer progress (current/total layers)
 * - Shows ETA with proper time formatting and calculation
 * - Tracks elapsed printing time with formatTime utility
 * - Shows material usage (weight in grams, length in meters)
 * - Handles ETA calculation from formattedEta and timeRemaining fields
 * - Clears display when no active job
 * - Uses existing formatting utilities from polling types
 * 
 * Data Sources:
 * - PollingData.printerStatus.currentJob for job information
 * - JobProgress for progress tracking and timing
 * - Formatting utilities from polling types
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData } from '../../../types/polling';
import { formatTime, formatWeight, formatLength } from '../../../types/polling';
import './job-stats.css';

/**
 * Job Statistics Component
 * Displays current job statistics including layer progress, ETA, timing, and material usage
 */
export class JobStatsComponent extends BaseComponent {
  /** Component identifier */
  public readonly componentId = 'job-stats';

  /** HTML template for the component */
  public readonly templateHTML = `
    <div class="job-stats-container">
      <div class="panel-header">Job Info</div>
      <div class="panel-content">
        <div class="info-display-row">
          <span class="info-label">Layer:</span>
          <span class="info-value" id="layer-info">0 / 0</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">ETA:</span>
          <span class="info-value" id="eta">--:--</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Job Time:</span>
          <span class="info-value" id="job-time">00:00</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Weight:</span>
          <span class="info-value" id="weight">0g</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Length:</span>
          <span class="info-value" id="length">0m</span>
        </div>
      </div>
    </div>
  `;

  /**
   * Creates a new JobStatsComponent instance
   * @param parentElement - The parent DOM element where this component will be rendered
   */
  constructor(parentElement: HTMLElement) {
    super(parentElement);
  }

  /**
   * Setup component-specific event listeners
   * Job stats component is read-only, so no user interactions needed
   */
  protected async setupEventListeners(): Promise<void> {
    // Job stats is a read-only component with no user interactions
    // All updates are handled through the update() method
    console.log('JobStatsComponent: No event listeners needed (read-only component)');
  }

  /**
   * Update component with new polling data
   * Extracts job data from polling data and updates all display elements
   * @param data - Component update data containing polling information
   */
  public update(data: ComponentUpdateData): void {
    try {
      this.assertInitialized();
      this.updateState(data);

      // Extract polling data
      const pollingData = data.pollingData;
      
      // Update all job statistics displays
      this.updateLayerInfo(pollingData);
      this.updateETA(pollingData);
      this.updateJobTime(pollingData);
      this.updateMaterialUsage(pollingData);

    } catch (error) {
      console.error('JobStatsComponent: Error updating component:', error);
      // Set fallback display on error
      this.clearAllDisplays();
    }
  }

  /**
   * Update layer information display
   * Shows current layer / total layers or default when no job active
   * @param pollingData - Current polling data from printer
   */
  private updateLayerInfo(pollingData?: PollingData): void {
    const currentJob = pollingData?.printerStatus?.currentJob;
    
    if (currentJob?.isActive && currentJob.progress) {
      const current = currentJob.progress.currentLayer ?? 0;
      const total = currentJob.progress.totalLayers ?? 0;
      this.setElementText('#layer-info', `${current} / ${total}`);
    } else {
      this.setElementText('#layer-info', '0 / 0');
    }
  }

  /**
   * Update ETA (Estimated Time of Arrival) display
   * Uses formattedEta if available, falls back to timeRemaining calculation
   * Converts to actual completion time in 12-hour format
   * @param pollingData - Current polling data from printer
   */
  private updateETA(pollingData?: PollingData): void {
    const currentJob = pollingData?.printerStatus?.currentJob;
    
    if (currentJob?.isActive && currentJob.progress) {
      const progress = currentJob.progress;
      let etaDisplay = '--:--';

      try {
        // Try to use formattedEta first (e.g., "14:30" from ff-api)
        if (progress.formattedEta && progress.formattedEta !== '--:--') {
          etaDisplay = this.formatETAToCompletionTime(progress.formattedEta);
        } 
        // Fall back to timeRemaining calculation
        else if (progress.timeRemaining && progress.timeRemaining > 0) {
          etaDisplay = this.calculateCompletionTime(progress.timeRemaining);
        }
      } catch (error) {
        console.warn('JobStatsComponent: ETA calculation error:', error);
        etaDisplay = '--:--';
      }

      this.setElementText('#eta', etaDisplay);
    } else {
      this.setElementText('#eta', '--:--');
    }
  }

  /**
   * Update job time (elapsed time) display
   * Shows elapsed printing time using formatTime utility
   * @param pollingData - Current polling data from printer
   */
  private updateJobTime(pollingData?: PollingData): void {
    const currentJob = pollingData?.printerStatus?.currentJob;
    
    if (currentJob?.isActive && currentJob.progress) {
      const elapsedMinutes = currentJob.progress.elapsedTime;
      const formattedTime = formatTime(elapsedMinutes);
      this.setElementText('#job-time', formattedTime);
    } else {
      this.setElementText('#job-time', '00:00');
    }
  }

  /**
   * Update material usage displays (weight and length)
   * Shows weight in grams and filament length in meters
   * @param pollingData - Current polling data from printer
   */
  private updateMaterialUsage(pollingData?: PollingData): void {
    const currentJob = pollingData?.printerStatus?.currentJob;
    
    if (currentJob?.isActive && currentJob.progress) {
      const progress = currentJob.progress;
      
      // Update weight display
      const weightDisplay = formatWeight(progress.weightUsed);
      this.setElementText('#weight', weightDisplay);
      
      // Update length display  
      const lengthDisplay = formatLength(progress.lengthUsed);
      this.setElementText('#length', lengthDisplay);
    } else {
      // Clear displays when no active job
      this.setElementText('#weight', '0g');
      this.setElementText('#length', '0m');
    }
  }

  /**
   * Format ETA string to actual completion time
   * Converts "HH:MM" format to actual completion time in 12-hour format
   * @param formattedEta - ETA string from ff-api (e.g., "14:30")
   * @returns Formatted completion time (e.g., "3:45 PM")
   */
  private formatETAToCompletionTime(formattedEta: string): string {
    try {
      // Parse the ETA time (assuming it's time remaining, not clock time)
      const [hours, minutes] = formattedEta.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) {
        return '--:--';
      }
      
      // Calculate completion time
      const now = new Date();
      const completionTime = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
      
      // Format to 12-hour format
      return completionTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('JobStatsComponent: Error formatting ETA:', error);
      return '--:--';
    }
  }

  /**
   * Calculate completion time from remaining minutes
   * @param timeRemainingMinutes - Time remaining in minutes
   * @returns Formatted completion time in 12-hour format
   */
  private calculateCompletionTime(timeRemainingMinutes: number): string {
    try {
      if (timeRemainingMinutes <= 0) {
        return '--:--';
      }
      
      const now = new Date();
      const completionTime = new Date(now.getTime() + timeRemainingMinutes * 60 * 1000);
      
      return completionTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('JobStatsComponent: Error calculating completion time:', error);
      return '--:--';
    }
  }

  /**
   * Clear all displays to default values
   * Used when component encounters errors or no data is available
   */
  private clearAllDisplays(): void {
    this.setElementText('#layer-info', '0 / 0');
    this.setElementText('#eta', '--:--');
    this.setElementText('#job-time', '00:00');
    this.setElementText('#weight', '0g');
    this.setElementText('#length', '0m');
  }

  /**
   * Component-specific cleanup logic
   * Called during component destruction
   */
  protected cleanup(): void {
    // Job stats component has no resources to clean up
    // All updates are handled through polling data
    console.log('JobStatsComponent: Cleanup completed');
  }
}
