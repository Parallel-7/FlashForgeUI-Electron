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
import type { PrinterTemperatures, FanStatus, PrinterState } from '../../../types/polling';
import { formatTemperature, isActiveState } from '../../../types/polling';
import './temperature-controls.css';

/**
 * TemperatureControlsComponent manages printer temperature controls and display
 * Provides interactive temperature setting and real-time monitoring
 */
export class TemperatureControlsComponent extends BaseComponent {
  public readonly componentId = 'temperature-controls';
  public readonly templateHTML = `
    <div class="temperature-controls" role="group" aria-label="Temperature controls">
      <header class="temperature-controls__header">
        <h3 class="temperature-controls__title">Temperature</h3>
      </header>
      <div class="temperature-controls__content">
        <div class="temperature-controls__grid">
          <section class="temp-card temp-card--bed" aria-label="Bed temperature controls">
            <div class="temp-card__meta">
              <span class="temp-card__label">Bed</span>
              <span class="temp-card__reading" id="bed-temp-display">0°C/0°C</span>
            </div>
            <div class="temp-card__actions">
              <button id="btn-bed-set" class="temp-btn temp-btn--primary">Set</button>
              <button id="btn-bed-off" class="temp-btn temp-btn--critical">Off</button>
            </div>
          </section>
          <section class="temp-card temp-card--extruder" aria-label="Extruder temperature controls">
            <div class="temp-card__meta">
              <span class="temp-card__label">Extruder</span>
              <span class="temp-card__reading" id="extruder-temp-display">0°C/0°C</span>
            </div>
            <div class="temp-card__actions">
              <button id="btn-extruder-set" class="temp-btn temp-btn--primary">Set</button>
              <button id="btn-extruder-off" class="temp-btn temp-btn--critical">Off</button>
            </div>
          </section>
        </div>
        <div class="temperature-controls__status" aria-label="Fan status">
          <div class="fan-card" id="cooling-fan-display">
            <span class="fan-card__label">Cooling Fan</span>
            <span class="fan-card__value" id="cooling-fan-speed">0</span>
          </div>
          <div class="fan-card" id="chamber-fan-display">
            <span class="fan-card__label">Chamber Fan</span>
            <span class="fan-card__value" id="chamber-fan-speed">0</span>
          </div>
        </div>
      </div>
    </div>
  `;

  /**
   * Setup event listeners for temperature control buttons
   */
  protected async setupEventListeners(): Promise<void> {
    // Bed temperature controls
    this.addEventListener('#btn-bed-set', 'click', () => {
      void this.handleTemperatureSet('bed');
    });

    this.addEventListener('#btn-bed-off', 'click', () => {
      void this.handleTemperatureOff('bed');
    });

    // Extruder temperature controls
    this.addEventListener('#btn-extruder-set', 'click', () => {
      void this.handleTemperatureSet('extruder');
    });

    this.addEventListener('#btn-extruder-off', 'click', () => {
      void this.handleTemperatureOff('extruder');
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
    const shouldDisable = !isConnected || isActiveState(printerState as PrinterState);

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
      if (window.api && window.api.showInputDialog) {
        const title = type === 'bed' ? 'Set Bed Temperature' : 'Set Extruder Temperature';
        const message = `Enter target temperature for ${type} (°C):`;

        const result = await window.api.showInputDialog({
          title,
          message,
          defaultValue: '0',
          placeholder: 'Temperature in °C'
        });

        if (result !== null) {
          const temperature = parseInt(result, 10);
          if (!isNaN(temperature) && temperature >= 0) {
            const command = type === 'bed' ? 'set-bed-temp' : 'set-extruder-temp';
            await window.api.invoke(command, temperature);
          } else {
            console.error('Invalid temperature entered:', result);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to set ${type} temperature:`, error);
    }
  }

  /**
   * Handle temperature off button click - turns off heating
   * @param type - Temperature type ('bed' or 'extruder')
   */
  private async handleTemperatureOff(type: 'bed' | 'extruder'): Promise<void> {
    try {
      // Use the global API exposed by preload script
      if (window.api && window.api.invoke) {
        const command = type === 'bed' ? 'turn-off-bed-temp' : 'turn-off-extruder-temp';
        await window.api.invoke(command);
      }
    } catch (error) {
      console.error(`Failed to turn off ${type} temperature:`, error);
    }
  }
}
