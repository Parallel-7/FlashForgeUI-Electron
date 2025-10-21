/**
 * @fileoverview Printer Status Component
 * 
 * Display-only component showing current printer state, runtime information,
 * and cumulative filament usage statistics. Updates with polling data and
 * provides visual feedback for different printer states through CSS classes.
 * 
 * Key features:
 * - Current printer state display (Ready, Printing, Paused, etc.)
 * - Runtime tracking with formatted display
 * - Filament usage statistics in meters
 * - State-specific styling for visual feedback
 * - No user interactions (display-only component)
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PrinterState, CumulativeStats } from '../../../types/polling';
import { formatLength } from '../../../types/polling';
import './printer-status.css';

/**
 * PrinterStatusComponent displays current printer state and cumulative statistics
 * This is a display-only component with no interactive elements
 */
export class PrinterStatusComponent extends BaseComponent {
  public readonly componentId = 'printer-status';
  public readonly templateHTML = `
    <div class="printer-status-container">
      <div class="status-display-row">
        <span class="status-label">Printer:</span>
        <span id="printer-status-text" class="status-value">idle</span>
      </div>
      <div class="status-display-row">
        <span class="status-label">Run time:</span>
        <span id="run-time-text" class="status-value">0h:0m</span>
      </div>
      <div class="status-display-row">
        <span class="status-label">Filament used:</span>
        <span id="filament-used-text" class="status-value">0m</span>
      </div>
    </div>
  `;

  /**
   * Setup event listeners for printer status component
   * No interactive elements, so this is a no-op
   */
  protected async setupEventListeners(): Promise<void> {
    // No event listeners needed for display-only component
  }

  /**
   * Update component with new polling data
   * @param data - Component update data containing polling information
   */
  public update(data: ComponentUpdateData): void {
    this.assertInitialized();

    try {
      const pollingData = data.pollingData;
      const printerStatus = pollingData?.printerStatus;

      if (printerStatus) {
        // Update printer state
        this.updatePrinterState(printerStatus.state);
        
        // Update cumulative statistics
        this.updateCumulativeStats(printerStatus.cumulativeStats);
      } else {
        // No printer data - show disconnected state
        this.updatePrinterState('Ready');
        this.updateCumulativeStats(undefined);
      }

      // Update component state tracking
      this.updateState(data);

    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  /**
   * Update the printer state display and apply appropriate CSS classes
   * @param state - Current printer state
   */
  private updatePrinterState(state: PrinterState): void {
    const statusElement = this.findElementById('printer-status-text');
    if (statusElement) {
      statusElement.textContent = state;
      
      // Remove all state classes
      if (this.container) {
        this.container.classList.remove(
          'printer-state-ready',
          'printer-state-printing', 
          'printer-state-paused',
          'printer-state-error',
          'printer-state-completed'
        );
        
        // Add current state class
        const stateClass = `printer-state-${state.toLowerCase()}`;
        this.container.classList.add(stateClass);
      }
    }
  }

  /**
   * Update cumulative statistics display
   * @param stats - Cumulative printer statistics or undefined if not available
   */
  private updateCumulativeStats(stats?: CumulativeStats): void {
    // Update runtime display
    const runtimeElement = this.findElementById('run-time-text');
    if (runtimeElement) {
      if (stats?.totalPrintTime) {
        const hours = Math.floor(stats.totalPrintTime / 60);
        const minutes = Math.floor(stats.totalPrintTime % 60);
        runtimeElement.textContent = `${hours}h:${minutes}m`;
      } else {
        runtimeElement.textContent = '0h:0m';
      }
    }

    // Update filament usage display
    const filamentElement = this.findElementById('filament-used-text');
    if (filamentElement) {
      if (stats?.totalFilamentUsed) {
        filamentElement.textContent = formatLength(stats.totalFilamentUsed);
      } else {
        filamentElement.textContent = '0m';
      }
    }
  }
}
