/**
 * @fileoverview Temperature Controls Component
 * 
 * Interactive component for controlling and monitoring printer temperatures.
 * Displays bed and extruder temperatures with Set/Off buttons, and shows
 * fan status information. Handles temperature input dialogs via IPC.
 * 
 * Key features:
 * - Real-time temperature display for bed and extruder
 * - Interactive Set/Off buttons for temperature control
 * - Fan status monitoring (cooling and chamber fans)
 * - Temperature input dialog integration
 * - State-dependent button enabling/disabling
 * - Visual feedback for heating states
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PrinterTemperatures, FanStatus } from '../../../types/polling';
import { formatTemperature, isActiveState } from '../../../types/polling';
import './temperature-controls.css';

/**
 * TemperatureControlsComponent manages printer temperature controls and display
 * Provides interactive temperature setting and real-time monitoring
 */
export class TemperatureControlsComponent extends BaseComponent {
  public readonly componentId = 'temperature-controls';
  public readonly templateHTML = `
    <div class="temperature-controls-section">
      <div class="temp-row">
        <span>Bed: <span id="bed-temp-display">0°C/0°C</span></span>
        <div class="temp-buttons">
          <button id="btn-bed-set" class="temp-btn">Set</button>
          <button id="btn-bed-off" class="temp-btn">Off</button>
        </div>
      </div>
      <div class="temp-row">
        <span>Extruder: <span id="extruder-temp-display">0°C/0°C</span></span>
        <div class="temp-buttons">
          <button id="btn-extruder-set" class="temp-btn">Set</button>
          <button id="btn-extruder-off" class="temp-btn">Off</button>
        </div>
      </div>
      <div class="status-item" id="cooling-fan-display">Cooling Fan: <span id="cooling-fan-speed">0</span></div>
      <div class="status-item" id="chamber-fan-display">Chamber Fan: <span id="chamber-fan-speed">0</span></div>
    </div>
  `;

  /**
   * Setup event listeners for temperature control buttons
   */
  protected async setupEventListeners(): Promise<void> {
    // Bed temperature controls
    this.addEventListener('#btn-bed-set', 'click', () => {
      this.handleTemperatureSet('bed');
    });

    this.addEventListener('#btn-bed-off', 'click', () => {
      this.handleTemperatureOff('bed');
    });

    // Extruder temperature controls
    this.addEventListener('#btn-extruder-set', 'click', () => {
      this.handleTemperatureSet('extruder');
    });

    this.addEventListener('#btn-extruder-off', 'click', () => {
      this.handleTemperatureOff('extruder');
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
        // Update temperature displays
        this.updateTemperatureDisplays(printerStatus.temperatures);
        
        // Update fan status
        this.updateFanStatus(printerStatus.fans);
        
        // Enable/disable buttons based on printer state
        this.updateButtonStates(printerStatus.state, true);
      } else {
        // No printer data - show disconnected state
        this.updateTemperatureDisplays({
          bed: { current: 0, target: 0, isHeating: false },
          extruder: { current: 0, target: 0, isHeating: false }
        });
        
        this.updateFanStatus({ coolingFan: 0, chamberFan: 0 });
        this.updateButtonStates('Ready', false);
      }

      // Update component state tracking
      this.updateState(data);

    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  /**
   * Update temperature displays with current and target temperatures
   * @param temperatures - Current temperature data
   */
  private updateTemperatureDisplays(temperatures: PrinterTemperatures): void {
    // Update bed temperature
    const bedDisplay = this.findElementById('bed-temp-display');
    if (bedDisplay) {
      bedDisplay.textContent = formatTemperature(temperatures.bed);
      
      // Apply heating indicator
      if (temperatures.bed.isHeating) {
        bedDisplay.classList.add('temp-heating');
        bedDisplay.classList.remove('temp-at-target');
      } else if (Math.abs(temperatures.bed.current - temperatures.bed.target) < 2 && temperatures.bed.target > 0) {
        bedDisplay.classList.add('temp-at-target');
        bedDisplay.classList.remove('temp-heating');
      } else {
        bedDisplay.classList.remove('temp-heating', 'temp-at-target');
      }
    }

    // Update extruder temperature
    const extruderDisplay = this.findElementById('extruder-temp-display');
    if (extruderDisplay) {
      extruderDisplay.textContent = formatTemperature(temperatures.extruder);
      
      // Apply heating indicator
      if (temperatures.extruder.isHeating) {
        extruderDisplay.classList.add('temp-heating');
        extruderDisplay.classList.remove('temp-at-target');
      } else if (Math.abs(temperatures.extruder.current - temperatures.extruder.target) < 2 && temperatures.extruder.target > 0) {
        extruderDisplay.classList.add('temp-at-target');
        extruderDisplay.classList.remove('temp-heating');
      } else {
        extruderDisplay.classList.remove('temp-heating', 'temp-at-target');
      }
    }
  }

  /**
   * Update fan status displays
   * @param fans - Current fan status data
   */
  private updateFanStatus(fans: FanStatus): void {
    // Update cooling fan speed
    const coolingFanSpeed = this.findElementById('cooling-fan-speed');
    if (coolingFanSpeed) {
      coolingFanSpeed.textContent = fans.coolingFan.toString();
    }

    // Update chamber fan speed
    const chamberFanSpeed = this.findElementById('chamber-fan-speed');
    if (chamberFanSpeed) {
      chamberFanSpeed.textContent = fans.chamberFan.toString();
    }
  }

  /**
   * Update button states based on printer state and connection status
   * @param printerState - Current printer state
   * @param isConnected - Whether printer is connected
   */
  private updateButtonStates(printerState: string, isConnected: boolean): void {
    const buttons = [
      'btn-bed-set',
      'btn-bed-off',
      'btn-extruder-set',
      'btn-extruder-off'
    ];

    // Disable buttons if not connected or in active state
    const shouldDisable = !isConnected || isActiveState(printerState as any);

    buttons.forEach(buttonId => {
      const button = this.findElementById<HTMLButtonElement>(buttonId);
      if (button) {
        button.disabled = shouldDisable;
      }
    });
  }

  /**
   * Handle temperature set button click - opens input dialog
   * @param type - Temperature type ('bed' or 'extruder')
   */
  private async handleTemperatureSet(type: 'bed' | 'extruder'): Promise<void> {
    try {
      // Use the global API exposed by preload script
      if (window.api && window.api.invoke) {
        const command = type === 'bed' ? 'set-bed-temp' : 'set-extruder-temp';
        await window.api.invoke(command);
      }
    } catch (error) {
      console.error(`Failed to set ${type} temperature:`, error);
    }
  }

  /**
   * Handle temperature off button click - sets target to 0
   * @param type - Temperature type ('bed' or 'extruder')
   */
  private async handleTemperatureOff(type: 'bed' | 'extruder'): Promise<void> {
    try {
      // Use the global API exposed by preload script
      if (window.api && window.api.invoke) {
        const command = type === 'bed' ? 'set-bed-temp' : 'set-extruder-temp';
        // Pass 0 as the temperature to turn off
        await window.api.invoke(command, 0);
      }
    } catch (error) {
      console.error(`Failed to turn off ${type} temperature:`, error);
    }
  }
}