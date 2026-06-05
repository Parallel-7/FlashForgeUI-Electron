/**
 * @fileoverview IFS Material Station Component
 *
 * GridStack component for displaying the Intelligent Filament System (IFS)
 * material station status on AD5X printers. Shows real-time slot status,
 * filament types, colors, and active slot information with responsive layouts
 * that adapt to different grid cell sizes.
 *
 * Key Features:
 * - Three visual states: unavailable, disconnected, active
 * - Responsive layouts: horizontal, vertical, square, compact
 * - Real-time material slot visualization with color coding
 * - Active slot highlighting
 * - Per-context availability (only AD5X printers with material station)
 *
 * @module ui/components/ifs-station
 */

import type { AppConfig } from '@shared/types/config.js';
import type { MaterialStationStatus } from '@shared/types/polling.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import type { IFSLayoutMode, MaterialSlot } from './types.js';
import './ifs-station.css';

/** Minimal shape of a spool handed back from the Spoolman picker. */
interface PickedSpool {
  id: number;
  name?: string;
}

/**
 * IFS Material Station component
 * Displays material station status for AD5X printers with responsive layouts
 */
export class IFSStationComponent extends BaseComponent {
  public readonly componentId = 'ifs-station';
  public readonly templateHTML = `
    <div class="ifs-component">
      <!-- Unavailable state (non-AD5X printers) -->
      <div class="ifs-state ifs-unavailable">
        <i data-lucide="grid-3x3" class="ifs-icon"></i>
        <p class="ifs-message">IFS not available on this printer</p>
      </div>

      <!-- Disconnected state -->
      <div class="ifs-state ifs-disconnected">
        <i data-lucide="unplug" class="ifs-icon"></i>
        <p class="ifs-message">Material station disconnected</p>
      </div>

      <!-- Active state -->
      <div class="ifs-state ifs-active">
        <div class="ifs-header">
          <span class="ifs-title">Material Station</span>
          <span class="ifs-active-indicator"></span>
        </div>
        <div class="ifs-slots-container">
          <div class="ifs-slot" data-slot="1">
            <div class="ifs-spool">
              <div class="ifs-spool-center"></div>
            </div>
            <div class="ifs-slot-info">
              <span class="ifs-slot-label">Slot 1</span>
              <span class="ifs-slot-material">Empty</span>
            </div>
          </div>
          <div class="ifs-slot" data-slot="2">
            <div class="ifs-spool">
              <div class="ifs-spool-center"></div>
            </div>
            <div class="ifs-slot-info">
              <span class="ifs-slot-label">Slot 2</span>
              <span class="ifs-slot-material">Empty</span>
            </div>
          </div>
          <div class="ifs-slot" data-slot="3">
            <div class="ifs-spool">
              <div class="ifs-spool-center"></div>
            </div>
            <div class="ifs-slot-info">
              <span class="ifs-slot-label">Slot 3</span>
              <span class="ifs-slot-material">Empty</span>
            </div>
          </div>
          <div class="ifs-slot" data-slot="4">
            <div class="ifs-spool">
              <div class="ifs-spool-center"></div>
            </div>
            <div class="ifs-slot-info">
              <span class="ifs-slot-label">Slot 4</span>
              <span class="ifs-slot-material">Empty</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Component state
  private isAvailable = false;
  private isConnected = false;
  private slots: MaterialSlot[] = [];
  private activeSlot: number | null = null;
  private errorMessage: string | null = null;
  private currentLayout: IFSLayoutMode = 'square';

  // DOM references
  private unavailableView: HTMLElement | null = null;
  private disconnectedView: HTMLElement | null = null;
  private activeView: HTMLElement | null = null;
  private slotsContainer: HTMLElement | null = null;
  private activeIndicator: HTMLElement | null = null;

  // ResizeObserver for responsive layout
  private resizeObserver: ResizeObserver | null = null;

  // Spoolman slot-config state
  private contextId: string | null = null;
  private spoolmanEnabled = false;
  private spoolmanContextEnabled = false;
  /** Slot (1-4) awaiting a spool pick, or null when no editor flow is active. */
  private pendingSlot: number | null = null;
  /** Disposer for the active one-shot "spool picked" listener. */
  private spoolPickedDisposer: (() => void) | null = null;
  /** Currently open slot editor popover element, if any. */
  private editorPopover: HTMLElement | null = null;

  /**
   * Setup event listeners and initialize the component
   */
  protected async setupEventListeners(): Promise<void> {
    // Cache DOM references
    this.unavailableView = this.findElementByClass('ifs-unavailable');
    this.disconnectedView = this.findElementByClass('ifs-disconnected');
    this.activeView = this.findElementByClass('ifs-active');
    this.slotsContainer = this.findElementByClass('ifs-slots-container');
    this.activeIndicator = this.findElementByClass('ifs-active-indicator');

    // Initialize Lucide icons
    this.initializeIcons();

    // Setup resize observer for responsive layout
    this.setupResizeObserver();

    // Wire slot clicks to the "Set from Spoolman" editor
    this.setupSlotInteraction();

    // Initial layout update
    this.updateLayout();
    this.updateView();
  }

  /**
   * Wire click handling on the slots container so a user can open a per-slot
   * editor offering "Set from Spoolman". Uses event delegation so it survives
   * slot re-renders.
   */
  private setupSlotInteraction(): void {
    if (!this.slotsContainer) return;

    this.slotsContainer.addEventListener('click', (event) => {
      const slotEl = (event.target as HTMLElement)?.closest('.ifs-slot') as HTMLElement | null;
      if (!slotEl) return;
      const slotAttr = slotEl.getAttribute('data-slot');
      const slot = slotAttr ? Number.parseInt(slotAttr, 10) : NaN;
      if (!Number.isInteger(slot) || slot < 1 || slot > 4) return;
      this.openSlotEditor(slot, slotEl);
    });
  }

  /**
   * Initialize Lucide icons within the component
   */
  private initializeIcons(): void {
    if (typeof window !== 'undefined' && window.lucide) {
      const icons = this.container?.querySelectorAll('[data-lucide]');
      icons?.forEach((icon) => {
        const iconName = icon.getAttribute('data-lucide');
        if (iconName && window.lucide?.icons?.[iconName]) {
          const svgString = window.lucide.icons[iconName].toString();
          const template = document.createElement('template');
          template.innerHTML = svgString.trim();
          const svgElement = template.content.firstChild as SVGElement;
          if (svgElement) {
            // Copy over classes
            icon.classList.forEach((cls) => svgElement.classList.add(cls));
            icon.replaceWith(svgElement);
          }
        }
      });
    }
  }

  /**
   * Setup ResizeObserver for responsive layout changes
   */
  private setupResizeObserver(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.updateLayout();
    });

    this.resizeObserver.observe(this.container);
  }

  /**
   * Update component with new data
   */
  public update(data: ComponentUpdateData): void {
    this.assertInitialized();

    try {
      // Check material station availability from polling data
      const materialStation = data.pollingData?.materialStation as MaterialStationStatus | null | undefined;

      // Material station is available if we have material station data in polling
      // This implicitly means we're connected to an AD5X-class printer
      this.isAvailable = materialStation !== null && materialStation !== undefined;
      this.isConnected = materialStation?.connected ?? false;
      this.slots = materialStation?.slots ?? [];
      this.activeSlot = materialStation?.activeSlot ?? null;
      this.errorMessage = materialStation?.errorMessage ?? null;

      // Track Spoolman availability for the "Set from Spoolman" affordance
      let availabilityNeedsRefresh = false;
      if (data.config) {
        const config = data.config as AppConfig;
        if (config.SpoolmanEnabled !== this.spoolmanEnabled) {
          this.spoolmanEnabled = config.SpoolmanEnabled;
          availabilityNeedsRefresh = true;
        }
      }
      if (typeof data.contextId === 'string' && data.contextId !== this.contextId) {
        this.contextId = data.contextId;
        availabilityNeedsRefresh = true;
      }

      this.updateState(data);
      this.updateView();

      if (availabilityNeedsRefresh) {
        void this.refreshSpoolmanAvailability();
      }
    } catch (error) {
      console.error(`[IFSStation] Error updating component:`, error);
    }
  }

  /**
   * Resolve whether Spoolman is enabled for the current printer context.
   * Mirrors the gating used by the Spoolman tracker component.
   */
  private async refreshSpoolmanAvailability(): Promise<void> {
    if (!this.spoolmanEnabled || !window.api?.spoolman?.getStatus) {
      this.spoolmanContextEnabled = false;
      return;
    }

    try {
      const status = await window.api.spoolman.getStatus(this.contextId || undefined);
      this.spoolmanContextEnabled = status.enabled;
    } catch (error) {
      console.error('[IFSStation] Failed to resolve Spoolman status:', error);
      this.spoolmanContextEnabled = false;
    }
  }

  /**
   * Check if component is running inside a dialog window
   */
  private isInDialog(): boolean {
    // Check for dialog-specific parent classes
    return Boolean(
      this.container?.closest('.component-wrapper') ||
        this.container?.closest('.dialog-content') ||
        document.querySelector('.dialog-container')
    );
  }

  /**
   * Determine layout mode based on container dimensions
   * - Dialog: Always 2x2 square layout
   * - Grid: Dynamic based on container size
   */
  private determineLayout(): IFSLayoutMode {
    // Dialogs always use square layout
    if (this.isInDialog()) {
      return 'square';
    }

    if (!this.container) return 'square';

    // Get dimensions for grid-based layout detection
    const rect = this.container.getBoundingClientRect();
    let { width, height } = rect;

    // If dimensions are too small, try parent
    if (width < 50 || height < 50) {
      const parentRect = this.container.parentElement?.getBoundingClientRect();
      if (parentRect) {
        width = parentRect.width;
        height = parentRect.height;
      }
    }

    // Still no good dimensions? Default to square
    if (width < 50 || height < 50) {
      return 'square';
    }

    // Very small container - compact mode
    if (width < 160 && height < 120) {
      return 'compact';
    }

    const aspectRatio = width / height;

    // Wide container (aspect ratio > 2) - horizontal 1x4 layout
    if (aspectRatio > 2 && height < 180) {
      return 'horizontal';
    }

    // Tall container (aspect ratio < 0.5) - vertical 4x1 layout
    if (aspectRatio < 0.5 && width < 200) {
      return 'vertical';
    }

    // Default to square/2x2 grid layout
    return 'square';
  }

  /**
   * Update layout based on container size
   */
  private updateLayout(): void {
    const newLayout = this.determineLayout();

    if (newLayout !== this.currentLayout) {
      this.currentLayout = newLayout;

      // Update CSS class on container
      const component = this.container?.querySelector('.ifs-component');
      if (component) {
        component.classList.remove('layout-horizontal', 'layout-vertical', 'layout-square', 'layout-compact');
        component.classList.add(`layout-${newLayout}`);
      }
    }
  }

  /**
   * Update view to show appropriate state
   */
  private updateView(): void {
    // Hide all states first
    if (this.unavailableView) this.unavailableView.style.display = 'none';
    if (this.disconnectedView) this.disconnectedView.style.display = 'none';
    if (this.activeView) this.activeView.style.display = 'none';

    // Show appropriate state
    if (!this.isAvailable) {
      if (this.unavailableView) this.unavailableView.style.display = 'flex';
    } else if (!this.isConnected) {
      if (this.disconnectedView) this.disconnectedView.style.display = 'flex';
    } else {
      if (this.activeView) this.activeView.style.display = 'flex';
      this.renderSlots();
    }
  }

  /**
   * Render all material slots with current data
   */
  private renderSlots(): void {
    if (!this.slotsContainer) return;

    // AD5X has 4 slots with 1-based IDs (1, 2, 3, 4)
    for (let slotNumber = 1; slotNumber <= 4; slotNumber++) {
      const slotElement = this.slotsContainer.querySelector(`[data-slot="${slotNumber}"]`);
      if (!slotElement) continue;

      // Find matching slot data by 1-based slot ID from the API
      const slotData = this.slots.find((s) => s.slotId === slotNumber);

      this.renderSingleSlot(slotElement as HTMLElement, slotNumber, slotData);
    }

    // Update active indicator
    if (this.activeIndicator) {
      if (this.activeSlot !== null && this.activeSlot > 0) {
        this.activeIndicator.textContent = `Active: Slot ${this.activeSlot}`;
        this.activeIndicator.classList.add('visible');
      } else {
        this.activeIndicator.textContent = '';
        this.activeIndicator.classList.remove('visible');
      }
    }
  }

  /**
   * Render a single material slot
   */
  private renderSingleSlot(element: HTMLElement, slotNumber: number, data?: MaterialSlot): void {
    const spoolElement = element.querySelector('.ifs-spool') as HTMLElement;
    const materialElement = element.querySelector('.ifs-slot-material') as HTMLElement;

    // Reset classes
    element.classList.remove('empty', 'active', 'has-material');

    if (!data || data.isEmpty) {
      // Empty slot
      element.classList.add('empty');
      if (spoolElement) {
        spoolElement.style.backgroundColor = '';
      }
      if (materialElement) {
        materialElement.textContent = 'Empty';
      }
    } else {
      // Slot has material
      element.classList.add('has-material');

      // Check if active
      const isActive = data.isActive || this.activeSlot === slotNumber || this.activeSlot === data.slotId;
      if (isActive) {
        element.classList.add('active');
      }

      // Set spool color
      if (spoolElement && data.materialColor) {
        // Ensure color has # prefix for CSS
        const color = data.materialColor.startsWith('#') ? data.materialColor : `#${data.materialColor}`;
        spoolElement.style.backgroundColor = color;
      }

      // Set material type
      if (materialElement) {
        materialElement.textContent = data.materialType || 'Unknown';
      }
    }
  }

  /**
   * Open a small editor popover for a slot offering "Set from Spoolman".
   * Gated on Spoolman being enabled for the current context; otherwise no-op.
   */
  private openSlotEditor(slot: number, slotEl: HTMLElement): void {
    // Only AD5X printers render this component, so the remaining gate is Spoolman.
    if (!this.spoolmanEnabled || !this.spoolmanContextEnabled) {
      return;
    }

    // Toggle: clicking the same slot again closes the editor.
    if (this.editorPopover && this.pendingSlot === slot) {
      this.closeSlotEditor();
      return;
    }

    this.closeSlotEditor();

    const popover = document.createElement('div');
    popover.className = 'ifs-slot-editor';
    popover.innerHTML = `
      <div class="ifs-editor-title">Slot ${slot}</div>
      <button type="button" class="ifs-editor-action">Set from Spoolman</button>
    `;

    const actionBtn = popover.querySelector('.ifs-editor-action') as HTMLButtonElement | null;
    actionBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.startSpoolPick(slot);
    });

    slotEl.appendChild(popover);
    this.editorPopover = popover;

    // Dismiss when clicking elsewhere within the component.
    const onOutside = (e: MouseEvent): void => {
      if (!popover.contains(e.target as Node)) {
        this.closeSlotEditor();
        document.removeEventListener('click', onOutside, true);
      }
    };
    // Defer so the originating click doesn't immediately dismiss it.
    setTimeout(() => document.addEventListener('click', onOutside, true), 0);
  }

  /**
   * Close the slot editor popover if open.
   */
  private closeSlotEditor(): void {
    if (this.editorPopover) {
      this.editorPopover.remove();
      this.editorPopover = null;
    }
  }

  /**
   * Begin the Spoolman pick flow for a slot: register a one-shot listener for the
   * chosen spool, then open the existing spool picker in slot-config mode.
   */
  private async startSpoolPick(slot: number): Promise<void> {
    if (!window.api?.spoolman) return;

    this.closeSlotEditor();
    this.pendingSlot = slot;

    // Replace any stale listener.
    this.spoolPickedDisposer?.();
    this.spoolPickedDisposer = window.api.spoolman.onSpoolPickedForSlot((spool: unknown) => {
      // One-shot: dispose immediately so reopening the picker doesn't double-fire.
      this.spoolPickedDisposer?.();
      this.spoolPickedDisposer = null;
      void this.applyPickedSpool(spool as PickedSpool);
    });

    try {
      await window.api.spoolman.openSpoolSelection('slot-config');
    } catch (error) {
      console.error('[IFSStation] Failed to open spool picker:', error);
      this.spoolPickedDisposer?.();
      this.spoolPickedDisposer = null;
      this.pendingSlot = null;
    }
  }

  /**
   * Apply the picked spool to the pending slot: snap + configure via IPC, confirm
   * with the user, then show the result. The station refreshes via polling.
   */
  private async applyPickedSpool(spool: PickedSpool): Promise<void> {
    const slot = this.pendingSlot;
    this.pendingSlot = null;

    if (slot === null || !spool || typeof spool.id !== 'number') {
      return;
    }

    if (!window.api?.material?.configureSlot) {
      window.api?.loading?.showError('Material control is not available', 4000);
      return;
    }

    // Desktop confirm step before writing to the printer.
    const spoolLabel = spool.name || `spool ${spool.id}`;
    const confirmed = window.confirm(
      `Set Slot ${slot} from "${spoolLabel}"?\n\n` +
        `Its material and color will be snapped to the printer's fixed palette and applied to the slot.`
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await window.api.material.configureSlot(slot, spool.id, this.contextId || undefined);

      if (!result.success) {
        window.api?.loading?.showError(result.error || 'Failed to configure slot', 5000);
        return;
      }

      const spoolName = result.spoolName || spool.name || `spool ${spool.id}`;
      window.api?.loading?.showSuccess(
        `Slot ${result.slot ?? slot} → ${result.material ?? 'material kept'} · ${result.colorName ?? ''}, from ${spoolName}`,
        4000
      );
      // Station UI refreshes on the next poll cycle.
    } catch (error) {
      console.error('[IFSStation] Failed to apply spool to slot:', error);
      window.api?.loading?.showError(error instanceof Error ? error.message : 'Failed to configure slot', 5000);
    }
  }

  /**
   * Helper to find element by class name within component
   */
  private findElementByClass(className: string): HTMLElement | null {
    return this.container?.querySelector(`.${className}`) ?? null;
  }

  /**
   * Cleanup when component is destroyed
   */
  protected cleanup(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.spoolPickedDisposer?.();
    this.spoolPickedDisposer = null;
    this.closeSlotEditor();
    this.pendingSlot = null;
  }
}
