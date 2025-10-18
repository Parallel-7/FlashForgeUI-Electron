/**
 * @fileoverview Component Palette window renderer process
 *
 * Manages the Component Palette UI, including component list rendering,
 * drag-and-drop interactions, trash zone handling, and status synchronization
 * with the main window's grid. Displays available dashboard components that
 * can be dragged onto the grid for customization.
 *
 * Features:
 * - Dynamic component list rendering from component registry
 * - Drag-and-drop to main grid with visual feedback
 * - Trash zone for component removal via drag-and-drop
 * - Real-time status sync (available/in-use indicators)
 * - Loading states and error handling
 * - Beautiful animations and hover effects
 * - Close button for palette dismissal
 *
 * Component States:
 * - Available: Can be dragged to grid (draggable, normal opacity)
 * - In-use: Already on grid (non-draggable, reduced opacity)
 *
 * Drag-and-Drop Flow:
 * 1. User drags component from palette (dragstart event)
 * 2. Drag data includes component ID and metadata in JSON format
 * 3. Main window receives drop event and adds component to grid
 * 4. Main window broadcasts status update to palette
 * 5. Palette updates component to "in-use" state
 *
 * Trash Zone Flow:
 * 1. User drags component from grid to palette trash zone
 * 2. Palette receives drop event with component ID
 * 3. Palette notifies main window via IPC to remove component
 * 4. Main window removes component and broadcasts status update
 * 5. Palette updates component to "available" state
 *
 * IPC Communication:
 * - Outbound: Component removal requests, palette opened notification, close requests
 * - Inbound: Component definitions query, status updates from main window
 *
 * @module ui/palette/palette
 */

// Type definitions for palette API (exposed via preload)
interface PaletteAPI {
  close: () => void;
  onUpdateStatus: (callback: (componentsInUse: string[]) => void) => void;
  notifyComponentRemove: (componentId: string) => void;
  getAvailableComponents: () => Promise<ComponentDefinition[]>;
  notifyOpened: () => void;
  toggleEditMode: () => void;
  onGridDragStateChange: (
    callback: (state: GridDragState) => void
  ) => (() => void) | void;
  getCurrentDragComponent: () => string | null;
}

// Component definition interface
interface ComponentDefinition {
  id: string;
  name: string;
  icon: string;
  category?: string;
}

interface GridDragPointer {
  screenX: number;
  screenY: number;
}

interface GridDragState {
  componentId: string | null;
  dragging: boolean;
  pointer?: GridDragPointer;
  overPalette?: boolean;
  overTrash?: boolean;
}

type PaletteWindow = Window & {
  paletteAPI: PaletteAPI;
  debugPaletteManager?: unknown;
  currentGridDragComponentId?: string | null;
};

const paletteWindow = window as unknown as PaletteWindow;

/**
 * Palette state management
 */
interface PaletteState {
  componentsInUse: Set<string>;
  availableComponents: ComponentDefinition[];
}

/**
 * Main palette manager class
 */
class PaletteManager {
  private state: PaletteState = {
    componentsInUse: new Set(),
    availableComponents: []
  };

  private componentListElement: HTMLElement | null = null;
  private trashZoneElement: HTMLElement | null = null;
  private closeButtonElement: HTMLElement | null = null;
  private currentGridDragState: GridDragState = {
    componentId: null,
    dragging: false,
    overPalette: false,
    overTrash: false
  };
  private removeGridDragListener: (() => void) | null = null;
  private lastGridRemoval: { componentId: string; timestamp: number } | null = null;

  /**
   * Initialize the palette window
   */
  async initialize(): Promise<void> {
    console.log('[Palette] Initializing component palette...');

    try {
      // Notify main window that palette is open
      const paletteAPI = paletteWindow.paletteAPI;
      if (paletteAPI?.notifyOpened) {
        paletteAPI.notifyOpened();
      }

      // Get DOM elements
      this.componentListElement = document.getElementById('component-list');
      this.trashZoneElement = document.getElementById('trash-zone');
      this.closeButtonElement = document.getElementById('close-palette');

      if (!this.componentListElement || !this.trashZoneElement || !this.closeButtonElement) {
        console.error('[Palette] Required DOM elements not found');
        return;
      }

      // Setup event handlers
      this.setupCloseButton();
      this.setupTrashZone();
      this.setupKeyboardShortcuts();

      // Load and render components
      await this.loadComponents();

      // Setup IPC listeners for component status updates
      this.setupStatusListener();
      this.setupGridDragStateListener();

      console.log('[Palette] Initialization complete');
    } catch (error) {
      console.error('[Palette] Initialization error:', error);
    }
  }

  /**
   * Load available components from main process
   */
  private async loadComponents(): Promise<void> {
    try {
      // Get component definitions from main process
      this.state.availableComponents = await paletteWindow.paletteAPI.getAvailableComponents();
      console.log('[Palette] Loaded components:', this.state.availableComponents);

      // Render component list
      this.renderComponentList();
    } catch (error) {
      console.error('[Palette] Failed to load components:', error);
      this.showError('Failed to load components');
    }
  }

  /**
   * Render the component list UI
   */
  private renderComponentList(): void {
    if (!this.componentListElement) return;

    // Clear existing content
    this.componentListElement.innerHTML = '';

    // Create component items
    this.state.availableComponents.forEach(component => {
      const itemElement = this.createComponentItem(component);
      this.componentListElement!.appendChild(itemElement);
    });

    console.log(`[Palette] Rendered ${this.state.availableComponents.length} components`);
  }

  /**
   * Create a draggable component item element
   */
  private createComponentItem(component: ComponentDefinition): HTMLElement {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-component-id', component.id);

    // Check if component is in use
    const isInUse = this.state.componentsInUse.has(component.id);
    if (isInUse) {
      item.classList.add('in-use');
      item.setAttribute('draggable', 'false');
    }

    // Create icon
    const icon = document.createElement('div');
    icon.className = 'palette-item-icon';
    icon.textContent = component.icon;

    // Create label
    const label = document.createElement('div');
    label.className = 'palette-item-label';
    label.textContent = component.name;

    // Assemble item
    item.appendChild(icon);
    item.appendChild(label);

    // Setup drag handlers
    if (!isInUse) {
      this.setupDragHandlers(item, component);
    }

    return item;
  }

  /**
   * Setup drag event handlers for a component item
   */
  private setupDragHandlers(item: HTMLElement, component: ComponentDefinition): void {
    item.addEventListener('dragstart', (e: DragEvent) => {
      if (e.dataTransfer) {
        // Set drag data with component information
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'palette-component',
          componentId: component.id,
          componentName: component.name,
          componentIcon: component.icon
        }));
        e.dataTransfer.setData('text/plain', `palette-component:${component.id}`);
        try {
          e.dataTransfer.setData('text/flashforge-component', component.id);
        } catch (error) {
          console.debug('[Palette] Unable to set custom drag data type:', error);
        }

        // Add visual feedback
        item.classList.add('dragging');
        console.log('[Palette] Started dragging component:', component.id);
      }
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      console.log('[Palette] Ended dragging component');
    });
  }

  /**
   * Setup trash zone drop handlers
   */
  private setupTrashZone(): void {
    if (!this.trashZoneElement) return;

    this.trashZoneElement.addEventListener('dragover', (e: DragEvent) => {
      const componentId = this.getComponentIdFromDropEvent(e);
      if (!componentId) {
        return;
      }

      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      this.trashZoneElement!.classList.add('drag-over');
    });

    this.trashZoneElement.addEventListener('dragleave', (event: DragEvent) => {
      if (event.currentTarget === event.target) {
        this.trashZoneElement!.classList.remove('drag-over');
      }
    });

    this.trashZoneElement.addEventListener('drop', (e: DragEvent) => {
      const componentId = this.getComponentIdFromDropEvent(e);

      e.preventDefault();
      this.clearGridDragVisuals();

      if (!componentId) {
        console.warn('[Palette] Drop ignored - no component ID available');
        return;
      }

      this.handleGridComponentRemoval(componentId);
    });
  }

  /**
   * Setup close button handler
   */
  private setupCloseButton(): void {
    if (!this.closeButtonElement) return;

    this.closeButtonElement.addEventListener('click', () => {
      console.log('[Palette] Close button clicked');
      paletteWindow.paletteAPI.close();
    });
  }

  /**
   * Setup keyboard shortcuts for palette window
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // CTRL+E - Toggle edit mode
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        console.log('[Palette] CTRL+E detected - toggling edit mode');
        paletteWindow.paletteAPI.toggleEditMode();
      }
    });

    console.log('[Palette] Keyboard shortcuts setup complete (CTRL+E)');
  }

  /**
   * Setup IPC listener for component status updates
   */
  private setupStatusListener(): void {
    paletteWindow.paletteAPI.onUpdateStatus((componentsInUse: string[]) => {
      console.log('[Palette] Received status update:', componentsInUse);
      this.updateComponentStatus(componentsInUse);
    });
  }

  /**
   * Listen for grid drag state updates from main window
   * Enables trash zone fallback when DataTransfer data is unavailable
   */
  private setupGridDragStateListener(): void {
    if (!paletteWindow.paletteAPI.onGridDragStateChange) {
      console.warn('[Palette] Grid drag state API not available');
      return;
    }

    // Remove existing listener if present
    if (this.removeGridDragListener) {
      this.removeGridDragListener();
      this.removeGridDragListener = null;
    }

    const unsubscribe = paletteWindow.paletteAPI.onGridDragStateChange((state: GridDragState) => {
      const evaluatedState = this.evaluateGridDragState(state);

      this.currentGridDragState = evaluatedState;
      paletteWindow.currentGridDragComponentId = evaluatedState.dragging
        ? evaluatedState.componentId
        : null;

      this.applyTrashZoneVisualState(evaluatedState);

      if (!evaluatedState.dragging) {
        this.handleGridDragEnd(evaluatedState);
      }
    });

    if (typeof unsubscribe === 'function') {
      this.removeGridDragListener = unsubscribe;
    }
  }

  /**
   * Enrich drag state with palette-specific calculations
   */
  private evaluateGridDragState(state: GridDragState): GridDragState {
    const pointer = state.pointer;
    let overPalette = false;
    let overTrash = false;

    if (pointer) {
      overPalette = this.isPointInsideWindow(pointer);
      overTrash = overPalette && this.isPointInsideTrashZone(pointer);
    }

    return {
      ...state,
      overPalette,
      overTrash
    };
  }

  /**
   * Update trash zone visuals based on current drag state
   */
  private applyTrashZoneVisualState(state: GridDragState): void {
    if (!this.trashZoneElement) {
      return;
    }

    if (state.dragging && (state.overPalette || state.overTrash)) {
      this.trashZoneElement.classList.add('grid-drag-active');
    } else {
      this.trashZoneElement.classList.remove('grid-drag-active');
    }

    if (state.dragging && state.overTrash) {
      this.trashZoneElement.classList.add('drag-over');
    } else if (!state.dragging || !state.overTrash) {
      this.trashZoneElement.classList.remove('drag-over');
    }
  }

  /**
   * Handle end of grid drag operation (mouse released)
   */
  private handleGridDragEnd(state: GridDragState): void {
    if (state.overTrash && state.componentId) {
      this.handleGridComponentRemoval(state.componentId);
    }

    this.clearGridDragVisuals();
    paletteWindow.currentGridDragComponentId = null;
    this.currentGridDragState = {
      componentId: null,
      dragging: false,
      overPalette: false,
      overTrash: false
    };
  }

  /**
   * Notify main window to remove grid component once
   */
  private handleGridComponentRemoval(componentId: string): void {
    const now = Date.now();
    if (
      this.lastGridRemoval &&
      this.lastGridRemoval.componentId === componentId &&
      now - this.lastGridRemoval.timestamp < 250
    ) {
      return;
    }

    this.lastGridRemoval = { componentId, timestamp: now };

    console.log('[Palette] Component dropped in trash:', componentId);
    paletteWindow.paletteAPI.notifyComponentRemove(componentId);
  }

  /**
   * Remove drag-related visual indicators
   */
  private clearGridDragVisuals(): void {
    if (!this.trashZoneElement) {
      return;
    }

    this.trashZoneElement.classList.remove('grid-drag-active');
    this.trashZoneElement.classList.remove('drag-over');
  }

  /**
   * Determine whether pointer is within the palette window bounds
   */
  private isPointInsideWindow(pointer: GridDragPointer): boolean {
    const left = window.screenX;
    const top = window.screenY;
    const right = left + window.innerWidth;
    const bottom = top + window.innerHeight;

    return (
      pointer.screenX >= left &&
      pointer.screenX <= right &&
      pointer.screenY >= top &&
      pointer.screenY <= bottom
    );
  }

  /**
   * Determine whether pointer is within the trash zone bounds
   */
  private isPointInsideTrashZone(pointer: GridDragPointer): boolean {
    if (!this.trashZoneElement) {
      return false;
    }

    const rect = this.trashZoneElement.getBoundingClientRect();
    const left = window.screenX + rect.left;
    const top = window.screenY + rect.top;
    const right = left + rect.width;
    const bottom = top + rect.height;

    return (
      pointer.screenX >= left &&
      pointer.screenX <= right &&
      pointer.screenY >= top &&
      pointer.screenY <= bottom
    );
  }

  /**
   * Update component availability status
   */
  updateComponentStatus(componentsInUse: string[]): void {
    // Update state
    this.state.componentsInUse = new Set(componentsInUse);

    // Re-render component list to reflect new availability
    this.renderComponentList();

    console.log(`[Palette] Updated status: ${componentsInUse.length} components in use`);
  }

  /**
   * Extract component ID from drag/drop event or current drag state
   * @param event Drag event containing potential DataTransfer payload
   * @returns Component ID if available, otherwise null
   */
  private getComponentIdFromDropEvent(event: DragEvent): string | null {
    const dataTransfer = event.dataTransfer;

    if (dataTransfer) {
      const jsonPayload = dataTransfer.getData('application/json');
      if (jsonPayload && jsonPayload.trim().length > 0) {
        try {
          const parsed = JSON.parse(jsonPayload);
          if (parsed?.type === 'grid-component' && typeof parsed.componentId === 'string') {
            return parsed.componentId;
          }
        } catch {
          // Ignore JSON parse failures - fallback to other strategies
        }
      }

      const textPayload = dataTransfer.getData('text/plain');
      if (textPayload && textPayload.startsWith('grid-component:')) {
        return textPayload.replace('grid-component:', '');
      }
    }

    if (this.currentGridDragState.dragging && this.currentGridDragState.componentId) {
      return this.currentGridDragState.componentId;
    }

    if (paletteWindow.currentGridDragComponentId) {
      return paletteWindow.currentGridDragComponentId;
    }

    if (typeof paletteWindow.paletteAPI.getCurrentDragComponent === 'function') {
      return paletteWindow.paletteAPI.getCurrentDragComponent();
    }

    return null;
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    if (this.componentListElement) {
      this.componentListElement.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #f44336;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          <div>${message}</div>
        </div>
      `;
    }
  }

  /**
   * Cleanup resources before window unload
   */
  dispose(): void {
    if (this.removeGridDragListener) {
      this.removeGridDragListener();
      this.removeGridDragListener = null;
    }
    this.clearGridDragVisuals();
    this.lastGridRemoval = null;
    this.currentGridDragState = {
      componentId: null,
      dragging: false,
      overPalette: false,
      overTrash: false
    };
    paletteWindow.currentGridDragComponentId = null;
  }
}

// Initialize palette when DOM is ready
const paletteManager = new PaletteManager();
paletteWindow.debugPaletteManager = paletteManager;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Palette] DOM content loaded, initializing palette...');
  await paletteManager.initialize();
});

window.addEventListener('beforeunload', () => {
  paletteManager.dispose();
});
