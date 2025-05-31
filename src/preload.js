// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();

// Add camera service URL for renderer
try {
    // Get camera service port
    const cameraPort = ipcRenderer.sendSync('get-camera-proxy-port');
    // Create a unique session ID for the desktop UI
    const sessionId = 'desktop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    // Create the camera URL with the session ID
    contextBridge.exposeInMainWorld('CAMERA_URL', `http://localhost:${cameraPort}/camera?session=${sessionId}`);
} catch (error) {
    console.warn('Could not get camera service URL, using default:', error);
    // Add a unique session ID to the fallback URL too
    const sessionId = 'desktop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    contextBridge.exposeInMainWorld('CAMERA_URL', `http://localhost:8181/camera?session=${sessionId}`); // Default fallback
}

contextBridge.exposeInMainWorld(
    'api',
    {
        // Expose whether the camera proxy is available
        isProxyAvailable: true, // Always true as we're implementing the proxy
        
        // Get Web UI port from main process
        send: async (channel, data) => {
            // whitelist channels
            const validChannels = [
                'request-printer-data',
                'home-axes',
                'pause-print',
                'resume-print',
                'cancel-print',
                'clear-status',
                'led-on',
                'led-off',
                'bed-temp-off',
                'set-bed-temp',
                'extruder-temp-off',
                'set-extruder-temp',
                'external-filtration',
                'internal-filtration',
                'no-filtration',
                'toggle-preview',
                'upload-job-dialog',
                'show-recent-files',
                'show-local-files',
                'show-filament-dialog',
                'show-command-dialog',
                'show-send-cmds',
                'connect-button-clicked',
                'open-settings-window',
                'open-status-dialog',
                'window-minimize',
                'window-maximize',
                'window-close',
                'show-input-dialog',
                'close-job-picker',
                'job-selected',
                'request-thumbnail',
                'request-legacy-thumbnail'
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            const validChannels = [
                'printer-data',
                'printer-connected',
                'printer-disconnected',
                'command-response',
                'log-message',
                'dialog-response',
                'job-list',
                'thumbnail-result',
                'legacy-thumbnail-result',
                'job-selection-result'
            ];
            if (validChannels.includes(channel)) {
                const wrappedFunc = (event, ...args) => func(...args);
                listeners.set(channel, { original: func, wrapped: wrappedFunc });
                ipcRenderer.on(channel, wrappedFunc);
            }
        },
        removeListener: (channel) => {
            const validChannels = [
                'printer-data',
                'printer-connected',
                'printer-disconnected',
                'command-response',
                'log-message',
                'dialog-response',
                'job-list',
                'thumbnail-result',
                'legacy-thumbnail-result',
                'job-selection-result'
            ];
            
            if (validChannels.includes(channel)) {
                const listener = listeners.get(channel);
                if (listener && listener.wrapped) {
                    // Remove the specific listener
                    ipcRenderer.removeListener(channel, listener.wrapped);
                    listeners.delete(channel);
                    //console.log(`Removed listener for ${channel}`);
                } else {
                    // If no specific listener found, remove all listeners for this channel
                    ipcRenderer.removeAllListeners(channel);
                    //console.log(`Removed all listeners for ${channel}`);
                }
            }
        },
        removeAllListeners: () => {
            // Clean up all registered listeners
            listeners.forEach((listener, channel) => {
                if (listener && listener.wrapped) {
                    ipcRenderer.removeListener(channel, listener.wrapped);
                }
            });
            
            // Clear the listeners map
            listeners.clear();
            //console.log('All IPC listeners cleaned up');
        }
    }
);
