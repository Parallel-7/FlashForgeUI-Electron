// src/utils/EventUtils.js

/**
 * Event Utilities for FlashForge UI
 * This module centralizes event handling and communication with the main process
 */

import { logMessage as uiLogMessage } from './UIUtils.js'; // Renamed to avoid conflict if logMessage is passed in callbacks

// Store references to event listeners for cleanup
const eventListeners = new Map();

/**
 * Sets up event listeners for IPC communication
 * @param {Object} api - The window.api object
 * @param {Object} callbacks - Callback functions for different events
 */
export function setupIPCListeners(api, callbacks) {
    const {
        onPrinterData,
        onResetUI,
        onJobSelectionResult,
        onPrinterConnected,
        onPrinterDisconnected,
        onLogMessage,
        onLegacyThumbnailResult
    } = callbacks;

    if (onPrinterData) {
        eventListeners.set('printer-data', onPrinterData);
        api.receive('printer-data', onPrinterData);
    }
    if (onResetUI) {
        eventListeners.set('reset-ui', onResetUI);
        api.receive('reset-ui', onResetUI);
    }
    if (onJobSelectionResult) {
        eventListeners.set('job-selection-result', onJobSelectionResult);
        api.receive('job-selection-result', onJobSelectionResult);
    }
    if (onPrinterConnected) {
        eventListeners.set('printer-connected', onPrinterConnected);
        api.receive('printer-connected', onPrinterConnected);
    }
    if (onPrinterDisconnected) {
        eventListeners.set('printer-disconnected', onPrinterDisconnected);
        api.receive('printer-disconnected', onPrinterDisconnected);
    }
    if (onLogMessage) {
        eventListeners.set('log-message', onLogMessage);
        api.receive('log-message', onLogMessage); // Listen to the 'log-message' channel
    }
    
    if (onLegacyThumbnailResult) {
        eventListeners.set('legacy-thumbnail-result', onLegacyThumbnailResult);
        api.receive('legacy-thumbnail-result', onLegacyThumbnailResult);
    }
}

/**
 * Sets up window control buttons
 * @param {Object} api - The window.api object
 */
export function setupWindowControls(api) {
    document.getElementById('btn-minimize').addEventListener('click', () => {
        api.send('window-minimize');
    });

    document.getElementById('btn-maximize').addEventListener('click', () => {
        api.send('window-maximize');
    });

    document.getElementById('btn-close').addEventListener('click', () => {
        api.send('window-close');
    });
}

/**
 * Creates a command sender function
 * @param {Object} api - The window.api object
 * @param {string} command - Command to send
 * @param {string} logText - Text to log
 * @returns {Function} - Function that sends the command and logs
 */
export function createCommandSender(api, command, logText) {
    return () => {
        api.send(command);
        // Use the imported logMessage directly from UIUtils, or ensure it's passed correctly
        // For messages originating from renderer actions, it's fine to call uiLogMessage.
        // The onLogMessage callback is for messages from the main process.
        uiLogMessage(`Command: ${logText}`);
    };
}

/**
 * Sets up temperature control buttons
 * @param {Object} api - The window.api object
 * @param {Function} showInputDialog - Function to show input dialog
 */
export function setupTemperatureControls(api, showInputDialog) {
    // Set Bed Temperature
    document.getElementById('btn-bed-set').addEventListener('click', async () => {
        const result = await showInputDialog(
            'Set Bed Temperature',
            'Enter bed temperature (°C):',
            '50'
        );

        if (result !== null) {
            api.send('set-bed-temp', parseInt(result, 10));
            uiLogMessage('Command: Set Bed Temperature to ' + result + '°C');
        }
    });

    // Set Extruder Temperature
    document.getElementById('btn-extruder-set').addEventListener('click', async () => {
        const result = await showInputDialog(
            'Set Extruder Temperature',
            'Enter extruder temperature (°C):',
            '200'
        );

        if (result !== null) {
            api.send('set-extruder-temp', parseInt(result, 10));
            uiLogMessage('Command: Set Extruder Temperature to ' + result + '°C');
        }
    });

    // Bed Heating Off
    document.getElementById('btn-bed-off').addEventListener('click',
        createCommandSender(api, 'bed-temp-off', 'Bed Temperature Off'));

    // Extruder Heating Off
    document.getElementById('btn-extruder-off').addEventListener('click',
        createCommandSender(api, 'extruder-temp-off', 'Extruder Temperature Off'));
}

/**
 * Sets up filtration control buttons
 * @param {Object} api - The window.api object
 */
export function setupFiltrationControls(api) {
    document.getElementById('btn-external-filtration').addEventListener('click',
        createCommandSender(api, 'external-filtration', 'External Filtration On'));

    document.getElementById('btn-internal-filtration').addEventListener('click',
        createCommandSender(api, 'internal-filtration', 'Internal Filtration On'));

    document.getElementById('btn-no-filtration').addEventListener('click',
        createCommandSender(api, 'no-filtration', 'Filtration Off'));
}

/**
 * Sets up job control buttons
 * @param {Object} api - The window.api object
 */
export function setupJobControls(api) {
    document.getElementById('btn-upload-job').addEventListener('click',
        createCommandSender(api, 'upload-job-dialog', 'Upload Job'));

    document.getElementById('btn-start-recent').addEventListener('click',
        createCommandSender(api, 'show-recent-files', 'Start Recent'));

    document.getElementById('btn-start-local').addEventListener('click',
        createCommandSender(api, 'show-local-files', 'Start Local'));

    document.getElementById('btn-swap-filament').addEventListener('click',
        createCommandSender(api, 'show-filament-dialog', 'Swap Filament'));

    document.getElementById('btn-send-cmds').addEventListener('click',
        createCommandSender(api, 'show-send-cmds', 'Send Commands'));
}

/**
 * Sets up settings and connection buttons
 * @param {Object} api - The window.api object
 */
export function setupSettingsAndConnection(api) {
    const settingsButton = document.getElementById('btn-settings');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("Settings button clicked");
            api.send('open-settings-window');
        });
    } else {
        console.error("Settings button (#btn-settings) not found!");
    }

    const connectButton = document.getElementById('btn-connect');
    if (connectButton) {
        connectButton.addEventListener('click', () => {
            console.log("Connect button clicked");
            connectButton.textContent = 'Connecting...'; // Indicate activity
            api.send('connect-button-clicked');
        });
    } else {
        console.error("Connect button (#btn-connect) not found!");
    }
}

/**
 * Cleans up IPC listeners to prevent memory leaks
 * @param {Object} api - The window.api object
 */
export function cleanupIPCListeners(api) {
    if (!api) {
        console.warn('API object is not available for cleanup');
        return;
    }

    try {
        // Use the preload's removeAllListeners method if available
        if (typeof api.removeAllListeners === 'function') {
            api.removeAllListeners();
            console.log('All IPC listeners cleaned up using api.removeAllListeners');
        }
        // Fall back to individual channel cleanup if only removeListener is available
        else if (typeof api.removeListener === 'function') {
            const channels = [
                'printer-data',
                'reset-ui',
                'job-selection-result',
                'printer-connected',
                'printer-disconnected',
                'command-response',
                'log-message', // Ensure this is in the list if using individual removal
                'dialog-response',
                'job-list',
                'thumbnail-result'
            ];

            channels.forEach(channel => {
                // Check if a specific listener was stored for this channel before removing
                const listenerCallback = eventListeners.get(channel);
                if (listenerCallback) {
                    api.removeListener(channel, listenerCallback);
                } else {
                    // Fallback if not in map (less ideal, but covers cases)
                    // This part of the preload's removeListener isn't implemented
                    // to take a specific function. Preload.js removeListener removes all for a channel if no func given.
                    // So it's better to rely on api.removeAllListeners() or be very precise.
                    // For now, this will rely on preload's behavior if no specific func is passed.
                }
            });
            console.log('IPC listeners potentially cleaned up using api.removeListener for specific channels.');
        } else {
            console.warn('API object does not support listener removal methods');
        }
    } catch (error) {
        console.error('Error cleaning up IPC listeners:', error);
    }

    // Clear the event listeners map from EventUtils
    eventListeners.clear();
}