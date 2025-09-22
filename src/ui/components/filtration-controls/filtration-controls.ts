/**
 * @fileoverview Filtration Controls Component
 * 
 * Interactive component for controlling printer filtration systems and monitoring
 * TVOC (Total Volatile Organic Compounds) levels. Provides mode selection buttons
 * for External/Internal/None filtration modes with feature availability checking.
 * 
 * Key features:
 * - Current filtration mode display and selection
 * - TVOC level monitoring with color-coded indicators
 * - Interactive mode selection buttons (External/Internal/None)
 * - Feature availability checking (hide if not supported)
 * - State-dependent button enabling/disabling
 * - Visual feedback for active filtration mode
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { FiltrationStatus, PrinterState } from '../../../types/polling';
import { isActiveState } from '../../../types/polling';
import './filtration-controls.css';

/**
 * FiltrationControlsComponent manages printer filtration controls and monitoring
 * Provides interactive filtration mode selection and TVOC level display
 */
export class FiltrationControlsComponent extends BaseComponent {
  public readonly componentId = 'filtration-controls';
  public readonly templateHTML = `
    <div class="filtration-controls-container" id="filtration-section">
      <div class="filtration-status-row">
        <span class="filtration-label">Filtration:</span>
        <span id="filtration-status-display" class="filtration-value">None</span>
      </div>
      <div class="filtration-status-row">
        <span class="filtration-label">TVOC Level:</span>
        <span id="tvoc-level-display" class="filtration-value">0</span>
      </div>
      <div class="filtration-controls-buttons">
        <button id="btn-external-filtration" class="filtration-control-btn">External</button>
        <button id="btn-internal-filtration" class="filtration-control-btn">Internal</button>
        <button id="btn-no-filtration" class="filtration-control-btn">None</button>
      </div>
    </div>
  `;

  /**
   * Setup event listeners for filtration control buttons
   */
  protected async setupEventListeners(): Promise<void> {
    // External filtration mode
    this.addEventListener('#btn-external-filtration', 'click', () => {
      this.handleFiltrationModeChange('external').catch(console.error);
    });

    // Internal filtration mode
    this.addEventListener('#btn-internal-filtration', 'click', () => {
      this.handleFiltrationModeChange('internal').catch(console.error);
    });

    // No filtration mode
    this.addEventListener('#btn-no-filtration', 'click', () => {
      this.handleFiltrationModeChange('none').catch(console.error);
    });
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
      const isConnected = pollingData?.isConnected ?? false;

      if (printerStatus && isConnected) {
        const filtrationStatus = printerStatus.filtration;
        
        // Check if filtration is available
        if (filtrationStatus.available) {
          this.showComponent();
          this.updateFiltrationDisplay(filtrationStatus);
          this.updateButtonStates(printerStatus.state, true, filtrationStatus);
        } else {
          this.hideComponent();
        }
      } else {
        // No printer data or not connected
        this.showComponent();
        this.updateFiltrationDisplay({
          mode: 'none',
          tvocLevel: 0,
          available: false
        });
        this.updateButtonStates('Ready', false, null);
      }

      // Update component state tracking
      this.updateState(data);

    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  /**
   * Update filtration status display and TVOC level
   * @param filtration - Current filtration status data
   */
  private updateFiltrationDisplay(filtration: FiltrationStatus): void {
    // Update filtration mode display
    const statusDisplay = this.findElementById('filtration-status-display');
    if (statusDisplay) {
      const modeText = this.getFiltrationModeText(filtration.mode);
      statusDisplay.textContent = modeText;
    }

    // Update TVOC level display
    const tvocDisplay = this.findElementById('tvoc-level-display');
    if (tvocDisplay) {
      tvocDisplay.textContent = filtration.tvocLevel.toString();
      
      // Apply TVOC level color coding
      tvocDisplay.classList.remove('tvoc-low', 'tvoc-medium', 'tvoc-high');
      const tvocClass = this.getTvocLevelClass(filtration.tvocLevel);
      if (tvocClass) {
        tvocDisplay.classList.add(tvocClass);
      }
    }

    // Update active button styling
    this.updateActiveButton(filtration.mode);
  }

  /**
   * Update button states based on printer state, connection, and filtration status
   * @param printerState - Current printer state
   * @param isConnected - Whether printer is connected
   * @param filtration - Current filtration status (null if unavailable)
   */
  private updateButtonStates(printerState: string, isConnected: boolean, filtration: FiltrationStatus | null): void {
    const buttons = [
      'btn-external-filtration',
      'btn-internal-filtration',
      'btn-no-filtration'
    ];

    // Disable buttons if not connected, in active state, or filtration unavailable
    const shouldDisable = !isConnected ||
                          isActiveState(printerState as PrinterState) ||
                          (filtration !== null && !filtration.available);

    buttons.forEach(buttonId => {
      const button = this.findElementById<HTMLButtonElement>(buttonId);
      if (button) {
        button.disabled = shouldDisable;
      }
    });
  }

  /**
   * Update active button styling based on current filtration mode
   * @param mode - Current filtration mode
   */
  private updateActiveButton(mode: 'external' | 'internal' | 'none'): void {
    // Remove active class from all buttons
    const buttons = [
      { id: 'btn-external-filtration', mode: 'external' },
      { id: 'btn-internal-filtration', mode: 'internal' },
      { id: 'btn-no-filtration', mode: 'none' }
    ];

    buttons.forEach(({ id, mode: buttonMode }) => {
      const button = this.findElementById(id);
      if (button) {
        if (buttonMode === mode) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    });
  }

  /**
   * Handle filtration mode change button click
   * @param mode - New filtration mode to set
   */
  private async handleFiltrationModeChange(mode: 'external' | 'internal' | 'none'): Promise<void> {
    try {
      // Convert 'none' to 'off' to match backend expectations
      const backendMode = mode === 'none' ? 'off' : mode;

      // Use the global API exposed by preload script
      if (window.api && window.api.invoke) {
        await window.api.invoke('set-filtration', backendMode);
      }
    } catch (error) {
      console.error(`Failed to set filtration mode to ${mode}:`, error);
    }
  }

  /**
   * Get display text for filtration mode
   * @param mode - Filtration mode
   * @returns Display text for the mode
   */
  private getFiltrationModeText(mode: 'external' | 'internal' | 'none'): string {
    switch (mode) {
      case 'external':
        return 'External';
      case 'internal':
        return 'Internal';
      case 'none':
        return 'None';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get CSS class for TVOC level color coding
   * @param tvocLevel - Current TVOC level
   * @returns CSS class name or null
   */
  private getTvocLevelClass(tvocLevel: number): string | null {
    if (tvocLevel <= 100) {
      return 'tvoc-low';
    } else if (tvocLevel <= 300) {
      return 'tvoc-medium';
    } else {
      return 'tvoc-high';
    }
  }

  /**
   * Show the component (make visible)
   */
  private showComponent(): void {
    if (this.container) {
      this.container.classList.remove('filtration-unavailable');
    }
  }

  /**
   * Hide the component (filtration not available)
   */
  private hideComponent(): void {
    if (this.container) {
      this.container.classList.add('filtration-unavailable');
    }
  }
}