/**
 * @fileoverview Creator 5 Temperature Card
 *
 * Unified, interactive temperature card for the Creator 5 / 5 Pro tool-changer:
 * the 4 tool heads (T0–T3), the heated bed, and the heated chamber — each with
 * current/target readings and Set/Off controls.
 *
 * Replaces the generic `temperature-controls` + read-only `tool-temps` cards for
 * the Creator 5 series. Self-gates: shows an "unavailable" state for printers
 * that don't report per-tool temperatures.
 *
 * Data source: `pollingData.printerStatus` — `toolTemps[]`, `temperatures.bed`,
 * and `temperatures.chamber`.
 *
 * @module ui/components/creator5-temperature
 */

import type { PrinterState, PrinterStatus, TemperatureData } from '@shared/types/polling.js';
import { formatTemperature, isActiveState } from '@shared/types/polling.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import './creator5-temperature.css';

/** Firmware chamber ceiling. */
const CHAMBER_MAX = 80;

type HeaterTarget =
  | { kind: 'bed' }
  | { kind: 'chamber' }
  | { kind: 'tool'; index: number };

export class Creator5TemperatureComponent extends BaseComponent {
  public readonly componentId = 'creator5-temperature';

  public readonly templateHTML = `
    <div class="c5-temps" role="group" aria-label="Creator 5 temperature controls">
      <div class="panel-header">Temperature</div>
      <div class="c5-temps-unavailable" data-role="unavailable">
        <span>Per-tool temperature control is not available for this printer.</span>
      </div>
      <div class="c5-temps-body" data-role="body">
        <div class="c5-temps-grid" data-role="tool-grid"></div>
        <div class="c5-temps-base">
          <section class="c5-temp-cell c5-temp-cell--bed" data-role="bed">
            <div class="c5-temp-meta">
              <span class="c5-temp-label">Bed</span>
              <span class="c5-temp-reading" data-role="bed-reading">0°C/0°C</span>
            </div>
            <div class="c5-temp-actions">
              <button class="c5-temp-btn c5-temp-btn--primary" data-action="set" data-heater="bed">Set</button>
              <button class="c5-temp-btn c5-temp-btn--critical" data-action="off" data-heater="bed">Off</button>
            </div>
          </section>
          <section class="c5-temp-cell c5-temp-cell--chamber" data-role="chamber">
            <div class="c5-temp-meta">
              <span class="c5-temp-label">Chamber</span>
              <span class="c5-temp-reading" data-role="chamber-reading">0°C/0°C</span>
            </div>
            <div class="c5-temp-actions">
              <button class="c5-temp-btn c5-temp-btn--primary" data-action="set" data-heater="chamber">Set</button>
              <button class="c5-temp-btn c5-temp-btn--critical" data-action="off" data-heater="chamber">Off</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  private bodyEl: HTMLElement | null = null;
  private unavailableEl: HTMLElement | null = null;
  private toolGridEl: HTMLElement | null = null;
  private chamberCellEl: HTMLElement | null = null;
  /** Number of tool cells currently rendered, to avoid rebuilding every poll. */
  private renderedToolCount = -1;

  protected async setupEventListeners(): Promise<void> {
    this.bodyEl = this.findElement('[data-role="body"]');
    this.unavailableEl = this.findElement('[data-role="unavailable"]');
    this.toolGridEl = this.findElement('[data-role="tool-grid"]');
    this.chamberCellEl = this.findElement('[data-role="chamber"]');

    // One delegated click handler for every Set/Off button (bed, chamber, tools).
    const root = this.findElement('.c5-temps');
    root?.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement)?.closest<HTMLButtonElement>('button[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      const target = this.resolveTarget(btn);
      if (!target) return;
      if (action === 'set') void this.handleSet(target);
      else if (action === 'off') void this.handleOff(target);
    });
  }

  /** Resolves a clicked button to its heater target. */
  private resolveTarget(btn: HTMLButtonElement): HeaterTarget | null {
    const heater = btn.dataset.heater;
    if (heater === 'bed') return { kind: 'bed' };
    if (heater === 'chamber') return { kind: 'chamber' };
    if (heater === 'tool') {
      const index = Number.parseInt(btn.dataset.tool ?? '', 10);
      if (Number.isInteger(index)) return { kind: 'tool', index };
    }
    return null;
  }

  public update(data: ComponentUpdateData): void {
    this.assertInitialized();
    try {
      const status = data.pollingData?.printerStatus as PrinterStatus | null | undefined;
      const isConnected = data.pollingData?.isConnected ?? false;
      const toolTemps = status?.toolTemps ?? [];
      const available = isConnected && toolTemps.length > 0;

      this.setAvailability(available);
      if (available && status) {
        this.renderTools(toolTemps);
        this.renderBaseHeater('bed', status.temperatures.bed);
        this.renderChamber(status.temperatures.chamber);
        this.updateButtonStates(status.state, isConnected);
      }

      this.updateState(data);
    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  private setAvailability(available: boolean): void {
    if (this.unavailableEl) this.unavailableEl.style.display = available ? 'none' : 'flex';
    if (this.bodyEl) this.bodyEl.style.display = available ? 'flex' : 'none';
  }

  /** Render (or update) one settable cell per tool. */
  private renderTools(toolTemps: TemperatureData[]): void {
    if (!this.toolGridEl) return;

    if (this.renderedToolCount !== toolTemps.length) {
      this.toolGridEl.innerHTML = toolTemps
        .map(
          (_, i) => `
        <section class="c5-temp-cell c5-temp-cell--tool" data-tool="${i}">
          <div class="c5-temp-meta">
            <span class="c5-temp-label">T${i}</span>
            <span class="c5-temp-reading" data-role="reading">0°C/0°C</span>
          </div>
          <div class="c5-temp-actions">
            <button class="c5-temp-btn c5-temp-btn--primary" data-action="set" data-heater="tool" data-tool="${i}">Set</button>
            <button class="c5-temp-btn c5-temp-btn--critical" data-action="off" data-heater="tool" data-tool="${i}">Off</button>
          </div>
        </section>`
        )
        .join('');
      this.renderedToolCount = toolTemps.length;
    }

    toolTemps.forEach((tool, i) => {
      const cell = this.toolGridEl?.querySelector(`.c5-temp-cell--tool[data-tool="${i}"]`);
      if (!cell) return;
      const reading = cell.querySelector('[data-role="reading"]');
      if (reading) reading.textContent = formatTemperature(tool);
      this.applyHeatingClass(cell, tool);
    });
  }

  private renderBaseHeater(role: 'bed', temp: TemperatureData): void {
    const reading = this.findElement(`[data-role="${role}-reading"]`);
    if (reading) reading.textContent = formatTemperature(temp);
    const cell = this.findElement(`[data-role="${role}"]`);
    if (cell) this.applyHeatingClass(cell, temp);
  }

  private renderChamber(chamber: TemperatureData | undefined): void {
    // Chamber is only present in the status when the printer has a chamber heater.
    if (this.chamberCellEl) this.chamberCellEl.style.display = chamber ? 'flex' : 'none';
    if (!chamber) return;
    const reading = this.findElement('[data-role="chamber-reading"]');
    if (reading) reading.textContent = formatTemperature(chamber);
    if (this.chamberCellEl) this.applyHeatingClass(this.chamberCellEl, chamber);
  }

  private applyHeatingClass(cell: Element, temp: TemperatureData): void {
    const atTarget = temp.target > 0 && Math.abs(temp.current - temp.target) < 2;
    cell.classList.toggle('is-heating', temp.isHeating);
    cell.classList.toggle('is-at-target', atTarget && !temp.isHeating);
    cell.classList.toggle('is-on', temp.target > 0);
  }

  /** Disable Set/Off while printing or disconnected. */
  private updateButtonStates(printerState: string, isConnected: boolean): void {
    const disable = !isConnected || isActiveState(printerState as PrinterState);
    const root = this.findElement('.c5-temps');
    root?.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.disabled = disable;
    });
  }

  private labelFor(target: HeaterTarget): string {
    if (target.kind === 'bed') return 'Bed';
    if (target.kind === 'chamber') return 'Chamber';
    return `Tool T${target.index}`;
  }

  private async handleSet(target: HeaterTarget): Promise<void> {
    try {
      if (!window.api?.showInputDialog) return;
      const label = this.labelFor(target);
      const max = target.kind === 'chamber' ? CHAMBER_MAX : undefined;
      const result = await window.api.showInputDialog({
        title: `Set ${label} Temperature`,
        message: `Enter target temperature for ${label} (°C)${max ? `, max ${max}` : ''}:`,
        defaultValue: '0',
        placeholder: 'Temperature in °C',
      });
      if (result === null) return;

      let temperature = Number.parseInt(result, 10);
      if (Number.isNaN(temperature) || temperature < 0) {
        console.error('Invalid temperature entered:', result);
        return;
      }
      if (max !== undefined && temperature > max) temperature = max;

      await this.invokeForTarget('set', target, temperature);
    } catch (error) {
      console.error(`Failed to set ${this.labelFor(target)} temperature:`, error);
    }
  }

  private async handleOff(target: HeaterTarget): Promise<void> {
    try {
      await this.invokeForTarget('off', target);
    } catch (error) {
      console.error(`Failed to turn off ${this.labelFor(target)}:`, error);
    }
  }

  private async invokeForTarget(
    action: 'set' | 'off',
    target: HeaterTarget,
    temperature?: number
  ): Promise<void> {
    if (!window.api?.invoke) return;
    if (target.kind === 'bed') {
      await window.api.invoke(action === 'set' ? 'set-bed-temp' : 'turn-off-bed-temp', temperature);
    } else if (target.kind === 'chamber') {
      await window.api.invoke(
        action === 'set' ? 'set-chamber-temp' : 'turn-off-chamber-temp',
        temperature
      );
    } else {
      await window.api.invoke(
        action === 'set' ? 'set-tool-temp' : 'turn-off-tool-temp',
        target.index,
        temperature
      );
    }
  }
}
