// input-dialog-renderer.ts
// TypeScript renderer logic for the generic input dialog
// Handles user interaction, keyboard shortcuts, and dialog state management

// Ensure this file is treated as a module
export {};

// Extend Window interface to include our dialog API
declare global {
    interface Window {
        dialogAPI?: {
            receive: (channel: string, func: (options: DialogInitOptions) => void) => void;
            submit: (result: string) => Promise<void>;
            cancel: () => Promise<void>;
        };
    }
}

// Interface for dialog initialization options
interface DialogInitOptions {
    title?: string;
    message?: string;
    defaultValue?: string;
    inputType?: 'text' | 'password' | 'hidden';
    placeholder?: string;
    responseChannel: string;
}

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

    // Check if dialog API is available
    if (!window.dialogAPI) {
        console.error('Input dialog: Dialog API not available');
        return;
    }

    // Initialize dialog with options from main process
    window.dialogAPI.receive('dialog-init', (options: DialogInitOptions): void => {
        initializeDialog(elements, options);
    });

    // Set up event handlers
    setupEventHandlers(elements);
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
function setupEventHandlers(elements: DialogElements): void {
    if (!window.dialogAPI) return;

    // OK button click handler
    if (elements.okButton) {
        elements.okButton.addEventListener('click', (): void => {
            submitDialog(elements);
        });

        // OK button keyboard handler
        elements.okButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                submitDialog(elements);
            }
        });
    }

    // Cancel button click handler
    if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', (): void => {
            cancelDialog();
        });

        // Cancel button keyboard handler
        elements.cancelButton.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                cancelDialog();
            }
        });
    }

    // Close button handler
    if (elements.closeButton) {
        elements.closeButton.addEventListener('click', (): void => {
            cancelDialog();
        });
    }

    // Input field keyboard handlers
    if (elements.inputElement) {
        elements.inputElement.addEventListener('keydown', (event: KeyboardEvent): void => {
            if (event.key === 'Enter' && !elements.inputElement?.classList.contains('hidden')) {
                event.preventDefault();
                submitDialog(elements);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelDialog();
            }
        });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelDialog();
        }
    });
}

/**
 * Submit dialog with current input value
 */
function submitDialog(elements: DialogElements): void {
    if (!window.dialogAPI) return;

    const inputValue = elements.inputElement?.value || '';
    window.dialogAPI.submit(inputValue).catch((error) => {
        console.error('Error submitting dialog:', error);
        // Dialog should still close even if submission fails
    });
}

/**
 * Cancel dialog (close without result)
 */
function cancelDialog(): void {
    if (!window.dialogAPI) return;

    window.dialogAPI.cancel().catch((error) => {
        console.error('Error cancelling dialog:', error);
        // Dialog should still close even if cancellation fails
    });
}