/**
 * @fileoverview Shell UI controller for renderer chrome and legacy menus.
 *
 * Manages window controls, hamburger menu (including keyboard shortcuts),
 * and the loading overlay that predates the component/GridStack system.
 * All printer-specific controls now live in dedicated components, so this
 * controller only keeps the shared chrome responsibilities.
 */

import { initializeUIAnimations } from '../../services/ui-updater';

const MAIN_MENU_ACTIONS = ['connect', 'settings', 'status', 'ifs', 'pin-config'] as const;
type MainMenuAction = typeof MAIN_MENU_ACTIONS[number];

const MAIN_MENU_ACTION_CHANNELS: Record<MainMenuAction, string> = {
  connect: 'open-printer-selection',
  settings: 'open-settings-window',
  status: 'open-status-dialog',
  ifs: 'open-ifs-dialog',
  'pin-config': 'shortcut-config:open'
};

const MAIN_MENU_SHORTCUTS: Record<MainMenuAction, { key: string; label: string }> = {
  connect: { key: 'k', label: 'K' },
  settings: { key: ',', label: ',' },
  status: { key: 'i', label: 'I' },
  ifs: { key: 'm', label: 'M' },
  'pin-config': { key: 'p', label: 'P' }
};

const TEXT_INPUT_TYPES = new Set(['text', 'email', 'search', 'password', 'url', 'tel', 'number']);

interface LoadingState {
  isVisible: boolean;
  state: 'hidden' | 'loading' | 'success' | 'error';
  message: string;
  progress: number;
  canCancel: boolean;
}

const defaultLoadingState: LoadingState = {
  isVisible: false,
  state: 'hidden',
  message: '',
  progress: 0,
  canCancel: false
};

class MenuShortcutManager {
  private initialized = false;
  private isMac = false;
  private enabledActions: Record<MainMenuAction, boolean> = {
    connect: true,
    settings: true,
    status: true,
    ifs: false,
    'pin-config': true
  };

  constructor(private readonly onShortcutTriggered?: () => void) {}

  initialize(initialIfsEnabled: boolean): void {
    this.isMac = window.PLATFORM === 'darwin';
    this.enabledActions.ifs = initialIfsEnabled;
    this.updateShortcutLabels();

    if (this.initialized) {
      return;
    }

    document.addEventListener('keydown', this.handleKeydown);
    this.initialized = true;
  }

  dispose(): void {
    if (!this.initialized) {
      return;
    }

    document.removeEventListener('keydown', this.handleKeydown);
    this.initialized = false;
  }

  setActionEnabled(action: MainMenuAction, enabled: boolean): void {
    this.enabledActions[action] = enabled;
  }

  private updateShortcutLabels(): void {
    const displayPrefix = this.isMac ? '⌘' : 'Ctrl+';
    const ariaPrefix = this.isMac ? 'Meta+' : 'Control+';

    MAIN_MENU_ACTIONS.forEach((action) => {
      const config = MAIN_MENU_SHORTCUTS[action];
      const displayValue = `${displayPrefix}${config.label}`;
      const ariaValue = `${ariaPrefix}${config.label}`;

      const shortcutEl = document.querySelector<HTMLSpanElement>(
        `.menu-item-shortcut[data-shortcut-id="${action}"]`
      );
      if (shortcutEl) {
        shortcutEl.textContent = displayValue;
      }

      const button = document.querySelector<HTMLButtonElement>(`.menu-item[data-action="${action}"]`);
      if (button) {
        button.setAttribute('aria-keyshortcuts', ariaValue);
      }
    });
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.initialized || event.defaultPrevented || event.repeat) {
      return;
    }

    if (!this.isRelevantModifier(event) || event.altKey || event.shiftKey) {
      return;
    }

    if (this.isEditableContext()) {
      return;
    }

    const action = this.getActionFromEvent(event);
    if (!action || !this.enabledActions[action]) {
      return;
    }

    const channel = MAIN_MENU_ACTION_CHANNELS[action];
    if (!channel || !window.api?.send) {
      return;
    }

    event.preventDefault();

    window.api.send(channel);
    this.onShortcutTriggered?.();
  };

  private isRelevantModifier(event: KeyboardEvent): boolean {
    return this.isMac ? event.metaKey : event.ctrlKey;
  }

  private isEditableContext(): boolean {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return false;
    }

    if (activeElement instanceof HTMLInputElement) {
      if (!TEXT_INPUT_TYPES.has(activeElement.type)) {
        return false;
      }
      return !activeElement.readOnly && !activeElement.disabled;
    }

    if (activeElement instanceof HTMLTextAreaElement) {
      return !activeElement.readOnly && !activeElement.disabled;
    }

    if (activeElement instanceof HTMLSelectElement) {
      return !activeElement.disabled;
    }

    if (activeElement.isContentEditable) {
      return true;
    }

    return Boolean(activeElement.closest('[contenteditable="true"]'));
  }

  private getActionFromEvent(event: KeyboardEvent): MainMenuAction | null {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    for (const action of MAIN_MENU_ACTIONS) {
      const shortcut = MAIN_MENU_SHORTCUTS[action];
      if (shortcut.key === ',') {
        if (event.key === ',') {
          return action;
        }
        continue;
      }

      if (key === shortcut.key) {
        return action;
      }
    }

    return null;
  }
}

export class LegacyUiController {
  private isMainMenuOpen = false;
  private mainMenuButton: HTMLButtonElement | null = null;
  private mainMenuDropdown: HTMLDivElement | null = null;
  private mainMenuCloseTimeout: number | null = null;
  private readonly menuShortcutManager: MenuShortcutManager;
  private currentLoadingState: LoadingState = { ...defaultLoadingState };
  private ifsMenuItemVisible = false;

  constructor(private readonly logMessage: (message: string) => void) {
    this.menuShortcutManager = new MenuShortcutManager(() => this.closeMainMenu());
  }

  initialize(): void {
    initializeUIAnimations();
    this.setupWindowControls();
    this.setupLoadingEventListeners();
    this.initializeMainMenu();
    this.menuShortcutManager.initialize(this.ifsMenuItemVisible);
  }

  dispose(): void {
    this.menuShortcutManager.dispose();
  }

  setIfsMenuItemVisible(visible: boolean): void {
    if (this.ifsMenuItemVisible === visible) {
      return;
    }
    this.ifsMenuItemVisible = visible;
    const ifsMenuItem = document.getElementById('menu-item-ifs');
    if (ifsMenuItem) {
      if (visible) {
        ifsMenuItem.classList.remove('hidden');
      } else {
        ifsMenuItem.classList.add('hidden');
      }
    }
    this.menuShortcutManager.setActionEnabled('ifs', visible);
  }

  private setupWindowControls(): void {
    const minimizeBtn = document.getElementById('btn-minimize');
    const maximizeBtn = document.getElementById('btn-maximize');
    const closeBtn = document.getElementById('btn-close');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        this.logMessage('Minimize button clicked');
        window.api?.send?.('window-minimize');
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        this.logMessage('Maximize button clicked');
        window.api?.send?.('window-maximize');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.logMessage('Close button clicked');
        window.api?.send?.('window-close');
      });
    }

    const trafficCloseBtn = document.getElementById('traffic-close');
    const trafficMinimizeBtn = document.getElementById('traffic-minimize');
    const trafficMaximizeBtn = document.getElementById('traffic-maximize');

    if (trafficCloseBtn) {
      trafficCloseBtn.addEventListener('click', () => {
        this.logMessage('Traffic light close clicked');
        window.api?.send?.('window-close');
      });
    }

    if (trafficMinimizeBtn) {
      trafficMinimizeBtn.addEventListener('click', () => {
        this.logMessage('Traffic light minimize clicked');
        window.api?.send?.('window-minimize');
      });
    }

    if (trafficMaximizeBtn) {
      trafficMaximizeBtn.addEventListener('click', () => {
        this.logMessage('Traffic light maximize clicked');
        window.api?.send?.('window-maximize');
      });
    }
  }

  private setupLoadingEventListeners(): void {
    if (!window.api) {
      this.logMessage('ERROR: API not available for loading event listeners');
      return;
    }

    window.api.receive('loading-state-changed', (eventData: unknown) => {
      const data = eventData as {
        state: 'hidden' | 'loading' | 'success' | 'error';
        message?: string;
        progress?: number;
        canCancel?: boolean;
      };

      this.currentLoadingState = {
        isVisible: data.state !== 'hidden',
        state: data.state,
        message: data.message || '',
        progress: data.progress || 0,
        canCancel: data.canCancel || false
      };
      this.updateLoadingOverlay();
    });

    const cancelBtn = document.getElementById('loading-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this.currentLoadingState.canCancel && window.api?.loading) {
          window.api.loading.cancel();
          this.logMessage('Loading operation cancelled by user');
        }
      });
    }
  }

  private updateLoadingOverlay(): void {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    const progressContainer = document.getElementById('loading-progress-container');
    const progressFill = document.getElementById('loading-progress-fill');
    const progressText = document.getElementById('loading-progress-text');
    const cancelBtn = document.getElementById('loading-cancel-btn');

    if (!overlay || !messageEl) {
      console.error('Loading overlay elements not found');
      return;
    }

    if (this.currentLoadingState.isVisible) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
      return;
    }

    overlay.className = `loading-overlay state-${this.currentLoadingState.state}`;
    messageEl.textContent = this.currentLoadingState.message;

    if (progressContainer && progressFill && progressText) {
      if (this.currentLoadingState.state === 'loading' && this.currentLoadingState.progress > 0) {
        progressContainer.classList.add('visible');
        progressFill.style.width = `${this.currentLoadingState.progress}%`;
        progressText.textContent = `${Math.round(this.currentLoadingState.progress)}%`;
      } else {
        progressContainer.classList.remove('visible');
      }
    }

    if (cancelBtn) {
      if (this.currentLoadingState.canCancel && this.currentLoadingState.state === 'loading') {
        cancelBtn.classList.add('visible');
      } else {
        cancelBtn.classList.remove('visible');
      }
    }
  }

  private initializeMainMenu(): void {
    this.mainMenuButton = document.getElementById('btn-main-menu') as HTMLButtonElement | null;
    this.mainMenuDropdown = document.getElementById('main-menu-dropdown') as HTMLDivElement | null;

    if (!this.mainMenuButton || !this.mainMenuDropdown) {
      console.warn('[MainMenu] Hamburger menu elements not found in DOM');
      return;
    }

    this.mainMenuButton.setAttribute('aria-expanded', 'false');
    this.mainMenuDropdown.classList.add('hidden');

    this.mainMenuButton.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      this.toggleMainMenu();
    });

    const menuItems = this.mainMenuDropdown.querySelectorAll<HTMLButtonElement>('.menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        const channel = MAIN_MENU_ACTION_CHANNELS[action as MainMenuAction];
        if (channel && window.api?.send) {
          window.api.send(channel);
        }
        this.closeMainMenu();
      });
    });

    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Node | null;
      const button = this.mainMenuButton;
      const dropdown = this.mainMenuDropdown;
      if (
        this.isMainMenuOpen &&
        target &&
        button &&
        dropdown &&
        !button.contains(target) &&
        !dropdown.contains(target)
      ) {
        this.closeMainMenu();
      }
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isMainMenuOpen) {
        this.closeMainMenu();
        this.mainMenuButton?.focus();
      }
    });

    // Ensure shortcuts reflect initial visibility.
    this.setIfsMenuItemVisible(this.ifsMenuItemVisible);
  }

  private closeMainMenu(): void {
    if (!this.isMainMenuOpen || !this.mainMenuDropdown) {
      return;
    }

    this.isMainMenuOpen = false;
    this.mainMenuDropdown.classList.remove('show');
    this.mainMenuButton?.setAttribute('aria-expanded', 'false');

    if (this.mainMenuCloseTimeout !== null) {
      window.clearTimeout(this.mainMenuCloseTimeout);
      this.mainMenuCloseTimeout = null;
    }

    this.mainMenuCloseTimeout = window.setTimeout(() => {
      if (!this.isMainMenuOpen && this.mainMenuDropdown) {
        this.mainMenuDropdown.classList.add('hidden');
      }
      this.mainMenuCloseTimeout = null;
    }, 150);
  }

  private openMainMenu(): void {
    if (this.isMainMenuOpen || !this.mainMenuDropdown) {
      return;
    }

    if (this.mainMenuCloseTimeout !== null) {
      window.clearTimeout(this.mainMenuCloseTimeout);
      this.mainMenuCloseTimeout = null;
    }

    this.isMainMenuOpen = true;
    this.mainMenuDropdown.classList.remove('hidden');
    void this.mainMenuDropdown.offsetHeight;

    this.mainMenuDropdown.classList.add('show');
    this.mainMenuButton?.setAttribute('aria-expanded', 'true');
  }

  private toggleMainMenu(): void {
    if (this.isMainMenuOpen) {
      this.closeMainMenu();
    } else {
      this.openMainMenu();
    }
  }
}

