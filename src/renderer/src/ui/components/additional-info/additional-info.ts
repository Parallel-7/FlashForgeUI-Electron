/**
 * @fileoverview Additional Info Component
 * 
 * Display-only component showing printer configuration and settings information.
 * Displays nozzle size, filament type, speed settings, and Z-axis offsets with
 * visual indicators for different value ranges and states.
 * 
 * Key features:
 * - Nozzle size display with size-specific indicators
 * - Filament type information
 * - Speed offset percentage with range indicators
 * - Z-axis offset with positive/negative/zero indicators
 * - Availability checking (dim if settings unavailable)
 * - No user interactions (display-only component)
 */

import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import type { PrinterSettings } from '@shared/types/polling.js';
import './additional-info.css';

/**
 * AdditionalInfoComponent displays printer configuration and settings
 * This is a display-only component with no interactive elements
 */
export class AdditionalInfoComponent extends BaseComponent {
  public readonly componentId = 'additional-info';
  public readonly templateHTML = `
    <div class="additional-info-container" id="printer-info-section">
      <div class="panel-header">Additional Info</div>
      <div class="panel-content">
        <div class="info-display-row">
          <span class="info-label">Nozzle Size:</span>
          <span id="nozzle-size-display" class="info-value">0.4mm</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Filament:</span>
          <span id="filament-type-display" class="info-value">PLA</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Speed Offset:</span>
          <span id="speed-offset-display" class="info-value">100%</span>
        </div>
        <div class="info-display-row">
          <span class="info-label">Z-Axis Offset:</span>
          <span id="z-offset-display" class="info-value">0.000</span>
        </div>
      </div>
    </div>
  `;

  /**
   * Setup event listeners for additional info component
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
      const isConnected = pollingData?.isConnected ?? false;

      if (printerStatus && isConnected) {
        // Update printer settings information
        this.updatePrinterSettings(printerStatus.settings);
        this.showAsAvailable();
      } else {
        // No printer data - show default/unavailable state
        this.updatePrinterSettings({
          nozzleSize: 0.4,
          filamentType: 'PLA',
          speedOffset: 100,
          zAxisOffset: 0.0
        });
        this.showAsUnavailable();
      }

      // Update component state tracking
      this.updateState(data);

    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  /**
   * Update printer settings display
   * @param settings - Current printer settings data
   */
  private updatePrinterSettings(settings: PrinterSettings): void {
    // Update nozzle size
    this.updateNozzleSize(settings.nozzleSize);
    
    // Update filament type
    this.updateFilamentType(settings.filamentType);
    
    // Update speed offset
    this.updateSpeedOffset(settings.speedOffset);
    
    // Update Z-axis offset
    this.updateZAxisOffset(settings.zAxisOffset);
  }

  /**
   * Update nozzle size display and apply appropriate styling
   * @param nozzleSize - Nozzle size in mm or undefined if not available
   */
  private updateNozzleSize(nozzleSize?: number): void {
    const nozzleDisplay = this.findElementById('nozzle-size-display');
    if (nozzleDisplay) {
      if (nozzleSize !== undefined) {
        nozzleDisplay.textContent = `${nozzleSize.toFixed(1)}mm`;
        
        // Apply size-specific styling
        if (this.container) {
          this.container.classList.remove('nozzle-size-0-4', 'nozzle-size-0-6', 'nozzle-size-other');
          
          if (nozzleSize === 0.4) {
            this.container.classList.add('nozzle-size-0-4');
          } else if (nozzleSize === 0.6) {
            this.container.classList.add('nozzle-size-0-6');
          } else {
            this.container.classList.add('nozzle-size-other');
          }
        }
      } else {
        nozzleDisplay.textContent = 'N/A';
        if (this.container) {
          this.container.classList.remove('nozzle-size-0-4', 'nozzle-size-0-6', 'nozzle-size-other');
        }
      }
    }
  }

  /**
   * Update filament type display
   * @param filamentType - Filament type string or undefined if not available
   */
  private updateFilamentType(filamentType?: string): void {
    const filamentDisplay = this.findElementById('filament-type-display');
    if (filamentDisplay) {
      filamentDisplay.textContent = filamentType || 'Unknown';
    }
  }

  /**
   * Update speed offset display and apply appropriate styling
   * @param speedOffset - Speed offset percentage or undefined if not available
   */
  private updateSpeedOffset(speedOffset?: number): void {
    const speedDisplay = this.findElementById('speed-offset-display');
    if (speedDisplay) {
      if (speedOffset !== undefined) {
        speedDisplay.textContent = `${speedOffset}%`;
        
        // Apply speed range styling
        if (this.container) {
          this.container.classList.remove('speed-offset-normal', 'speed-offset-fast', 'speed-offset-slow');
          
          if (speedOffset >= 80 && speedOffset <= 120) {
            this.container.classList.add('speed-offset-normal');
          } else if (speedOffset > 120) {
            this.container.classList.add('speed-offset-fast');
          } else {
            this.container.classList.add('speed-offset-slow');
          }
        }
      } else {
        speedDisplay.textContent = 'N/A';
        if (this.container) {
          this.container.classList.remove('speed-offset-normal', 'speed-offset-fast', 'speed-offset-slow');
        }
      }
    }
  }

  /**
   * Update Z-axis offset display and apply appropriate styling
   * @param zAxisOffset - Z-axis offset in mm or undefined if not available
   */
  private updateZAxisOffset(zAxisOffset?: number): void {
    const zOffsetDisplay = this.findElementById('z-offset-display');
    if (zOffsetDisplay) {
      if (zAxisOffset !== undefined) {
        zOffsetDisplay.textContent = zAxisOffset.toFixed(3);
        
        // Apply offset range styling
        if (this.container) {
          this.container.classList.remove('z-offset-zero', 'z-offset-positive', 'z-offset-negative');
          
          if (Math.abs(zAxisOffset) < 0.001) {
            this.container.classList.add('z-offset-zero');
          } else if (zAxisOffset > 0) {
            this.container.classList.add('z-offset-positive');
          } else {
            this.container.classList.add('z-offset-negative');
          }
        }
      } else {
        zOffsetDisplay.textContent = 'N/A';
        if (this.container) {
          this.container.classList.remove('z-offset-zero', 'z-offset-positive', 'z-offset-negative');
        }
      }
    }
  }

  /**
   * Show component as available (normal styling)
   */
  private showAsAvailable(): void {
    if (this.container) {
      this.container.classList.remove('settings-unavailable');
    }
  }

  /**
   * Show component as unavailable (dimmed styling)
   */
  private showAsUnavailable(): void {
    if (this.container) {
      this.container.classList.add('settings-unavailable');
    }
  }
}
