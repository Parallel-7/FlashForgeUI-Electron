/**
 * @fileoverview Renderer process for generic modal input dialog with keyboard support.
 *
 * Implements interactive input dialog supporting multiple modes (text, password, hidden) with
 * comprehensive keyboard navigation and accessibility features. Handles dialog initialization,
 * user input validation, and result submission. Includes auto-focus, text selection, and
 * escape/enter keyboard shortcuts. Hidden mode supports confirmation dialogs without input fields.
 *
 * Key features:
 * - Multiple input types: text, password, hidden (for confirmations)
 * - Keyboard shortcuts: Enter to submit, Escape to cancel
 * - Auto-focus and text selection for improved UX
 * - Dynamic UI configuration from initialization options
 * - Type-safe event handlers with proper DOM element validation
 */

// input-dialog-renderer.ts
// TypeScript renderer logic for the generic input dialog
// Handles user interaction, keyboard shortcuts, and dialog state management

// Ensure this file is treated as a module
export {};

import type { ThemeColors } from '@shared/types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import type { DialogAPI as InputDialogAPI, DialogInitOptions } from './input-dialog-preload.cts';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';

const getInputDialogAPI = (): InputDialogAPI => {
    const api = window.api?.dialog?.input as InputDialogAPI | undefined;
    if (!api) {
        throw new Error('[InputDialog] dialog API bridge is not available');
    }
    return api;
};

// DOM element references
interface DialogElements {
    titleElement: HTMLElement | null;
    messageElement: HTMLElement | null;
    inputElement: HTMLInputElement | null;
    okButton: HTMLButtonElement | null;
    cancelButton: HTMLButtonElement | null;
    closeButton: HTMLButtonElement | null;
}

// Initialize dialog when DOM is loaded
document.addEventListener('DOMContentLoaded', (): void => {
    initializeLucideIconsFromGlobal(['x']);
    // Get DOM element references with proper type safety
    const elements: DialogElements = {
        titleElement: document.getElementById('dialog-title'),
        messageElement: document.getElementById('dialog-message'),
        inputElement: document.getElementById('dialog-input') as HTMLInputElement,
        okButton: document.getElementById('dialog-ok') as HTMLButtonElement,
        cancelButton: document.getElementById('dialog-cancel') as HTMLButtonElement,
        closeButton: document.getElementById('dialog-close') as HTMLButtonElement
    };

    // Verify required elements exist
    if (!elements.inputElement || !elements.okButton || !elements.cancelButton || !elements.closeButton) {
        console.error('Input dialog: Required DOM elements not found');
        return;
    }

    const api = getInputDialogAPI();

    // Initialize dialog with options from main process
    api.receive?.('dialog-init', (data: unknown): void => {
        initializeDialog(elements, data as DialogInitOptions);
    });

    // Set up event handlers
    setupEventHandlers(elements, api);

    // Register theme listener
    registerThemeListener(api);
});

/**
 * Initialize dialog with provided options
 */
function initializeDialog(elements: DialogElements, options: DialogInitOptions): void {
    // Set dialog title
    if (elements.titleElement) {
        elements.titleElement.textContent = options.title || 'Input Dialog';
    }

    // Set dialog message
    if (elements.messageElement) {
        elements.messageElement.textContent = options.message || 'Please enter a value:';
    }

    // Configure input element
    if (elements.inputElement) {
        // Set default value
        elements.inputElement.value = options.defaultValue || '';
        
        // Set input type
        const inputType = options.inputType || 'text';
        elements.inputElement.type = inputType === 'hidden' ? 'text' : inputType;
        
        // Set placeholder
        elements.inputElement.placeholder = options.placeholder || '';

        // Handle hidden input mode (for confirmation dialogs)
        if (inputType === 'hidden') {
            elements.inputElement.style.display = 'none';
            elements.inputElement.classList.add('hidden');
            // Focus OK button instead
            if (elements.okButton) {
                elements.okButton.focus();
            }
        } else {
            elements.inputElement.style.display = 'block';
            elements.inputElement.classList.remove('hidden');
            // Auto-focus and select input text
            elements.inputElement.focus();
            if (elements.inputElement.value) {
                elements.inputElement.select();
            }
        }
    }
}

/**
 * Set up all event handlers for dialog interaction
 */
function setupEventHandlers(elements: DialogElements, api: InputDialogAPI): void {
    // OK button click handler
    if (elements.okButton) {
        elements.okButton.addEventListener('click', (): void => {
            submitDialog(elements, api);
        });

        // OK button keyboard handler
        elements.okButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                submitDialog(elements, api);
            }
        });
    }

    // Cancel button click handler
    if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', (): void => {
            cancelDialog(api);
        });

        // Cancel button keyboard handler
        elements.cancelButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                cancelDialog(api);
            }
        });
    }

    // Close button handler
    if (elements.closeButton) {
        elements.closeButton.addEventListener('click', (): void => {
            cancelDialog(api);
        });
    }

    // Input field keyboard handlers
    if (elements.inputElement) {
        elements.inputElement.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' && !elements.inputElement?.classList.contains('hidden')) {
                event.preventDefault();
                submitDialog(elements, api);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelDialog(api);
            }
        });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelDialog(api);
        }
    });
}

/**
 * Submit dialog with current input value
 */
function submitDialog(elements: DialogElements, api: InputDialogAPI): void {
    const inputValue = elements.inputElement?.value || '';
    api.submit(inputValue).catch((error) => {
        console.error('Error submitting dialog:', error);
        // Dialog should still close even if submission fails
    });
}

/**
 * Cancel dialog (close without result)
 */
function cancelDialog(api: InputDialogAPI): void {
    api.cancel().catch((error) => {
        console.error('Error cancelling dialog:', error);
        // Dialog should still close even if cancellation fails
    });
}

/**
 * Register theme change listener
 */
function registerThemeListener(api: InputDialogAPI): void {
    api.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}
