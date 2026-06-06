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

import { IFS_COLORS, IFS_MATERIALS, nearestColor, nearestMaterial } from '@shared/ifs-palette.js';
import type { MaterialStationStatus } from '@shared/types/polling.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import type { IFSLayoutMode, MaterialSlot } from './types.js';
import './ifs-station.css';

/** Shape of a spool handed back from the Spoolman picker (a subset of ActiveSpoolData). */
interface PickedSpool {
  id: number;
  name?: string;
  material?: string | null;
  colorHex?: string;
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

  // Slot editor state
  private contextId: string | null = null;
  /** Slot (1-4) currently being edited, or null when the dialog is closed. */
  private pendingSlot: number | null = null;
  /** Disposer for the active one-shot "spool picked" listener. */
  private spoolPickedDisposer: (() => void) | null = null;
  /** Currently open slot editor dialog (backdrop) element, if any. */
  private dialogEl: HTMLElement | null = null;
  /** Escape-key handler for the open dialog, if any. */
  private dialogKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** Material currently selected in the open dialog. */
  private dialogMaterial = '';
  /** Color hex currently selected in the open dialog (with leading #), or null. */
  private dialogColorHex: string | null = null;

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
   * Wire click handling on the slots container so a user can open the per-slot
   * editor dialog. Uses event delegation so it survives slot re-renders.
   */
  private setupSlotInteraction(): void {
    if (!this.slotsContainer) return;

    this.slotsContainer.addEventListener('click', (event) => {
      const slotEl = (event.target as HTMLElement)?.closest('.ifs-slot') as HTMLElement | null;
      if (!slotEl) return;
      const slotAttr = slotEl.getAttribute('data-slot');
      const slot = slotAttr ? Number.parseInt(slotAttr, 10) : NaN;
      if (!Number.isInteger(slot) || slot < 1 || slot > 4) return;
      this.openSlotDialog(slot);
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

      // Track the active printer context for slot-config IPC calls (falls back to
      // the active context server-side when null).
      if (typeof data.contextId === 'string' && data.contextId !== this.contextId) {
        this.contextId = data.contextId;
      }

      this.updateState(data);
      this.updateView();
    } catch (error) {
      console.error(`[IFSStation] Error updating component:`, error);
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
   * Open the per-slot editor dialog: a modal with a material dropdown and a grid
   * of the 24 recognized swatches. Pre-seeds from the slot's current material/
   * color. When Spoolman is enabled it also offers a "Set from Spoolman" button
   * that pre-fills the dialog (the user still reviews and applies).
   */
  private openSlotDialog(slot: number): void {
    // Toggle: clicking the same slot while its dialog is open closes it.
    if (this.dialogEl && this.pendingSlot === slot) {
      this.closeSlotDialog();
      return;
    }
    this.closeSlotDialog();
    this.pendingSlot = slot;

    // Seed selections from the slot's current material/color, snapped to the palette.
    const current = this.slots.find((s) => s.slotId === slot && !s.isEmpty);
    const matchedMaterial = current?.materialType ? nearestMaterial(current.materialType) : null;
    this.dialogMaterial = matchedMaterial ?? IFS_MATERIALS[0] ?? 'PLA';
    const matchedColor = current?.materialColor ? nearestColor(current.materialColor) : null;
    this.dialogColorHex = matchedColor?.hex ?? null;

    const backdrop = document.createElement('div');
    backdrop.className = 'ifs-dialog-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'ifs-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const materialOptions = IFS_MATERIALS.map(
      (m) => `<option value="${m}"${m === this.dialogMaterial ? ' selected' : ''}>${m}</option>`
    ).join('');

    const swatches = IFS_COLORS.map(
      (c) =>
        `<button type="button" class="ifs-swatch${c.hex === this.dialogColorHex ? ' selected' : ''}" data-hex="${c.hex}" title="${c.name}" aria-label="${c.name}" style="--swatch:${c.hex}"><span class="ifs-swatch-check">✓</span></button>`
    ).join('');

    dialog.innerHTML = `
      <div class="ifs-dialog-header">
        <span class="ifs-dialog-title">Configure Slot ${slot}</span>
        <button type="button" class="ifs-dialog-close" aria-label="Close">&times;</button>
      </div>
      <div class="ifs-dialog-body">
        <label class="ifs-dialog-field">
          <span class="ifs-dialog-label">Material</span>
          <select class="ifs-dialog-material">${materialOptions}</select>
        </label>
        <div class="ifs-dialog-field">
          <span class="ifs-dialog-label">Color</span>
          <div class="ifs-swatch-grid">${swatches}</div>
        </div>
        <div class="ifs-dialog-preview"></div>
      </div>
      <div class="ifs-dialog-footer">
        <div class="ifs-dialog-footer-right">
          <button type="button" class="ifs-dialog-cancel">Cancel</button>
          <button type="button" class="ifs-dialog-apply">Apply</button>
        </div>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    this.dialogEl = backdrop;

    // Wire controls.
    const select = dialog.querySelector('.ifs-dialog-material') as HTMLSelectElement | null;
    select?.addEventListener('change', () => {
      this.dialogMaterial = select.value;
      this.updateDialogPreviewAndApply();
    });

    dialog.querySelectorAll('.ifs-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        const hex = (el as HTMLElement).getAttribute('data-hex');
        if (hex) this.selectDialogColor(hex);
      });
    });

    (dialog.querySelector('.ifs-dialog-close') as HTMLElement | null)?.addEventListener('click', () =>
      this.closeSlotDialog()
    );
    (dialog.querySelector('.ifs-dialog-cancel') as HTMLElement | null)?.addEventListener('click', () =>
      this.closeSlotDialog()
    );
    (dialog.querySelector('.ifs-dialog-apply') as HTMLElement | null)?.addEventListener('click', () =>
      void this.applyManualSlot(slot)
    );

    // Click on the backdrop (outside the dialog) dismisses.
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeSlotDialog();
    });

    // Escape dismisses.
    this.dialogKeyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') this.closeSlotDialog();
    };
    document.addEventListener('keydown', this.dialogKeyHandler, true);

    this.updateDialogPreviewAndApply();

    // Resolve Spoolman availability live (config isn't pushed to components after
    // creation), and inject the "Set from Spoolman" shortcut if it's enabled.
    void this.maybeAddSpoolmanShortcut(slot, dialog);
  }

  /**
   * If Spoolman is enabled and a server URL is configured, inject a "Set from
   * Spoolman" shortcut into the open dialog's footer. Done asynchronously because
   * Spoolman config is not delivered via polling updates.
   *
   * NOTE: this intentionally gates on the global Spoolman config (enabled + URL),
   * NOT on `spoolman.getStatus()`. That status reflects active-spool *tracking*
   * availability, which the backend disables for AD5X material-station printers —
   * i.e. exactly the printers this slot-config feature targets. The spool picker
   * only needs the integration enabled with a reachable server.
   */
  private async maybeAddSpoolmanShortcut(slot: number, dialog: HTMLElement): Promise<void> {
    if (!window.api?.config?.get) return;

    let enabled = false;
    try {
      const config = (await window.api.config.get()) as {
        SpoolmanEnabled?: boolean;
        SpoolmanServerUrl?: string;
      } | null;
      enabled = Boolean(config?.SpoolmanEnabled) && Boolean(config?.SpoolmanServerUrl);
    } catch (error) {
      console.error('[IFSStation] Spoolman config check failed:', error);
      return;
    }

    // Bail if the dialog closed or switched slots while we awaited.
    if (!enabled || !this.dialogEl || this.pendingSlot !== slot) return;

    const footer = dialog.querySelector('.ifs-dialog-footer');
    if (!footer || footer.querySelector('.ifs-dialog-spoolman')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ifs-dialog-spoolman';
    btn.textContent = 'Set from Spoolman';
    btn.addEventListener('click', () => void this.startSpoolPick());
    footer.insertBefore(btn, footer.firstChild);
  }

  /**
   * Mark a swatch as selected and refresh the preview/apply state.
   */
  private selectDialogColor(hex: string): void {
    this.dialogColorHex = hex;
    if (this.dialogEl) {
      this.dialogEl.querySelectorAll('.ifs-swatch').forEach((el) => {
        const btn = el as HTMLElement;
        btn.classList.toggle('selected', btn.getAttribute('data-hex') === hex);
      });
    }
    this.updateDialogPreviewAndApply();
  }

  /**
   * Update the dialog preview line and enable Apply only once a color is chosen.
   */
  private updateDialogPreviewAndApply(): void {
    if (!this.dialogEl) return;
    const preview = this.dialogEl.querySelector('.ifs-dialog-preview') as HTMLElement | null;
    const applyBtn = this.dialogEl.querySelector('.ifs-dialog-apply') as HTMLButtonElement | null;
    const colorName = this.dialogColorHex
      ? (IFS_COLORS.find((c) => c.hex === this.dialogColorHex)?.name ?? this.dialogColorHex)
      : null;
    if (preview) {
      preview.textContent = colorName
        ? `Slot ${this.pendingSlot} → ${this.dialogMaterial} · ${colorName}`
        : 'Pick a color to continue';
    }
    if (applyBtn) applyBtn.disabled = !this.dialogColorHex;
  }

  /**
   * Apply the dialog's chosen material + color to the slot via the manual
   * (Spoolman-independent) IPC path. The station refreshes on the next poll.
   */
  private async applyManualSlot(slot: number): Promise<void> {
    if (!this.dialogColorHex || !this.dialogMaterial) return;

    if (!window.api?.material?.setSlot) {
      window.api?.loading?.showError('Material control is not available', 4000);
      return;
    }

    const material = this.dialogMaterial;
    const hex = this.dialogColorHex;
    const colorName = IFS_COLORS.find((c) => c.hex === hex)?.name ?? hex;
    this.closeSlotDialog();

    try {
      const result = await window.api.material.setSlot(slot, material, hex, this.contextId || undefined);
      if (!result.success) {
        window.api?.loading?.showError(result.error || 'Failed to configure slot', 5000);
        return;
      }
      window.api?.loading?.showSuccess(`Slot ${slot} → ${material} · ${colorName}`, 4000);
    } catch (error) {
      console.error('[IFSStation] Failed to set slot:', error);
      window.api?.loading?.showError(
        error instanceof Error ? error.message : 'Failed to configure slot',
        5000
      );
    }
  }

  /**
   * Open the existing Spoolman picker (slot-config mode) and, once a spool is
   * chosen, pre-fill the open dialog by snapping its material/color to the
   * fixed palette. The dialog stays open so the user can review and apply.
   */
  private async startSpoolPick(): Promise<void> {
    if (!window.api?.spoolman) return;

    // Replace any stale listener; register a one-shot for the chosen spool.
    this.spoolPickedDisposer?.();
    this.spoolPickedDisposer = window.api.spoolman.onSpoolPickedForSlot((spool: unknown) => {
      this.spoolPickedDisposer?.();
      this.spoolPickedDisposer = null;
      this.prefillFromSpool(spool as PickedSpool);
    });

    try {
      await window.api.spoolman.openSpoolSelection('slot-config');
    } catch (error) {
      console.error('[IFSStation] Failed to open spool picker:', error);
      this.spoolPickedDisposer?.();
      this.spoolPickedDisposer = null;
    }
  }

  /**
   * Snap a picked spool's material/color to the fixed palette and pre-fill the
   * open dialog. Material that does not resolve is left as the current choice.
   */
  private prefillFromSpool(spool: PickedSpool): void {
    if (!this.dialogEl || this.pendingSlot === null || !spool) return;

    if (spool.material) {
      const matched = nearestMaterial(spool.material);
      if (matched) {
        this.dialogMaterial = matched;
        const select = this.dialogEl.querySelector('.ifs-dialog-material') as HTMLSelectElement | null;
        if (select) select.value = matched;
      }
    }

    if (spool.colorHex) {
      const snapped = nearestColor(spool.colorHex);
      if (snapped) this.selectDialogColor(snapped.hex);
    }

    this.updateDialogPreviewAndApply();
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

    this.closeSlotDialog();
  }

  /**
   * Close the slot editor dialog (if open) and tear down its listeners.
   */
  private closeSlotDialog(): void {
    if (this.dialogEl) {
      this.dialogEl.remove();
      this.dialogEl = null;
    }
    if (this.dialogKeyHandler) {
      document.removeEventListener('keydown', this.dialogKeyHandler, true);
      this.dialogKeyHandler = null;
    }
    this.spoolPickedDisposer?.();
    this.spoolPickedDisposer = null;
    this.pendingSlot = null;
    this.dialogColorHex = null;
    this.dialogMaterial = '';
  }
}
