/**
 * @fileoverview Printer Connected Warning Dialog Renderer
 *
 * Handles the printer connection warning dialog that appears when a user tries to
 * connect while already connected to a printer. Provides clear warning message
 * and allows user to confirm or cancel the action.
 */


// Ensure this file is treated as a module
export {};

import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

// Interface for dialog initialization data
interface PrinterConnectedWarningData {
    readonly printerName: string;
    readonly responseChannel: string;
}

interface PrinterWarningDialogAPI {
    receive?: (channel: string, func: (...args: unknown[]) => void) => void;
    continue: () => Promise<void>;
    cancel: () => Promise<void>;
}

const getPrinterWarningDialogAPI = (): PrinterWarningDialogAPI => {
    const api = window.api?.dialog?.printerWarning as PrinterWarningDialogAPI | undefined;
    if (!api) {
        throw new Error('[PrinterWarningDialog] dialog API bridge is not available');
    }
    return api;
};

const printerWarningDialogAPI = getPrinterWarningDialogAPI();

// DOM element references
interface DialogElements {
    readonly titleElement: HTMLElement | null;
    readonly primaryMessageElement: HTMLElement | null;
    readonly continueButton: HTMLButtonElement | null;
    readonly cancelButton: HTMLButtonElement | null;
    readonly closeButton: HTMLButtonElement | null;
}

// Initialize dialog when DOM is loaded
document.addEventListener('DOMContentLoaded', (): void => {
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['alert-triangle', 'x']);
    // Get DOM element references with proper type safety
    const elements: DialogElements = {
        titleElement: document.getElementById('dialog-title'),
        primaryMessageElement: document.getElementById('primary-message'),
        continueButton: document.getElementById('dialog-continue') as HTMLButtonElement,
        cancelButton: document.getElementById('dialog-cancel') as HTMLButtonElement,
        closeButton: document.getElementById('dialog-close') as HTMLButtonElement
    };

    // Verify required elements exist
    if (!elements.continueButton || !elements.cancelButton || !elements.closeButton) {
        console.error('Printer connected warning dialog: Required DOM elements not found');
        return;
    }

    // Initialize dialog with options from main process
    printerWarningDialogAPI.receive?.('dialog-init', (data: unknown): void => {
        initializeDialog(elements, data as PrinterConnectedWarningData);
    });

    // Set up event handlers
    setupEventHandlers(elements);

    // Register theme listener
    registerThemeListener();

    // Set default focus to Cancel button (safer default)
    elements.cancelButton.focus();
});

function registerThemeListener(): void {
    printerWarningDialogAPI.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}

/**
 * Initialize dialog with provided printer data
 */
function initializeDialog(elements: DialogElements, data: PrinterConnectedWarningData): void {
    // Update the primary message with the actual printer name
    if (elements.primaryMessageElement) {
        elements.primaryMessageElement.textContent = `You are currently connected to ${data.printerName}`;
    }

    // Ensure focus is on the safer Cancel button by default
    if (elements.cancelButton) {
        elements.cancelButton.focus();
    }
}

/**
 * Set up all event handlers for dialog interaction
 */
function setupEventHandlers(elements: DialogElements): void {
    // Continue button click handler
    if (elements.continueButton) {
        elements.continueButton.addEventListener('click', (): void => {
            handleContinueAction();
        });

        // Continue button keyboard handler
        elements.continueButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleContinueAction();
            }
        });
    }

    // Cancel button click handler
    if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', (): void => {
            handleCancelAction();
        });

        // Cancel button keyboard handler
        elements.cancelButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCancelAction();
            }
        });
    }

    // Close button handler
    if (elements.closeButton) {
        elements.closeButton.addEventListener('click', (): void => {
            handleCancelAction();
        });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (event: KeyboardEvent): void => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                handleCancelAction();
                break;
            case 'Enter':
                // Only trigger continue on Enter if Continue button has focus
                if (document.activeElement === elements.continueButton) {
                    event.preventDefault();
                    handleContinueAction();
                }
                break;
            default:
                // No action for other keys
                break;
        }
    });

    // Tab navigation improvement
    document.addEventListener('keydown', (event: KeyboardEvent): void => {
        if (event.key === 'Tab') {
            // Let the browser handle tab navigation naturally
            // The tabindex should be set appropriately in HTML if needed
        }
    });
}

/**
 * Handle continue action (user wants to proceed despite warning)
 */
function handleContinueAction(): void {
    // Disable buttons to prevent double-clicks
    disableButtons();

    printerWarningDialogAPI.continue().catch((error: unknown) => {
        console.error('Error handling continue action:', error);
        // Re-enable buttons if there was an error
        enableButtons();
    });
}

/**
 * Handle cancel action (user wants to abort)
 */
function handleCancelAction(): void {
    // Disable buttons to prevent double-clicks
    disableButtons();

    printerWarningDialogAPI.cancel().catch((error: unknown) => {
        console.error('Error handling cancel action:', error);
        // Re-enable buttons if there was an error
        enableButtons();
    });
}

/**
 * Disable all dialog buttons to prevent interaction during processing
 */
function disableButtons(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.dialog-button, .dialog-close');
    buttons.forEach(button => {
        button.disabled = true;
    });
}

/**
 * Re-enable all dialog buttons
 */
function enableButtons(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.dialog-button, .dialog-close');
    buttons.forEach(button => {
        button.disabled = false;
    });
}
