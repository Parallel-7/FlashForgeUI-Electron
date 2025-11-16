/**
 * @fileoverview Header UI helpers for the WebUI client.
 *
 * Encapsulates header-specific DOM interactions including the edit mode toggle
 * button so layout logic can inject its own persistence and grid handling
 * without tightly coupling to DOM querying code.
 */

import type { WebUISettings } from '../app.js';
import { MOBILE_BREAKPOINT } from '../core/AppState.js';
import { $ } from '../shared/dom.js';

export interface HeaderEventDependencies {
  getCurrentSettings: () => WebUISettings;
  updateCurrentSettings: (settings: WebUISettings) => void;
  applySettings: (settings: WebUISettings) => void;
  persistSettings: () => void;
  refreshSettingsUI: (settings: WebUISettings) => void;
}

export function setupHeaderEventHandlers(dependencies: HeaderEventDependencies): void {
  const headerEditToggle = $('edit-mode-toggle') as HTMLButtonElement | null;
  if (!headerEditToggle) {
    return;
  }

  headerEditToggle.addEventListener('click', () => {
    const settings = dependencies.getCurrentSettings();
    const updatedSettings: WebUISettings = {
      ...settings,
      editMode: !settings.editMode,
    };
    dependencies.updateCurrentSettings(updatedSettings);
    dependencies.applySettings(updatedSettings);
    dependencies.persistSettings();
    dependencies.refreshSettingsUI(updatedSettings);
  });
}

export function updateEditModeToggle(editMode: boolean): void {
  const toggleButton = $('edit-mode-toggle') as HTMLButtonElement | null;
  if (!toggleButton) {
    return;
  }

  if (isMobileViewport()) {
    toggleButton.style.display = 'none';
    return;
  }

  toggleButton.style.display = '';
  toggleButton.setAttribute('aria-pressed', editMode ? 'true' : 'false');
  const lockIcon = toggleButton.querySelector<HTMLElement>('.lock-icon');
  const text = toggleButton.querySelector<HTMLElement>('.edit-text');
  if (lockIcon) {
    const iconName = editMode ? 'unlock' : 'lock';
    lockIcon.setAttribute('data-lucide', iconName);
  }
  if (text) {
    text.textContent = editMode ? 'Exit Edit Mode' : 'Enter Edit Mode';
  }
}

function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}
