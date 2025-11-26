/**
 * @fileoverview Send Commands Dialog renderer process for manual printer command transmission.
 * Provides a developer-focused UI for sending raw FlashForge printer protocol commands with
 * live response logging, auto-scrolling output, and command history. Automatically prefixes
 * commands with the FlashForge protocol tilde (~) marker if not already present.
 *
 * Key Features:
 * - Real-time command transmission to connected printer
 * - Timestamped log output with color-coded entry types (info/command/response/error)
 * - Automatic tilde (~) prefix for FlashForge commands
 * - Enter-key submission for rapid command testing
 * - Auto-scroll log view to most recent entries
 * - Input field auto-clear and focus after submission
 * - Async command handling with loading state management
 *
 * UI Components:
 * - Command input field with keyboard shortcuts
 * - Scrollable log output with categorized message styling
 * - Send button with disabled state during transmission
 * - Close button for dialog dismissal
 *
 * Usage Context:
 * Primarily used for debugging, testing printer responses, and advanced printer
 * control. Not intended for end-user operations.
 */

// src/ui/send-cmds/send-cmds-renderer.ts

export {}; // Ensure this file is treated as a module

import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

// Define types for command results
interface CommandResult {
    readonly success: boolean;
    readonly response?: string;
    readonly error?: string;
}

// Define global API interface for send commands
declare global {
    interface Window {
        readonly sendCmdsApi?: {
            readonly sendCommand: (command: string) => Promise<CommandResult>;
            readonly close: () => void;
            readonly removeListeners: () => void;
            receive?: (channel: string, func: (...args: unknown[]) => void) => void;
        };
    }
}

document.addEventListener('DOMContentLoaded', (): void => {
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
    // Get DOM elements with type safety
    const logOutput = document.getElementById('log-output') as HTMLDivElement | null;
    const commandInput = document.getElementById('command-input') as HTMLInputElement | null;
    const sendButton = document.getElementById('btn-send') as HTMLButtonElement | null;
    const closeButton = document.getElementById('btn-close') as HTMLButtonElement | null;
    
    // Validate all required DOM elements exist
    if (!logOutput || !commandInput || !sendButton || !closeButton) {
        console.error('Send Commands Dialog: Required DOM elements not found');
        return;
    }

    // Validate API availability
    if (!window.sendCmdsApi) {
        console.error('Send Commands Dialog: sendCmdsApi not available');
        return;
    }

    const api = window.sendCmdsApi;
    
    // Function to append log messages with timestamps
    function appendLog(message: string, type: 'info' | 'command' | 'response' | 'error' = 'info'): void {
        if (!logOutput) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        // Add timestamp to message
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        // Append to log output
        logOutput.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logOutput.scrollTop = logOutput.scrollHeight;
    }
    
    // Function to send command with proper error handling
    async function sendCommand(): Promise<void> {
        if (!commandInput || !sendButton || !api) return;
        
        let command = commandInput.value.trim();
        if (!command) return;
        
        // Add ~ prefix if the user does not provide it
        if (!command.startsWith('~')) {
            command = '~' + command;
        }
        
        // Disable input controls while command is being processed
        sendButton.disabled = true;
        commandInput.disabled = true;
        
        // Log the command being sent
        appendLog(`Sending: ${command}`, 'command');
        
        try {
            // Send command to main process via preload bridge
            const result: CommandResult = await api.sendCommand(command);
            
            // Handle the result
            if (result.success) {
                const response = result.response || 'OK';
                appendLog(`Response: ${response}`, 'response');
            } else {
                const error = result.error || 'Command failed';
                appendLog(`Error: ${error}`, 'error');
            }
        } catch (error) {
            // Handle any thrown errors
            const errorMessage = error instanceof Error ? error.message : 'Failed to send command';
            appendLog(`Error: ${errorMessage}`, 'error');
        } finally {
            // Re-enable controls and clear input
            sendButton.disabled = false;
            commandInput.disabled = false;
            commandInput.value = '';
            commandInput.focus();
        }
    }
    
    // Event listeners with proper type safety
    sendButton.addEventListener('click', (): void => {
        void sendCommand(); // Explicitly handle async function
    });
    
    // Submit command on Enter key press
    commandInput.addEventListener('keypress', (event: KeyboardEvent): void => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent any form submission
            void sendCommand();
        }
    });
    
    // Close button functionality
    closeButton.addEventListener('click', (): void => {
        if (api) {
            api.close();
        }
    });
    
    // Set initial focus to command input
    commandInput.focus();

    // Register theme listener
    registerThemeListener();

    // Cleanup listeners when window is about to unload
    window.addEventListener('beforeunload', (): void => {
        if (api) {
            api.removeListeners();
        }
    });
});

function registerThemeListener(): void {
    window.sendCmdsApi?.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}

