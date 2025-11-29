/**
 * @fileoverview Edit mode controller for GridStack dashboard
 *
 * Manages the edit mode state for the GridStack dashboard, including CTRL+E
 * keyboard shortcut handling, visual indicators, grid enable/disable coordination,
 * and component palette window management. Provides auto-save on exit and
 * change tracking for unsaved modifications.
 *
 * Key exports:
 * - EditModeController: Main edit mode controller class
 * - editModeController: Singleton instance for application-wide use
 *
 * Features:
 * - CTRL+E (or CMD+E on Mac) keyboard shortcut toggle
 * - Visual edit mode indicator with instructions
 * - Grid editing enable/disable (dragging and resizing)
 * - Component palette window coordination (open on enter, close on exit)
 * - Auto-save on exit with change tracking
 * - Unsaved changes indicator
 * - Reset to default layout
 * - Force save operation
 *
 * Usage:
 * ```typescript
 * import { editModeController } from './EditModeController';
 * import { gridStackManager } from './GridStackManager';
 * import { layoutPersistence } from './LayoutPersistence';
 *
 * // Initialize (call after GridStack and LayoutPersistence)
 * editModeController.initialize(gridStackManager, layoutPersistence);
 *
 * // Programmatically toggle edit mode
 * editModeController.toggle();
 *
 * // Check if edit mode is enabled
 * if (editModeController.isEnabled()) {
 *   console.log('Edit mode active');
 * }
 *
 * // Force save current layout
 * editModeController.forceSave();
 *
 * // Reset to default layout
 * await editModeController.resetToDefault();
 * ```
 *
 * @module ui/gridstack/EditModeController
 */

import type { GridStackManager } from './GridStackManager.js';
import type { LayoutPersistence } from './LayoutPersistence.js';
import type { EditModeState } from './types.js';
import { getLucideIcons, initializeLucideIcons } from '../../renderer/utils/icons.js';

/**
 * Edit mode controller
 * Manages edit mode state and UI for layout editing
 */
export class EditModeController {
  /** GridStack manager instance */
  private gridManager: GridStackManager | null = null;

  /** Layout persistence manager instance */
  private layoutPersistence: LayoutPersistence | null = null;

  /** Whether edit mode can be enabled (requires active printer) */
  private editingAvailable = true;

  /** Current printer serial for per-printer layout saves */
  private activeSerial: string | null = null;

  /** Edit mode indicator element */
  private indicator: HTMLElement | null = null;

  /** Current edit mode state (mutable internally) */
  private state: {
    enabled: boolean;
    enabledAt?: Date;
    hasChanges: boolean;
    changeCount: number;
  } = {
    enabled: false,
    hasChanges: false,
    changeCount: 0,
  };

  /** Keyboard event handler bound to this instance */
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Whether controller is initialized */
  private initialized = false;

  /**
   * Initialize the edit mode controller
   * @param gridManager - GridStack manager instance
   * @param layoutPersistence - Layout persistence manager instance
   */
  initialize(
    gridManager: GridStackManager,
    layoutPersistence: LayoutPersistence
  ): void {
    if (this.initialized) {
      console.warn('EditModeController: Already initialized');
      return;
    }

    this.gridManager = gridManager;
    this.layoutPersistence = layoutPersistence;

    // Create edit mode indicator
    this.createIndicator();

    // Setup keyboard shortcut
    this.setupKeyboardHandler();

    // Setup grid change listener for tracking unsaved changes
    this.setupGridChangeListener();

    this.initialized = true;
    console.log('EditModeController: Initialized successfully');
  }

  /**
   * Create the edit mode indicator element
   */
  private createIndicator(): void {
    // Check if indicator already exists
    let indicator = document.querySelector('.edit-mode-indicator') as HTMLElement;

    if (!indicator) {
      // Create new indicator
      indicator = document.createElement('div');
      indicator.className = 'edit-mode-indicator';
      indicator.style.display = 'none';

      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'edit-mode-icon';
      const iconElement = document.createElement('i');
      iconElement.setAttribute('data-lucide', 'pencil');
      iconWrapper.appendChild(iconElement);

      const textElement = document.createElement('span');
      textElement.className = 'edit-mode-text';
      textElement.textContent = 'Edit Mode - CTRL+E to exit';

      // Create reset button
      const resetButton = document.createElement('button');
      resetButton.className = 'edit-mode-reset-btn';
      resetButton.title = 'Reset to default layout';
      resetButton.type = 'button';
      const resetIcon = document.createElement('i');
      resetIcon.setAttribute('data-lucide', 'rotate-ccw');
      resetButton.appendChild(resetIcon);

      // Add click handler for reset button
      resetButton.addEventListener('click', () => {
        void this.resetToDefault();
      });

      indicator.append(iconWrapper, textElement, resetButton);
      initializeLucideIcons(
        indicator,
        getLucideIcons('pencil', 'rotate-ccw')
      );
      document.body.appendChild(indicator);
    }

    this.indicator = indicator;
  }

  /**
   * Setup keyboard shortcut handler (CTRL+E)
   */
  private setupKeyboardHandler(): void {
    this.keydownHandler = (event: KeyboardEvent): void => {
      // Check for CTRL+E (or CMD+E on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        this.toggle();
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
    console.log('EditModeController: Keyboard handler registered (CTRL+E)');
  }

  /**
   * Setup grid change listener to track modifications
   */
  private setupGridChangeListener(): void {
    if (!this.gridManager) {
      return;
    }

    this.gridManager.onChange(() => {
      if (this.state.enabled) {
        this.state.hasChanges = true;
        this.state.changeCount++;
        console.log(
          `EditModeController: Layout changed (${this.state.changeCount} changes)`
        );
      }
    });
  }

  /**
   * Toggle edit mode on/off
   */
  toggle(): void {
    if (!this.editingAvailable && !this.state.enabled) {
      console.warn('EditModeController: Edit mode unavailable without an active printer');
      return;
    }

    if (this.state.enabled) {
      this.exitEditMode();
    } else {
      this.enterEditMode();
    }
  }

  /**
   * Enter edit mode
   */
  enterEditMode(): void {
    if (!this.gridManager || !this.layoutPersistence) {
      console.error('EditModeController: Not initialized');
      return;
    }

    if (!this.editingAvailable) {
      console.warn('EditModeController: Edit mode unavailable without an active printer');
      return;
    }

    if (this.state.enabled) {
      console.warn('EditModeController: Edit mode already enabled');
      return;
    }

    try {
      // Enable grid editing
      this.gridManager.enable();

      // Show indicator
      if (this.indicator) {
        this.indicator.style.display = 'flex';
      }

      // Update state
      this.state = {
        enabled: true,
        enabledAt: new Date(),
        hasChanges: false,
        changeCount: 0,
      };

      // Add body class for CSS styling
      document.body.classList.add('edit-mode');

      // Open component palette
      if (window.api?.send) {
        console.log('EditModeController: Opening component palette');
        window.api.send('open-component-palette');
      } else {
        console.warn('EditModeController: API not available to open palette');
      }

      console.log('EditModeController: Edit mode enabled');
    } catch (error) {
      console.error('EditModeController: Failed to enter edit mode:', error);
    }
  }

  /**
   * Exit edit mode
   */
  exitEditMode(): void {
    if (!this.gridManager || !this.layoutPersistence) {
      console.error('EditModeController: Not initialized');
      return;
    }

    if (!this.state.enabled) {
      console.warn('EditModeController: Edit mode not enabled');
      return;
    }

    try {
      // Disable grid editing
      this.gridManager.disable();

      // Hide indicator
      if (this.indicator) {
        this.indicator.style.display = 'none';
      }

      // Save layout if there are changes
      if (this.state.hasChanges) {
        console.log('EditModeController: Saving layout changes...');
        this.saveLayout();
      }

      // Update state
      this.state = {
        enabled: false,
        hasChanges: false,
        changeCount: 0,
      };

      // Remove body class
      document.body.classList.remove('edit-mode');

      // Close component palette
      if (window.api?.send) {
        console.log('EditModeController: Closing component palette');
        window.api.send('close-component-palette');
      } else {
        console.warn('EditModeController: API not available to close palette');
      }

      console.log('EditModeController: Edit mode disabled');
    } catch (error) {
      console.error('EditModeController: Failed to exit edit mode:', error);
    }
  }

  /**
   * Save the current layout
   */
  private saveLayout(): void {
    if (!this.gridManager || !this.layoutPersistence) {
      return;
    }

    try {
      // Serialize current grid state
      const widgets = this.gridManager.serialize();

      // Get current layout config
      const currentLayout = this.layoutPersistence.load(this.activeSerial ?? undefined);

      // Create updated layout
      const updatedLayout = {
        ...currentLayout,
        widgets,
        timestamp: new Date().toISOString(),
      };

      // Save immediately (no debouncing on manual save)
      this.layoutPersistence.save(updatedLayout, this.activeSerial ?? undefined, true);

      console.log('EditModeController: Layout saved successfully');
    } catch (error) {
      console.error('EditModeController: Failed to save layout:', error);
    }
  }

  /**
   * Get current edit mode state
   * @returns Current edit mode state
   */
  getState(): EditModeState {
    return { ...this.state };
  }

  /**
   * Check if edit mode is enabled
   * @returns True if edit mode is enabled
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Check if there are unsaved changes
   * @returns True if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.state.hasChanges;
  }

  /**
   * Force save the current layout
   * Useful for manual save operations
   */
  forceSave(): void {
    if (!this.state.enabled) {
      console.warn('EditModeController: Cannot save - edit mode not enabled');
      return;
    }

    console.log('EditModeController: Force saving layout...');
    this.saveLayout();

    // Reset change tracking
    this.state.hasChanges = false;
    this.state.changeCount = 0;
  }

  /**
   * Reset layout to default
   * Prompts for confirmation before resetting
   */
  async resetToDefault(): Promise<boolean> {
    if (!this.layoutPersistence) {
      console.error('EditModeController: Not initialized');
      return false;
    }

    // Confirm with user before resetting
    const confirmed = window.confirm(
      'Reset layout to default? This will reload the page and discard any unsaved changes.'
    );

    if (confirmed) {
      try {
        // Reset to default layout
        this.layoutPersistence.reset(this.activeSerial ?? undefined);

        // Reload the page to apply default layout
        // In Phase 2, we'll implement hot-reload without page refresh
        window.location.reload();

        console.log('EditModeController: Layout reset to default');
        return true;
      } catch (error) {
        console.error('EditModeController: Failed to reset layout:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    // Remove keyboard handler
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    // Remove indicator from DOM
    if (this.indicator && this.indicator.parentNode) {
      this.indicator.parentNode.removeChild(this.indicator);
      this.indicator = null;
    }

    // Exit edit mode if enabled
    if (this.state.enabled) {
      this.exitEditMode();
    }

    // Clear references
    this.gridManager = null;
    this.layoutPersistence = null;
    this.initialized = false;

    console.log('EditModeController: Disposed');
  }

  /**
   * Set whether edit mode can be enabled (based on printer availability)
   */
  setAvailability(available: boolean): void {
    this.editingAvailable = available;
    if (!available && this.state.enabled) {
      this.exitEditMode();
    }
  }

  /**
   * Update the active printer serial used for layout persistence
   */
  setActiveSerial(serial: string | null): void {
    this.activeSerial = serial;
  }
}

/**
 * Global singleton instance of EditModeController
 */
export const editModeController = new EditModeController();
