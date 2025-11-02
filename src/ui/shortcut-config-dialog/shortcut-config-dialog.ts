/**
 * @fileoverview Renderer script for shortcut configuration dialog
 *
 * Manages the shortcut configuration UI, allowing users to assign components
 * to up to 3 shortcut button slots. Handles validation, conflict detection,
 * and communication with the main process.
 *
 * Key responsibilities:
 * - Load current configuration and available components
 * - Populate dropdowns with available components
 * - Handle slot assignment changes
 * - Validate no duplicate assignments
 * - Save configuration and close dialog
 *
 * @author FlashForgeUI Team
 * @module ui/shortcut-config-dialog/shortcut-config-dialog
 */

import { initializeLucideIconsFromGlobal } from '../shared/lucide';

/**
 * Response channel for closing dialog
 */
let responseChannel: string | null = null;

/**
 * Current configuration state
 */
let currentConfig: ShortcutButtonConfig | null = null;

/**
 * Available components list
 */
let availableComponents: ComponentInfo[] = [];

/**
 * Shortcut button configuration type
 */
interface ShortcutButtonConfig {
  version: number;
  slots: {
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
  };
  lastModified: string;
}

/**
 * Component information type
 */
interface ComponentInfo {
  id: string;
  name: string;
  icon: string;
  isPinned: boolean;
  category: string;
}

/**
 * Initialize the dialog
 */
async function initializeDialog(): Promise<void> {
  console.log('[ShortcutConfigDialog] Initializing dialog');

  try {
    // Load current configuration
    currentConfig = await window.shortcutConfigAPI.getCurrentConfig();
    console.log('[ShortcutConfigDialog] Current config:', currentConfig);

    if (!currentConfig) {
      showStatus('Failed to load configuration', 'error');
      return;
    }

    // Load available components
    availableComponents = await window.shortcutConfigAPI.getAvailableComponents();
    console.log('[ShortcutConfigDialog] Available components:', availableComponents);

    // Populate UI
    populateDropdowns();
    updateComponentsList();
    updateClearButtons();

    console.log('[ShortcutConfigDialog] Dialog initialized');
  } catch (error) {
    console.error('[ShortcutConfigDialog] Initialization error:', error);
    showStatus('Failed to initialize dialog', 'error');
  }
}

/**
 * Populate slot dropdowns with available components
 */
function populateDropdowns(): void {
  if (!currentConfig) return;

  for (let i = 1; i <= 3; i++) {
    const select = document.getElementById(`slot${i}-select`) as HTMLSelectElement;
    if (!select) continue;

    const slotKey = `slot${i}` as keyof typeof currentConfig.slots;
    const currentValue = currentConfig.slots[slotKey];

    // Clear existing options except "None"
    select.innerHTML = '<option value="">None</option>';

    // Add all components
    availableComponents.forEach((component) => {
      const option = document.createElement('option');
      option.value = component.id;
      option.textContent = component.name;

      // Disable if already assigned to another slot
      const assignedSlot = findAssignedSlot(component.id);
      if (assignedSlot !== null && assignedSlot !== i) {
        option.disabled = true;
        option.textContent += ' (assigned)';
      }

      select.appendChild(option);
    });

    // Set current value
    select.value = currentValue || '';
  }
}

/**
 * Find which slot a component is assigned to
 */
function findAssignedSlot(componentId: string): number | null {
  if (!currentConfig) return null;

  for (let i = 1; i <= 3; i++) {
    const slotKey = `slot${i}` as keyof typeof currentConfig.slots;
    if (currentConfig.slots[slotKey] === componentId) {
      return i;
    }
  }

  return null;
}

/**
 * Update the available components list display
 */
function updateComponentsList(): void {
  const listContainer = document.getElementById('components-list');
  if (!listContainer || !currentConfig) return;

  const pinnedIds = Object.values(currentConfig.slots).filter(
    (id): id is string => id !== null
  );

  listContainer.innerHTML = '';

  availableComponents.forEach((component) => {
    const isPinned = pinnedIds.includes(component.id);
    const statusClass = isPinned ? 'pinned' : 'available';
    const statusText = isPinned ? 'Pinned' : 'Available';

    const item = document.createElement('div');
    item.className = 'component-item';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'component-name';

    const iconDisplay = document.createElement('span');
    iconDisplay.className = 'component-icon-display';
    const iconsToHydrate: string[] = [];
    if (component.icon) {
      const iconElement = document.createElement('i');
      iconElement.setAttribute('data-lucide', component.icon);
      iconDisplay.appendChild(iconElement);
      iconsToHydrate.push(component.icon);
    }

    const nameText = document.createElement('span');
    nameText.textContent = component.name;

    nameContainer.appendChild(iconDisplay);
    nameContainer.appendChild(nameText);

    const status = document.createElement('span');
    status.className = `component-status ${statusClass}`;
    status.textContent = statusText;

    item.appendChild(nameContainer);
    item.appendChild(status);
    listContainer.appendChild(item);

    if (iconsToHydrate.length > 0) {
      initializeLucideIconsFromGlobal(iconsToHydrate, item);
    }
  });
}

/**
 * Update clear button states
 */
function updateClearButtons(): void {
  if (!currentConfig) return;

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`btn-clear-slot${i}`) as HTMLButtonElement;
    if (!btn) continue;

    const slotKey = `slot${i}` as keyof typeof currentConfig.slots;
    const hasValue = currentConfig.slots[slotKey] !== null;

    btn.disabled = !hasValue;
  }
}

/**
 * Handle slot selection change
 */
function handleSlotChange(slot: number, componentId: string): void {
  if (!currentConfig) return;

  const slotKey = `slot${slot}` as keyof typeof currentConfig.slots;

  // Check if component is already assigned to another slot
  if (componentId) {
    const existingSlot = findAssignedSlot(componentId);
    if (existingSlot !== null && existingSlot !== slot) {
      showStatus(
        `Component is already assigned to Slot ${existingSlot}`,
        'error'
      );
      // Reset select to previous value
      const select = document.getElementById(`slot${slot}-select`) as HTMLSelectElement;
      if (select) {
        select.value = currentConfig.slots[slotKey] || '';
      }
      return;
    }
  }

  // Update config
  currentConfig.slots[slotKey] = componentId || null;

  // Refresh UI
  populateDropdowns();
  updateComponentsList();
  updateClearButtons();
}

/**
 * Handle clear slot button click
 */
function handleClearSlot(slot: number): void {
  if (!currentConfig) return;

  const slotKey = `slot${slot}` as keyof typeof currentConfig.slots;
  currentConfig.slots[slotKey] = null;

  // Update select element
  const select = document.getElementById(`slot${slot}-select`) as HTMLSelectElement;
  if (select) {
    select.value = '';
  }

  // Refresh UI
  populateDropdowns();
  updateComponentsList();
  updateClearButtons();
}

/**
 * Handle apply button click
 */
async function handleApply(): Promise<void> {
  if (!currentConfig || !responseChannel) return;

  try {
    console.log('[ShortcutConfigDialog] Saving configuration:', currentConfig);
    showStatus('Saving configuration...', 'info');

    const result = await window.shortcutConfigAPI.saveConfig(currentConfig);

    if (result.success) {
      showStatus('Configuration saved successfully', 'success');
      // Close dialog after brief delay
      setTimeout(() => {
        window.shortcutConfigAPI.closeDialog(responseChannel!);
      }, 500);
    } else {
      showStatus(`Failed to save: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('[ShortcutConfigDialog] Save error:', error);
    showStatus('Failed to save configuration', 'error');
  }
}

/**
 * Handle cancel button click
 */
function handleCancel(): void {
  if (responseChannel) {
    window.shortcutConfigAPI.closeDialog(responseChannel);
  }
}

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  const statusEl = document.getElementById('status-message');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;

  if (type !== 'info') {
    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Close button
  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', handleCancel);
  }

  // Cancel button
  const cancelBtn = document.getElementById('btn-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }

  // Apply button
  const applyBtn = document.getElementById('btn-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => void handleApply());
  }

  // Slot selects
  for (let i = 1; i <= 3; i++) {
    const select = document.getElementById(`slot${i}-select`);
    if (select) {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        handleSlotChange(i, target.value);
      });
    }

    // Clear buttons
    const clearBtn = document.getElementById(`btn-clear-slot${i}`);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => handleClearSlot(i));
    }
  }

  console.log('[ShortcutConfigDialog] Event listeners setup complete');
}

/**
 * Initialize when dialog init message received
 */
window.shortcutConfigAPI.onDialogInit((data) => {
  console.log('[ShortcutConfigDialog] Dialog init received:', data);
  responseChannel = data.responseChannel;

  // Initialize dialog
  void initializeDialog();
});

/**
 * Setup event listeners on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ShortcutConfigDialog] DOM ready');
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['plus', 'circle', 'x']);
  setupEventListeners();
});
