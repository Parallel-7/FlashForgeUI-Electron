/**
 * @fileoverview Spoolman Filament Tracker Component
 *
 * GridStack component for displaying active spool selection and integrating with Spoolman server.
 * Shows three states: disabled (integration off), no spool selected, and active spool display
 * with color visualization. Supports per-printer context with main process state management.
 *
 * Key Features:
 * - Three visual states: disabled, no spool, active spool
 * - Color-coded spool visualization matching filament color
 * - Integration with Spoolman server for spool selection
 * - Per-context main process storage (no localStorage)
 * - Click-to-open spool selection dialog
 * - Real-time spool data updates from main process
 * - Works even if component not on grid (state in main process)
 */

import type { AppConfig } from '@shared/types/config.js';
import { initializeUniversalLucideIcons } from '../../../renderer/utils/icons.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import type { ActiveSpoolData, SpoolmanStationStatus } from './types.js';
import './spoolman.css';

/**
 * Spoolman filament tracker component
 * Displays active spool selection and integrates with Spoolman server
 */
export class SpoolmanComponent extends BaseComponent {
  public readonly componentId = 'spoolman-tracker';
  public readonly templateHTML = `
    <div class="spoolman-component">
      <!-- Disabled state -->
      <div class="spoolman-state spoolman-disabled">
        <i data-lucide="package" class="spoolman-icon"></i>
        <p class="spoolman-message">
          Spoolman integration is disabled.<br>
          Enable in Settings to track filament usage.
        </p>
      </div>

      <!-- No spool selected state -->
      <div class="spoolman-state spoolman-no-spool">
        <button class="btn-set-spool">Set Active Spool</button>
        <p class="spoolman-hint">No active spool selected</p>
      </div>

      <!-- Active spool state -->
      <div class="spoolman-state spoolman-active">
        <button class="btn-settings" title="Change Spool">
          <i data-lucide="settings" class="icon-settings"></i>
        </button>
        <div class="spool-visual">
          <div class="spool-center"></div>
        </div>
        <div class="spool-name"></div>
        <div class="spool-info"></div>
      </div>

      <!-- Material station (per-job tracking) state -->
      <div class="spoolman-state spoolman-station">
        <p class="spoolman-station-note"></p>
        <div class="spoolman-station-job"></div>
        <p class="spoolman-station-summary"></p>
      </div>
    </div>
  `;

  private activeSpool: ActiveSpoolData | null = null;
  private isEnabled = false;
  private contextId: string | null = null;
  private contextEnabled = false;
  private disabledReason: string | null = null;
  /** Per-job tracking view payload (material-station contexts). */
  private stationStatus: SpoolmanStationStatus | null = null;

  // DOM references
  private disabledView: HTMLElement | null = null;
  private noSpoolView: HTMLElement | null = null;
  private activeSpoolView: HTMLElement | null = null;
  private spoolVisual: HTMLElement | null = null;
  private spoolNameText: HTMLElement | null = null;
  private spoolInfoText: HTMLElement | null = null;
  private setSpoolButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;
  private disabledMessageEl: HTMLElement | null = null;
  private stationView: HTMLElement | null = null;
  private stationNoteEl: HTMLElement | null = null;
  private stationJobEl: HTMLElement | null = null;
  private stationSummaryEl: HTMLElement | null = null;

  /**
   * Setup event listeners for spool selection and IPC events
   */
  protected async setupEventListeners(): Promise<void> {
    // Cache DOM references
    this.disabledView = this.findElementByClass('spoolman-disabled');
    this.noSpoolView = this.findElementByClass('spoolman-no-spool');
    this.activeSpoolView = this.findElementByClass('spoolman-active');
    this.spoolVisual = this.findElementByClass('spool-visual');
    this.spoolNameText = this.findElementByClass('spool-name');
    this.spoolInfoText = this.findElementByClass('spool-info');
    this.setSpoolButton = this.findElementByClass('btn-set-spool');
    this.settingsButton = this.findElementByClass('btn-settings');
    this.disabledMessageEl = this.findElementByClass('spoolman-message');
    this.stationView = this.findElementByClass('spoolman-station');
    this.stationNoteEl = this.findElementByClass('spoolman-station-note');
    this.stationJobEl = this.findElementByClass('spoolman-station-job');
    this.stationSummaryEl = this.findElementByClass('spoolman-station-summary');

    // "Set Active Spool" button
    if (this.setSpoolButton) {
      this.setSpoolButton.addEventListener('click', () => {
        void this.openSpoolSelection();
      });
    }

    // Settings cog button
    if (this.settingsButton) {
      this.settingsButton.addEventListener('click', () => {
        void this.openSpoolSelection();
      });
    }

    // Setup IPC event listeners
    this.setupIPCListeners();

    // Initialize Lucide icons for this component and the dialog
    initializeUniversalLucideIcons(
      ['package', 'settings', 'x', 'search', 'alert-triangle'],
      this.container ?? document
    );

    // Load initial state from localStorage
    await this.refreshAvailability();
  }

  /**
   * Setup IPC listeners for spool events from main process
   */
  private setupIPCListeners(): void {
    if (!window.api?.spoolman) {
      console.warn('[SpoolmanComponent] Spoolman API not available');
      return;
    }

    // Listen for spool selection from dialog
    window.api.spoolman.onSpoolSelected((spool: unknown) => {
      this.activeSpool = spool as ActiveSpoolData;
      this.updateView();
      const spoolData = spool as ActiveSpoolData;
      console.log(`[SpoolmanComponent] Active spool selected: ${spoolData.name} (ID: ${spoolData.id})`);
    });

    // Listen for spool updates from main process (after operations)
    window.api.spoolman.onSpoolUpdated?.((updatedSpool: unknown) => {
      this.activeSpool = updatedSpool as ActiveSpoolData | null;
      this.updateView();
      console.log('[SpoolmanComponent] Active spool updated from main process');
    });
  }

  /**
   * Update component with new data
   * @param data - Component update data containing config and context info
   */
  public update(data: ComponentUpdateData): void {
    this.assertInitialized();

    try {
      let availabilityNeedsRefresh = false;

      // Update config state
      if (data.config) {
        const config = data.config as AppConfig;
        const wasEnabled = this.isEnabled;
        this.isEnabled = config.SpoolmanEnabled;

        if (wasEnabled !== this.isEnabled) {
          availabilityNeedsRefresh = true;
        }
      }

      // Store context ID for multi-printer support
      if (data.contextId && typeof data.contextId === 'string' && data.contextId !== this.contextId) {
        this.contextId = data.contextId;
        availabilityNeedsRefresh = true;
      }

      this.updateState(data);

      if (availabilityNeedsRefresh) {
        void this.refreshAvailability();
      }
    } catch (error) {
      console.error(`Error updating ${this.componentId}:`, error);
    }
  }

  /**
   * Update view to show appropriate state (disabled, no spool, or active)
   */
  private updateView(): void {
    // Hide all states
    if (this.disabledView) this.disabledView.style.display = 'none';
    if (this.noSpoolView) this.noSpoolView.style.display = 'none';
    if (this.activeSpoolView) this.activeSpoolView.style.display = 'none';
    if (this.stationView) this.stationView.style.display = 'none';

    // Material-station contexts: per-job tracking view. The single
    // active-spool concept does not apply — slots are assigned via the
    // Material Station editor's "Set from Spoolman" flow.
    if (this.contextEnabled && this.stationStatus) {
      if (this.stationView) this.stationView.style.display = 'flex';
      this.renderStationView();
      return;
    }

    // Show appropriate state
    const disabled = !this.isEnabled || !this.contextEnabled;

    if (disabled) {
      if (this.disabledView) this.disabledView.style.display = 'flex';
      if (this.disabledMessageEl) {
        const fallback = this.isEnabled
          ? 'Spoolman integration is not available for this printer.'
          : 'Spoolman integration is disabled. Enable it in Settings.';
        this.disabledMessageEl.textContent = this.disabledReason || fallback;
      }
    } else if (!this.activeSpool) {
      if (this.noSpoolView) this.noSpoolView.style.display = 'flex';
    } else {
      if (this.activeSpoolView) this.activeSpoolView.style.display = 'flex';
      this.renderActiveSpool();
    }
  }

  /**
   * Render active spool details with color and info
   */
  private renderActiveSpool(): void {
    if (!this.activeSpool) return;

    // Set spool color - ensure # prefix for CSS compatibility (defense in depth)
    const colorHex = this.activeSpool.colorHex?.startsWith('#')
      ? this.activeSpool.colorHex
      : `#${this.activeSpool.colorHex || '666666'}`;
    if (this.spoolVisual) {
      this.spoolVisual.style.backgroundColor = colorHex;
    }

    // Set text content
    const vendorPrefix = this.activeSpool.vendor ? `${this.activeSpool.vendor} ` : '';
    if (this.spoolNameText) {
      this.spoolNameText.textContent = `${vendorPrefix}${this.activeSpool.name}`;
    }

    const material = this.activeSpool.material || 'Unknown';
    const remaining = Math.round(this.activeSpool.remainingWeight);
    if (this.spoolInfoText) {
      this.spoolInfoText.textContent = `${material} - ${remaining}g remaining`;
    }
  }

  /**
   * Render the per-job tracking view for material-station contexts: the
   * explanation, the job tracked now with its spool per tool, and the last
   * deduction summary.
   */
  private renderStationView(): void {
    const station = this.stationStatus;
    if (!station) return;

    if (this.stationNoteEl) {
      this.stationNoteEl.textContent = station.note;
    }

    if (this.stationJobEl) {
      this.stationJobEl.textContent = '';
      const job = station.activeJob;
      if (!job) {
        this.stationJobEl.appendChild(this.createStationRow('Tracked print:', 'None'));
      } else {
        const progress = job.started
          ? job.lastProgress !== null
            ? `${Math.round(job.lastProgress)}%`
            : 'printing'
          : 'waiting to start';
        this.stationJobEl.appendChild(this.createStationRow('Tracked print:', `${job.fileName} (${progress})`));
        for (const tool of job.tools) {
          const estimate = tool.usedG !== null ? ` · ${tool.usedG.toFixed(1)} g` : '';
          this.stationJobEl.appendChild(
            this.createStationRow(`Tool ${tool.toolId + 1} (slot ${tool.slotId}):`, `Spool #${tool.spoolId}${estimate}`)
          );
        }
      }
    }

    if (this.stationSummaryEl) {
      this.stationSummaryEl.textContent = this.describeDeduction(station.lastDeduction);
    }
  }

  private createStationRow(label: string, value: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'spoolman-station-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    return row;
  }

  private describeDeduction(deduction: SpoolmanStationStatus['lastDeduction']): string {
    if (!deduction) {
      return 'No deduction recorded this session.';
    }
    const ending: Record<NonNullable<SpoolmanStationStatus['lastDeduction']>['terminal'], string> = {
      completed: 'completed',
      cancelled: 'was cancelled',
      error: 'stopped with an error',
      interrupted: 'ended while the app was not watching',
    };
    const approximate = deduction.approximate ? ' (approximate)' : '';
    const charged = deduction.tools
      .filter((tool) => tool.status === 'deducted' && tool.amount !== null)
      .map((tool) => `#${tool.spoolId} ${tool.amount}${tool.mode === 'weight' ? ' g' : ' mm'}`)
      .join(', ');
    return (
      `${deduction.fileName} ${ending[deduction.terminal]} at ${Math.round(deduction.progress)}%${approximate}: ` +
      `${deduction.deductedCount} spool(s) charged` +
      (charged ? ` (${charged})` : '') +
      (deduction.skippedCount > 0 ? `, ${deduction.skippedCount} skipped` : '')
    );
  }

  /**
   * Open spool selection dialog via IPC
   */
  private async openSpoolSelection(): Promise<void> {
    if (!this.isEnabled || !this.contextEnabled) {
      return;
    }

    if (window.api?.spoolman) {
      await window.api.spoolman.openSpoolSelection();
    }
  }

  /**
   * Load spool state from main process
   */
  private async loadState(): Promise<void> {
    if (!window.api?.spoolman) {
      console.warn('[SpoolmanComponent] Cannot load state: Spoolman API not available');
      return;
    }

    if (!this.isEnabled || !this.contextEnabled) {
      this.activeSpool = null;
      this.updateView();
      return;
    }

    try {
      // Request active spool from main process for current context
      const spool = await window.api.spoolman.getActiveSpool(this.contextId || undefined);
      this.activeSpool = spool as ActiveSpoolData | null;
      this.updateView();
      console.log('[SpoolmanComponent] Loaded active spool from main process:', spool);
    } catch (error) {
      console.error('[SpoolmanComponent] Failed to load active spool:', error);
    }
  }

  /**
   * Refresh per-context availability for Spoolman integration
   */
  private async refreshAvailability(): Promise<void> {
    if (!this.isEnabled) {
      this.contextEnabled = false;
      this.disabledReason = 'Spoolman integration is disabled. Enable it in Settings.';
      this.activeSpool = null;
      this.updateView();
      return;
    }

    if (!window.api?.spoolman?.getStatus) {
      this.contextEnabled = true;
      this.disabledReason = null;
      await this.loadState();
      return;
    }

    try {
      const status = await window.api.spoolman.getStatus(this.contextId || undefined);
      this.contextEnabled = status.enabled;
      this.disabledReason = status.disabledReason ?? null;
      this.stationStatus = status.station ?? null;

      if (status.enabled) {
        if (this.stationStatus) {
          this.activeSpool = null;
          this.updateView();
        } else {
          await this.loadState();
        }
      } else {
        this.stationStatus = null;
        this.activeSpool = null;
        this.updateView();
      }
    } catch (error) {
      console.error('[SpoolmanComponent] Failed to resolve Spoolman status:', error);
      this.contextEnabled = true;
      this.disabledReason = null;
      await this.loadState();
    }
  }

  /**
   * Helper to find element by class name within component
   */
  private findElementByClass(className: string): HTMLElement | null {
    return this.container?.querySelector(`.${className}`) || null;
  }
}
