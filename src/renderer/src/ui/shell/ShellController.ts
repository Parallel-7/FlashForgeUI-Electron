/**
 * @fileoverview Shell controller for the renderer's window chrome.
 *
 * Owns the shared chrome that frames the dashboard: window controls
 * (minimize/maximize/close + macOS traffic lights), the hamburger menu and
 * its keyboard shortcuts, the "Edit Layout" toggle, and the loading overlay.
 * Printer-specific controls live in dedicated components/GridStack widgets;
 * this controller intentionally holds only the cross-cutting chrome.
 *
 * Key exports:
 * - ShellController: Initializes and manages the renderer chrome
 */

import { initializeUIAnimations } from '../../renderer/services/ui-updater.js';
import { RebootController } from './RebootController.js';

const MAIN_MENU_ACTIONS = ['connect', 'settings', 'status', 'calibration', 'pin-config', 'about'] as const;
type MainMenuAction = (typeof MAIN_MENU_ACTIONS)[number];

const MAIN_MENU_ACTION_CHANNELS: Record<MainMenuAction, string> = {
  connect: 'open-printer-selection',
  settings: 'open-settings-window',
  status: 'open-status-dialog',
  calibration: 'open-calibration-dialog',
  'pin-config': 'shortcut-config:open',
  about: 'open-about-dialog',
};

const MAIN_MENU_SHORTCUTS: Partial<Record<MainMenuAction, { key: string; label: string }>> = {
  connect: { key: 'k', label: 'K' },
  settings: { key: ',', label: ',' },
  status: { key: 'i', label: 'I' },
  'pin-config': { key: 'p', label: 'P' },
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
  canCancel: false,
};

class MenuShortcutManager {
  private initialized = false;
  private isMac = false;
  private readonly enabledActions: Record<MainMenuAction, boolean> = {
    connect: true,
    settings: true,
    status: true,
    calibration: true,
    'pin-config': true,
    about: true,
  };

  constructor(private readonly onShortcutTriggered?: () => void) {}

  initialize(): void {
    this.isMac = window.PLATFORM === 'darwin';
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
      const shortcutEl = document.querySelector<HTMLSpanElement>(`.menu-item-shortcut[data-shortcut-id="${action}"]`);
      const button = document.querySelector<HTMLButtonElement>(`.menu-item[data-action="${action}"]`);

      if (!config) {
        shortcutEl?.classList.add('hidden');
        if (shortcutEl) {
          shortcutEl.textContent = '';
        }
        button?.removeAttribute('aria-keyshortcuts');
        return;
      }

      const displayValue = `${displayPrefix}${config.label}`;
      const ariaValue = `${ariaPrefix}${config.label}`;

      shortcutEl?.classList.remove('hidden');
      if (shortcutEl) {
        shortcutEl.textContent = displayValue;
      }

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
      if (!shortcut) {
        continue;
      }

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

export class ShellController {
  private isMainMenuOpen = false;
  private mainMenuButton: HTMLButtonElement | null = null;
  private mainMenuDropdown: HTMLDivElement | null = null;
  private mainMenuCloseTimeout: number | null = null;
  private readonly menuShortcutManager: MenuShortcutManager;
  private currentLoadingState: LoadingState = { ...defaultLoadingState };

  // Reboot feature: the menu item is shown only for supported+connected
  // contexts, and the overlay is claimed exclusively during a reboot so the
  // regular 'loading-state-changed' IPC cannot clobber it. 'reboot' is handled
  // like 'edit-layout' — special-cased in the click handler, intentionally NOT
  // registered in MAIN_MENU_ACTIONS / MAIN_MENU_ACTION_CHANNELS (no shortcut,
  // not a fire-and-forget IPC send).
  private readonly rebootController: RebootController;
  private rebootOverlayClaimed = false;
  private rebootContext: { contextId: string; printerName: string } | null = null;
  private rebootConfirmPanel: HTMLDivElement | null = null;

  constructor(
    private readonly logMessage: (message: string) => void,
    private readonly onEditLayout?: () => void
  ) {
    this.menuShortcutManager = new MenuShortcutManager(() => this.closeMainMenu());
    this.rebootController = new RebootController(
      { claimOverlay: () => this.claimOverlay(), releaseOverlay: () => this.releaseOverlay() },
      logMessage
    );
  }

  /**
   * Update the "Edit Layout" menu item to reflect the current edit mode state.
   * Edit mode is renderer-local (driven by EditModeController), so this is
   * called from a state-change subscription rather than via IPC.
   * @param enabled - Whether edit mode is currently active
   * @param available - Whether edit mode can be toggled (requires an active printer)
   */
  setEditModeState(enabled: boolean, available: boolean): void {
    const button = document.querySelector<HTMLButtonElement>('.menu-item[data-action="edit-layout"]');
    if (!button) {
      return;
    }

    const label = button.querySelector<HTMLSpanElement>('.menu-item-label');
    if (label) {
      label.textContent = enabled ? 'Exit Edit Mode' : 'Edit Layout';
    }

    button.disabled = !available;
    button.setAttribute('aria-checked', enabled ? 'true' : 'false');
  }

  initialize(): void {
    initializeUIAnimations();
    this.setupWindowControls();
    this.setupLoadingEventListeners();
    this.initializeMainMenu();
    this.menuShortcutManager.initialize();
    this.rebootController.init();
  }

  dispose(): void {
    this.menuShortcutManager.dispose();
    this.rebootController.dispose();
  }

  /**
   * Toggle DOM visibility of the Reboot Printer menu item. Shown only when the
   * active context is a supported model (5M / 5M Pro / AD5X) AND connected. The
   * caller (renderer.ts) computes availability from context/backend events and
   * also supplies the context id / printer name used to drive the lifecycle.
   */
  setRebootAvailable(
    available: boolean,
    contextId: string | null,
    printerName: string | null
  ): void {
    this.rebootContext =
      contextId && printerName ? { contextId, printerName } : null;

    const button = document.querySelector<HTMLButtonElement>('.menu-item[data-action="reboot"]');
    if (!button) {
      return;
    }

    button.classList.toggle('hidden', !available);
    this.updateRebootItemDisabled();
  }

  /**
   * Disable the Reboot item while the overlay is busy with a non-reboot loading
   * operation. Chosen over queueing: simplest robust contention guard. When a
   * reboot owns the overlay the item is hidden anyway (the overlay covers it).
   */
  private updateRebootItemDisabled(): void {
    const button = document.querySelector<HTMLButtonElement>('.menu-item[data-action="reboot"]');
    if (!button) {
      return;
    }
    button.disabled = !this.rebootOverlayClaimed && this.currentLoadingState.isVisible;
  }

  /** Claim the shared overlay for a reboot (blocks regular loading events). */
  private claimOverlay(): void {
    this.rebootOverlayClaimed = true;
    this.updateRebootItemDisabled();
  }

  /** Release the overlay back to the regular loading-state-changed flow. */
  private releaseOverlay(): void {
    this.rebootOverlayClaimed = false;
    this.currentLoadingState = { ...defaultLoadingState };
    this.updateLoadingOverlay();
    this.updateRebootItemDisabled();
  }

  /** Wire the in-dropdown reboot confirm panel buttons (called once on init). */
  private setupRebootConfirmPanel(): void {
    this.rebootConfirmPanel = document.getElementById('reboot-confirm-panel') as HTMLDivElement | null;

    const cancelBtn = document.getElementById('reboot-cancel-btn');
    cancelBtn?.addEventListener('click', () => this.hideRebootConfirm());

    const confirmBtn = document.getElementById('reboot-confirm-btn');
    confirmBtn?.addEventListener('click', () => {
      const ctx = this.rebootContext;
      this.hideRebootConfirm();
      this.closeMainMenu();
      if (ctx) {
        this.rebootController.start(ctx.contextId, ctx.printerName);
      } else {
        this.logMessage('Reboot requested but no printer context is available');
      }
    });
  }

  private showRebootConfirm(): void {
    if (!this.rebootContext) {
      this.logMessage('Reboot unavailable: no active supported context');
      return;
    }
    const messageEl = document.getElementById('reboot-confirm-message');
    if (messageEl) {
      messageEl.textContent = `Reboot ${this.rebootContext.printerName}? It will disconnect and come back in ~30-60s.`;
    }
    this.rebootConfirmPanel?.classList.remove('hidden');
  }

  private hideRebootConfirm(): void {
    this.rebootConfirmPanel?.classList.add('hidden');
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
      // While a reboot owns the overlay, ignore regular loading events so the
      // connection-flow / file-operation states can't clobber the reboot UI.
      if (this.rebootOverlayClaimed) {
        return;
      }

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
        canCancel: data.canCancel || false,
      };
      this.updateLoadingOverlay();
      this.updateRebootItemDisabled();
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

    this.applyEditLayoutShortcutLabel();

    this.setupRebootConfirmPanel();

    const menuItems = this.mainMenuDropdown.querySelectorAll<HTMLButtonElement>('.menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');

        // Edit mode is a renderer-local toggle (EditModeController), not an IPC action.
        if (action === 'edit-layout') {
          this.onEditLayout?.();
          this.closeMainMenu();
          return;
        }

        // Reboot opens an in-dropdown confirm panel instead of firing an IPC
        // action. The menu stays open so the user can confirm or cancel.
        if (action === 'reboot') {
          this.showRebootConfirm();
          return;
        }

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
  }

  /**
   * Set the edit-layout shortcut hint label for the current platform.
   * This item is handled by EditModeController (not MenuShortcutManager),
   * so its hint must be localized here rather than via the shortcut manager.
   */
  private applyEditLayoutShortcutLabel(): void {
    const shortcutEl = document.querySelector<HTMLSpanElement>(
      '.menu-item-shortcut[data-shortcut-id="edit-layout"]'
    );
    if (!shortcutEl) {
      return;
    }

    const isMac = window.PLATFORM === 'darwin';
    shortcutEl.textContent = isMac ? '⌘E' : 'Ctrl+E';

    const button = shortcutEl.closest<HTMLButtonElement>('.menu-item[data-action="edit-layout"]');
    button?.setAttribute('aria-keyshortcuts', isMac ? 'Meta+E' : 'Control+E');
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
