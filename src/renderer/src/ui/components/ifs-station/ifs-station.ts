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

import type { MaterialStationStatus } from '@shared/types/polling.js';
import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import type { IFSLayoutMode, MaterialSlot } from './types.js';
import './ifs-station.css';

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

    // Initial layout update
    this.updateLayout();
    this.updateView();
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
  }
}
