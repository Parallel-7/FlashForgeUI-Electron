/**
 * @fileoverview Tool Temperatures Component
 *
 * GridStack component that displays per-tool nozzle temperatures for multi-tool
 * printers (Creator 5 series — 4 nozzles). Renders a responsive grid of tool
 * cells, each showing the current and target temperature and a heating state,
 * mirroring the visual language of the material-station card.
 *
 * Data source: `pollingData.printerStatus.toolTemps` (one entry per nozzle).
 * Single-nozzle printers don't report this, so the card shows an "unavailable"
 * state for them.
 *
 * @module ui/components/tool-temps
 */

import type { PrinterStatus, TemperatureData } from '@shared/types/polling.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import './tool-temps.css';

/**
 * Displays per-tool nozzle temperatures in a grid (Creator 5 series).
 */
export class ToolTempsComponent extends BaseComponent {
  public readonly componentId = 'tool-temps';

  public readonly templateHTML = `
    <div class="tool-temps">
      <div class="tool-temps-unavailable" data-role="unavailable">
        <span>Per-tool temperatures are not available for this printer.</span>
      </div>
      <div class="tool-temps-grid" data-role="grid"></div>
    </div>
  `;

  private gridEl: HTMLElement | null = null;
  private unavailableEl: HTMLElement | null = null;
  /** Number of tool cells currently rendered, to avoid rebuilding every poll. */
  private renderedCount = -1;

  protected async setupEventListeners(): Promise<void> {
    this.gridEl = this.findElement('[data-role="grid"]');
    this.unavailableEl = this.findElement('[data-role="unavailable"]');
  }

  public update(data: ComponentUpdateData): void {
    try {
      const printerStatus = data.pollingData?.printerStatus as PrinterStatus | null | undefined;
      const isConnected = data.pollingData?.isConnected ?? false;
      const toolTemps = printerStatus?.toolTemps ?? [];

      const available = isConnected && toolTemps.length > 0;
      this.setAvailability(available);

      if (available) {
        this.renderTools(toolTemps);
      }

      this.updateState(data);
    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  private setAvailability(available: boolean): void {
    if (this.unavailableEl) {
      this.unavailableEl.style.display = available ? 'none' : 'flex';
    }
    if (this.gridEl) {
      this.gridEl.style.display = available ? 'grid' : 'none';
    }
  }

  /**
   * Render (or update) one cell per tool. Rebuilds the cell DOM only when the
   * tool count changes; otherwise updates text/state in place.
   */
  private renderTools(toolTemps: TemperatureData[]): void {
    if (!this.gridEl) return;

    if (this.renderedCount !== toolTemps.length) {
      this.gridEl.innerHTML = toolTemps
        .map(
          (_, i) => `
        <div class="tool-temp-cell" data-tool="${i}">
          <div class="tool-temp-label">T${i}</div>
          <div class="tool-temp-value">
            <span class="tool-temp-current" data-role="current">--</span>
            <span class="tool-temp-sep">/</span>
            <span class="tool-temp-target" data-role="target">--</span>
            <span class="tool-temp-unit">°C</span>
          </div>
        </div>`
        )
        .join('');
      this.renderedCount = toolTemps.length;
    }

    toolTemps.forEach((tool, i) => {
      const cell = this.gridEl?.querySelector(`.tool-temp-cell[data-tool="${i}"]`);
      if (!cell) return;
      const current = cell.querySelector('[data-role="current"]');
      const target = cell.querySelector('[data-role="target"]');
      if (current) current.textContent = `${Math.round(tool.current)}`;
      if (target) target.textContent = `${Math.round(tool.target)}`;
      cell.classList.toggle('is-heating', tool.isHeating);
      cell.classList.toggle('is-active', tool.target > 0);
    });
  }
}
