/**
 * @fileoverview Auto-connect choice dialog renderer - Handles UI interactions and user choice
 * management for the auto-connect options dialog. Provides interface for choosing between
 * different connection options when auto-connect discovery fails.
 */

import type { AutoConnectChoiceOption, AutoConnectChoiceData } from './auto-connect-choice-preload.cts';
import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

// Global state
let currentData: AutoConnectChoiceData | null = null;
let isHandlingChoice = false;

/**
 * Initialize the dialog when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', (): void => {
  console.log('Auto-connect choice dialog renderer loaded');
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['link-2', 'check', 'globe', 'x']);
  setupEventListeners();
  
  // Listen for initialization data from main process
  window.autoConnectChoiceAPI.onDialogInit((data: AutoConnectChoiceData) => {
    console.log('Received auto-connect choice dialog data:', data);
    currentData = data;
    updateDialogUI(data);
  });
});

/**
 * Setup event listeners for dialog controls
 */
function setupEventListeners(): void {
  // Connect to last used printer button
  const connectLastUsedBtn = document.getElementById('btn-connect-last-used');
  if (connectLastUsedBtn) {
    connectLastUsedBtn.addEventListener('click', () => void handleChoice('connect-last-used'));
  }

  // Show saved printers button
  const showSavedBtn = document.getElementById('btn-show-saved-printers');
  if (showSavedBtn) {
    showSavedBtn.addEventListener('click', () => void handleChoice('show-saved-printers'));
  }

  // Manual IP entry button
  const manualIPBtn = document.getElementById('btn-manual-ip');
  if (manualIPBtn) {
    manualIPBtn.addEventListener('click', () => void handleChoice('manual-ip'));
  }

  // Cancel button
  const cancelBtn = document.getElementById('btn-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => void handleChoice('cancel'));
  }

  // Handle keyboard events
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      void handleChoice('cancel');
    }
  });

  // Handle window beforeunload
  window.addEventListener('beforeunload', () => {
    window.autoConnectChoiceAPI.removeAllListeners();
  });
}

/**
 * Update dialog UI based on initialization data
 */
function updateDialogUI(data: AutoConnectChoiceData): void {
  const lastUsedInfo = document.getElementById('last-used-info');
  const lastUsedName = document.getElementById('last-used-name');
  const quickPrinterName = document.getElementById('quick-printer-name');
  const connectLastUsedBtn = document.getElementById('btn-connect-last-used');
  const showSavedBtn = document.getElementById('btn-show-saved-printers');
  const savedCount = document.getElementById('saved-count');

  // Update saved printer count
  if (savedCount) {
    savedCount.textContent = data.savedPrinterCount.toString();
  }

  // Show/hide and update last used printer option
  if (data.lastUsedPrinter) {
    if (lastUsedInfo) lastUsedInfo.style.display = 'block';
    if (lastUsedName) lastUsedName.textContent = data.lastUsedPrinter.name;
    if (quickPrinterName) quickPrinterName.textContent = data.lastUsedPrinter.name;
    if (connectLastUsedBtn) connectLastUsedBtn.style.display = 'flex';
  } else {
    if (lastUsedInfo) lastUsedInfo.style.display = 'none';
    if (connectLastUsedBtn) connectLastUsedBtn.style.display = 'none';
  }

  // Show/hide saved printers option based on count
  if (data.savedPrinterCount > 0) {
    if (showSavedBtn) showSavedBtn.style.display = 'flex';
  } else {
    if (showSavedBtn) showSavedBtn.style.display = 'none';
  }

  // Update dialog description based on available options
  updateDialogDescription(data);
}


/**
 * Update dialog description based on available options
 */
function updateDialogDescription(data: AutoConnectChoiceData): void {
  const messageText = document.querySelector('.message-text');
  if (!messageText) return;

  if (data.savedPrinterCount === 0) {
    messageText.textContent = 'No printers found on the network and no saved printers available.';
  } else if (data.lastUsedPrinter) {
    messageText.textContent = 'No printers found on the network during auto-connect. Choose an option below:';
  } else {
    messageText.textContent = 'No printers found on the network. You have saved printers available.';
  }
}

/**
 * Handle user choice selection
 */
async function handleChoice(action: AutoConnectChoiceOption['action']): Promise<void> {
  if (isHandlingChoice) {
    console.log('Already handling a choice, ignoring...');
    return;
  }

  isHandlingChoice = true;
  console.log('User selected auto-connect choice:', action);

  try {
    const choice: AutoConnectChoiceOption = {
      action,
      data: currentData?.lastUsedPrinter || null
    };

    await window.autoConnectChoiceAPI.sendChoice(choice);
    console.log('Choice sent successfully');
  } catch (error) {
    console.error('Error sending choice:', error);
    isHandlingChoice = false; // Reset flag on error
  }
}

/**
 * Export for potential testing purposes
 */
if (typeof exports !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.handleChoice = handleChoice;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.updateDialogUI = updateDialogUI;
}
