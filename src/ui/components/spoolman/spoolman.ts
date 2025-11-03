/**
 * @fileoverview Spoolman Filament Tracker Component
 *
 * GridStack component for displaying active spool selection and integrating with Spoolman server.
 * Shows three states: disabled (integration off), no spool selected, and active spool display
 * with color visualization. Supports per-printer context with localStorage persistence.
 *
 * Key Features:
 * - Three visual states: disabled, no spool, active spool
 * - Color-coded spool visualization matching filament color
 * - Integration with Spoolman server for spool selection
 * - Per-context localStorage for multi-printer support
 * - Click-to-open spool selection dialog
 * - Real-time spool data updates from main process
 *
 * @module ui/components/spoolman
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { ActiveSpoolData } from './types';
import type { AppConfig } from '../../../types/config';
import type { SpoolResponse } from '../../../types/spoolman';
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
        <div class="spoolman-icon">🧵</div>
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
        <button class="btn-settings" title="Change Spool">⚙️</button>
        <div class="spool-visual">
          <div class="spool-center"></div>
        </div>
        <div class="spool-name"></div>
        <div class="spool-info"></div>
      </div>
    </div>
  `;

  private activeSpool: ActiveSpoolData | null = null;
  private isEnabled = false;
  private contextId: string | null = null;

  // DOM references
  private disabledView: HTMLElement | null = null;
  private noSpoolView: HTMLElement | null = null;
  private activeSpoolView: HTMLElement | null = null;
  private spoolVisual: HTMLElement | null = null;
  private spoolNameText: HTMLElement | null = null;
  private spoolInfoText: HTMLElement | null = null;
  private setSpoolButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;

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

    // Load initial state from localStorage
    await this.loadState();
    this.updateView();
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
    window.api.spoolman.onSpoolSelected((spool: ActiveSpoolData) => {
      this.setActiveSpool(spool);
    });

    // Listen for spool updates from main process (after print completion)
    window.api.spoolman.onSpoolUpdated?.((updatedSpool: SpoolResponse) => {
      if (this.activeSpool && this.activeSpool.id === updatedSpool.id) {
        // Update local data with new remaining values
        this.activeSpool.remainingWeight = updatedSpool.remaining_weight || 0;
        this.activeSpool.remainingLength = updatedSpool.remaining_length || 0;
        this.saveState();
        this.updateView();
      }
    });

    // Listen for clear command (e.g., when spool is deleted)
    window.api.spoolman.onClearActiveSpool?.(() => {
      this.clearActiveSpool();
    });

    // Listen for active spool request from main process
    window.api.spoolman.onGetActiveSpool?.(() => {
      window.api.spoolman.sendActiveSpool?.(this.activeSpool);
    });
  }

  /**
   * Update component with new data
   * @param data - Component update data containing config and context info
   */
  public update(data: ComponentUpdateData): void {
    this.assertInitialized();

    try {
      // Update config state
      if (data.config) {
        const config = data.config as AppConfig;
        const wasEnabled = this.isEnabled;
        this.isEnabled = config.SpoolmanEnabled;

        if (wasEnabled !== this.isEnabled) {
          this.updateView();
        }
      }

      // Store context ID for multi-printer support
      if (data.contextId && data.contextId !== this.contextId) {
        this.contextId = data.contextId;
        void this.loadState(); // Reload spool for new context
      }

      this.updateState(data);
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

    // Show appropriate state
    if (!this.isEnabled) {
      if (this.disabledView) this.disabledView.style.display = 'flex';
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

    // Set spool color
    const colorHex = this.activeSpool.colorHex || '#666666';
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
   * Open spool selection dialog via IPC
   */
  private async openSpoolSelection(): Promise<void> {
    if (window.api?.spoolman) {
      await window.api.spoolman.openSpoolSelection();
    }
  }

  /**
   * Load spool state from localStorage
   */
  private async loadState(): Promise<void> {
    const storageKey = this.getStorageKey();
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        this.activeSpool = JSON.parse(stored);
        this.updateView();
      } catch (error) {
        console.error('[SpoolmanComponent] Failed to parse stored spool data:', error);
        localStorage.removeItem(storageKey);
      }
    }
  }

  /**
   * Save spool state to localStorage
   */
  private saveState(): void {
    if (this.activeSpool) {
      const storageKey = this.getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(this.activeSpool));
    }
  }

  /**
   * Set active spool and persist to localStorage
   * @param spool - Active spool data
   */
  public setActiveSpool(spool: ActiveSpoolData): void {
    this.activeSpool = spool;
    this.saveState();
    this.updateView();
    console.log(`[SpoolmanComponent] Active spool set: ${spool.name} (ID: ${spool.id})`);
  }

  /**
   * Clear active spool and remove from localStorage
   */
  public clearActiveSpool(): void {
    this.activeSpool = null;
    const storageKey = this.getStorageKey();
    localStorage.removeItem(storageKey);
    this.updateView();
    console.log('[SpoolmanComponent] Active spool cleared');
  }

  /**
   * Get active spool data
   * @returns Current active spool or null
   */
  public getActiveSpool(): ActiveSpoolData | null {
    return this.activeSpool;
  }

  /**
   * Get localStorage key for current context
   * @returns Storage key string
   */
  private getStorageKey(): string {
    // Per-context storage key for multi-printer support
    const contextSuffix = this.contextId ? `-${this.contextId}` : '';
    return `spoolman-active-spool${contextSuffix}`;
  }

  /**
   * Helper to find element by class name within component
   */
  private findElementByClass(className: string): HTMLElement | null {
    return this.container?.querySelector(`.${className}`) || null;
  }
}
