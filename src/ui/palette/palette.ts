/**
 * @fileoverview Component palette window renderer
 *
 * Presents the list of available dashboard components and exposes simple
 * buttons for adding them to the grid. Component removal is now handled on
 * the grid itself, so this implementation focuses on reflecting component
 * availability and dispatching add requests.
 */

type LucideHelperWindow = Window & {
  lucideHelpers?: {
    initializeLucideIconsFromGlobal?(
      iconNames: string[],
      root?: Document | Element | DocumentFragment
    ): void;
  };
};

interface PaletteAPI {
  close: () => void;
  onUpdateStatus: (callback: (componentsInUse: string[], pinnedComponents?: string[]) => void) => void;
  notifyComponentRemove: (componentId: string) => void;
  notifyComponentAdd: (componentId: string) => void;
  getAvailableComponents: () => Promise<ComponentDefinition[]>;
  notifyOpened: () => void;
  toggleEditMode: () => void;
}

interface ComponentDefinition {
  id: string;
  name: string;
  icon: string;
  category?: string;
}

type PaletteWindow = Window & {
  paletteAPI: PaletteAPI;
  debugPaletteManager?: unknown;
};

const paletteWindow = window as unknown as PaletteWindow & LucideHelperWindow;

interface PaletteState {
  componentsInUse: Set<string>;
  pinnedComponents: Set<string>;
  availableComponents: ComponentDefinition[];
}

class PaletteManager {
  private readonly state: PaletteState = {
    componentsInUse: new Set(),
    pinnedComponents: new Set(),
    availableComponents: []
  };

  private componentListElement: HTMLElement | null = null;
  private closeButtonElement: HTMLElement | null = null;

  async initialize(): Promise<void> {
    console.log('[Palette] Initializing component palette (button mode)...');

    try {
      const paletteAPI = paletteWindow.paletteAPI;
      paletteAPI.notifyOpened();

      this.componentListElement = document.getElementById('component-list');
      this.closeButtonElement = document.getElementById('close-palette');

      if (!this.componentListElement || !this.closeButtonElement) {
        console.error('[Palette] Required DOM elements not found');
        return;
      }

      this.setupCloseButton();
      this.setupKeyboardShortcuts();
      this.setupStatusListener();

      await this.loadComponents();

      console.log('[Palette] Initialization complete');
    } catch (error) {
      console.error('[Palette] Initialization error:', error);
    }
  }

  private async loadComponents(): Promise<void> {
    try {
      const components = await paletteWindow.paletteAPI.getAvailableComponents();
      this.state.availableComponents = components;
      this.renderComponentList();
      console.log(`[Palette] Loaded ${components.length} components`);
    } catch (error) {
      console.error('[Palette] Failed to load components:', error);
      this.showError('Failed to load components');
    }
  }

  private renderComponentList(): void {
    if (!this.componentListElement) {
      return;
    }

    this.componentListElement.innerHTML = '';

    if (this.state.availableComponents.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'component-list-empty';
      emptyState.textContent = 'No components available';
      this.componentListElement.appendChild(emptyState);
      return;
    }

    this.state.availableComponents.forEach((component) => {
      const item = this.createComponentItem(component);
      this.componentListElement!.appendChild(item);
    });
  }

  private createComponentItem(component: ComponentDefinition): HTMLElement {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.setAttribute('data-component-id', component.id);

    const isInUse = this.state.componentsInUse.has(component.id);
    const isPinned = this.state.pinnedComponents.has(component.id);

    if (isInUse) {
      item.classList.add('in-use');
    }
    if (isPinned) {
      item.classList.add('pinned');
    }

    const icon = document.createElement('div');
    icon.className = 'palette-item-icon';
    const iconsToHydrate: string[] = [];
    if (component.icon) {
      const iconElement = document.createElement('i');
      iconElement.setAttribute('data-lucide', component.icon);
      icon.appendChild(iconElement);
      iconsToHydrate.push(component.icon);
    }

    const label = document.createElement('div');
    label.className = 'palette-item-label';
    label.textContent = component.name;

    // Status badge
    const statusBadge = document.createElement('div');
    statusBadge.className = 'palette-item-status';
    if (isPinned) {
      const pinIcon = document.createElement('i');
      pinIcon.setAttribute('data-lucide', 'pin');
      statusBadge.appendChild(pinIcon);
      statusBadge.appendChild(document.createTextNode('Pinned'));
      iconsToHydrate.push('pin');
    } else if (isInUse) {
      const checkIcon = document.createElement('i');
      checkIcon.setAttribute('data-lucide', 'check');
      statusBadge.appendChild(checkIcon);
      statusBadge.appendChild(document.createTextNode('In Grid'));
      iconsToHydrate.push('check');
    } else {
      statusBadge.textContent = 'Available';
    }

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'palette-item-action';

    // Disable button if component is in use or pinned
    const isUnavailable = isInUse || isPinned;
    actionButton.textContent = isPinned ? 'Pinned' : (isInUse ? 'Added' : 'Add');
    actionButton.disabled = isUnavailable;

    if (isUnavailable) {
      actionButton.setAttribute('aria-disabled', 'true');
    } else {
      actionButton.addEventListener('click', () => {
        actionButton.disabled = true;
        actionButton.textContent = 'Adding…';
        this.handleAddComponent(component.id);
      });
    }

    item.appendChild(icon);
    item.appendChild(label);
    item.appendChild(statusBadge);
    item.appendChild(actionButton);

    if (iconsToHydrate.length > 0) {
      paletteWindow.lucideHelpers?.initializeLucideIconsFromGlobal?.(iconsToHydrate, item);
    }

    return item;
  }

  private handleAddComponent(componentId: string): void {
    console.log('[Palette] Add requested for component:', componentId);
    paletteWindow.paletteAPI.notifyComponentAdd(componentId);
  }

  private setupCloseButton(): void {
    if (!this.closeButtonElement) {
      return;
    }

    this.closeButtonElement.addEventListener('click', () => {
      console.log('[Palette] Close button clicked');
      paletteWindow.paletteAPI.close();
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'e') {
        event.preventDefault();
        console.log('[Palette] CTRL+E detected - toggling edit mode');
        paletteWindow.paletteAPI.toggleEditMode();
      }
    });
  }

  private setupStatusListener(): void {
    paletteWindow.paletteAPI.onUpdateStatus((componentsInUse: string[], pinnedComponents?: string[]) => {
      console.log('[Palette] Status update received:', componentsInUse, pinnedComponents);
      this.updateComponentStatus(componentsInUse, pinnedComponents);
    });
  }

  updateComponentStatus(componentsInUse: string[], pinnedComponents?: string[]): void {
    this.state.componentsInUse = new Set(componentsInUse);
    this.state.pinnedComponents = new Set(pinnedComponents || []);
    this.renderComponentList();
  }

  private showError(message: string): void {
    if (this.componentListElement) {
      this.componentListElement.innerHTML = `
        <div class="component-list-error">${message}</div>
      `;
    }
  }

  dispose(): void {
    this.state.componentsInUse.clear();
    this.componentListElement = null;
    this.closeButtonElement = null;
  }
}

const paletteManager = new PaletteManager();
paletteWindow.debugPaletteManager = paletteManager;

document.addEventListener('DOMContentLoaded', async () => {
  await paletteManager.initialize();
  paletteWindow.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x', 'pin', 'check']);
});

window.addEventListener('beforeunload', () => {
  paletteManager.dispose();
});
