/**
 * @fileoverview Preload script for secure renderer-to-main process IPC communication.
 *
 * Provides the context bridge API that exposes safe IPC methods to the renderer process:
 * - Core IPC methods (send/receive/invoke with channel validation)
 * - Printer status and data request APIs
 * - Loading overlay control API
 * - Camera management API (proxy, config, streaming)
 * - Printer context management API (multi-printer support)
 * - Connection state API
 * - Per-printer settings API
 *
 * Key exports:
 * - ElectronAPI: Main API exposed to renderer via window.electronAPI
 * - Specialized sub-APIs: LoadingAPI, CameraAPI, PrinterContextsAPI, etc.
 *
 * Security features:
 * - Whitelisted IPC channels for send/invoke operations
 * - Listener management with cleanup support
 * - Type-safe API interfaces for renderer consumption
 * - Isolated context bridge to prevent prototype pollution
 *
 * The preload script runs in a privileged context with access to Node.js and Electron APIs,
 * while exposing only safe, validated methods to the renderer process through contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// IPC event listener function type
type IPCListener = (...args: unknown[]) => void;

// API interface for type safety
interface ElectronAPI {
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: IPCListener) => void;
  removeListener: (channel: string) => void;
  removeAllListeners: () => void;
  showInputDialog: (options: InputDialogOptions) => Promise<string | null>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  requestPrinterStatus: () => Promise<unknown>;
  requestMaterialStationStatus: () => Promise<unknown>;
  requestModelPreview: () => Promise<string | null>;
  requestBackendStatus: () => Promise<unknown>;
  onPlatformInfo: (callback: (platform: string) => void) => void;
  loading: LoadingAPI;
  camera: CameraAPI;
  printerContexts: PrinterContextsAPI;
  connectionState: ConnectionStateAPI;
  printerSettings: PrinterSettingsAPI;
}

// Camera API interface
interface CameraAPI {
  getProxyPort: () => Promise<number>;
  getStatus: () => Promise<unknown>;
  setEnabled: (enabled: boolean) => Promise<void>;
  getConfig: () => Promise<unknown>;
  getProxyUrl: () => Promise<string>;
  restoreStream: () => Promise<boolean>;
  getStreamUrl: (contextId?: string) => Promise<string | null>;
}

// Printer Context API interface
interface PrinterContextsAPI {
  getAll: () => Promise<unknown>;
  getActive: () => Promise<unknown>;
  switch: (contextId: string) => Promise<void>;
  remove: (contextId: string) => Promise<void>;
  create: (printerDetails: unknown) => Promise<string>;
}

// Connection State API interface
interface ConnectionStateAPI {
  isConnected: (contextId?: string) => Promise<boolean>;
  getState: (contextId?: string) => Promise<unknown>;
}

// Printer Settings API interface
interface PrinterSettingsAPI {
  get: () => Promise<unknown>;
  update: (settings: unknown) => Promise<boolean>;
  getPrinterName: () => Promise<string | null>;
}

// Input dialog options interface
interface InputDialogOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  inputType?: 'text' | 'password' | 'hidden';
  placeholder?: string;
}

// Loading options interface (matches LoadingManager)
interface LoadingOptions {
  message: string;
  canCancel?: boolean;
  showProgress?: boolean;
  autoHideAfter?: number;
}

// Loading API interface
interface LoadingAPI {
  show: (options: LoadingOptions) => void;
  hide: () => void;
  showSuccess: (message: string, autoHideAfter?: number) => void;
  showError: (message: string, autoHideAfter?: number) => void;
  setProgress: (progress: number) => void;
  updateMessage: (message: string) => void;
  cancel: () => void;
}

const listeners = new Map<string, { original: IPCListener; wrapped: IPCListener }>();

// Valid IPC channels for security
const validSendChannels = [
  'request-printer-data',
  'request-printer-status',
  'request-material-station-status',
  'home-axes',
  'pause-print',
  'resume-print',
  'cancel-print',
  'clear-status',
  'led-on',
  'led-off',
  'turn-off-bed-temp',
  'turn-off-extruder-temp',
  'set-bed-temp',
  'set-extruder-temp',
  'set-filtration',
  'bed-temp-off',
  'extruder-temp-off',
  'external-filtration',
  'internal-filtration',
  'no-filtration',
  'toggle-preview',
  'upload-job-dialog',
  'show-recent-files',
  'show-local-files',
  'show-filament-dialog',
  'show-command-dialog',
  'open-send-commands',
  'connect-button-clicked',
  'open-settings-window',
  'open-status-dialog',
  'open-printer-selection',
  'open-job-uploader',
  'open-ifs-dialog',
  'window-minimize',
  'window-maximize',
  'window-close',
  'show-input-dialog',
  'close-job-picker',
  'job-selected',
  'request-thumbnail',
  'request-legacy-thumbnail',
  'dialog-window-minimize',
  'dialog-window-close',
  'close-current-window',
  'loading-cancel-request',
  'loading-show',
  'loading-hide',
  'loading-show-success',
  'loading-show-error',
  'loading-set-progress',
  'loading-update-message',
  'add-log-message',
  'open-log-dialog',
  'open-component-palette',
  'close-component-palette',
  'palette:remove-component',
  'palette:add-component',
  'palette:update-status',
  'palette:opened',
  'palette:toggle-edit-mode',
  'shortcut-config:open',
  'component-dialog:open'
];

const validReceiveChannels = [
  'printer-data',
  'backend-initialized',
  'backend-initialization-failed',
  'backend-disposed',
  'printer-connected',
  'printer-disconnected',
  'command-response',
  'log-message',
  'dialog-response',
  'job-list',
  'thumbnail-result',
  'legacy-thumbnail-result',
  'job-selection-result',
  'loading-state-changed',
  'loading-show',
  'loading-hide',
  'loading-success',
  'loading-error',
  'loading-progress',
  'loading-message-updated',
  'loading-cancelled',
  'polling-update',
  'platform-info',
  'printer-context-created',
  'printer-context-switched',
  'printer-context-removed',
  'printer-context-updated',
  'grid:remove-component',
  'grid:add-component',
  'grid:component-added',
  'palette:opened',
  'edit-mode:toggle',
  'shortcut-config:open',
  'component-dialog:open',
  'update-state-changed',
  'shortcut-config:updated',
  'shortcut-config:get-current-request',
  'shortcut-config:save-request',
  'shortcut-config:get-components-request'
];

// Expose camera URL for renderer
try {
  // Get camera proxy URL from IPC (this will be available after initialization)
  ipcRenderer.invoke('camera:get-proxy-url').then((url: unknown) => {
    if (typeof url === 'string') {
      contextBridge.exposeInMainWorld('CAMERA_URL', url);
    }
  }).catch((error: unknown) => {
    console.warn('Could not get camera proxy URL:', error);
    const sessionId = 'desktop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    contextBridge.exposeInMainWorld('CAMERA_URL', `http://localhost:8181/camera?session=${sessionId}`);
  });
} catch (error) {
  console.warn('Could not get camera service URL, using default:', error);
  const sessionId = 'desktop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  contextBridge.exposeInMainWorld('CAMERA_URL', `http://localhost:8181/camera?session=${sessionId}`);
}

// Expose platform directly (no IPC needed) - available synchronously to renderer
contextBridge.exposeInMainWorld('PLATFORM', process.platform);

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', {
  isProxyAvailable: true,
  
  send: (channel: string, data?: unknown) => {
    // Allow response channels (they start with specific prefixes and end with timestamps)
    const isResponseChannel =
      channel.startsWith('shortcut-config:') && channel.includes('-response-') ||
      channel.startsWith('component-dialog:') && channel.includes('-response-');

    if (validSendChannels.includes(channel) || isResponseChannel) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },

  receive: (channel: string, func: IPCListener) => {
    if (validReceiveChannels.includes(channel)) {
      const wrappedFunc: IPCListener = (event: unknown, ...args: unknown[]) => func(...args);
      listeners.set(channel, { original: func, wrapped: wrappedFunc });
      ipcRenderer.on(channel, wrappedFunc);
    } else {
      console.warn(`Invalid receive channel: ${channel}`);
    }
  },

  removeListener: (channel: string) => {
    if (validReceiveChannels.includes(channel)) {
      const listener = listeners.get(channel);
      if (listener && listener.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
        listeners.delete(channel);
      } else {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  },

  removeAllListeners: () => {
    listeners.forEach((listener, channel) => {
      if (listener && listener.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
      }
    });
    listeners.clear();
  },

  showInputDialog: async (options: InputDialogOptions): Promise<string | null> => {
    const result: unknown = await ipcRenderer.invoke('show-input-dialog', options);
    
    // Validate result is string or null
    if (typeof result === 'string' || result === null) {
      return result;
    } else {
      console.warn('Invalid input dialog result, returning null');
      return null;
    }
  },

  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
    // Only allow invoke on specific channels for security
    const validInvokeChannels = [
      'renderer-ready',  // CRITICAL: Allow renderer to signal it's ready for auto-connect
      'set-bed-temp',
      'set-extruder-temp',
      'turn-off-bed-temp',
      'turn-off-extruder-temp',
      'clear-status',
      'led-on',
      'led-off',
      'pause-print',
      'resume-print',
      'cancel-print',
      'home-axes',
      'set-filtration',
      'show-input-dialog',
      'request-printer-status',
      'request-material-station-status',
      'request-model-preview',
      'request-backend-status',
      'webui:start',
      'webui:stop',
      'webui:get-status',
      'webui:broadcast-status',
      'printer-contexts:get-all',
      'printer-contexts:get-active',
      'printer-contexts:switch',
      'printer-contexts:remove',
      'printer-contexts:create',
      'connection-state:is-connected',
      'connection-state:get-state',
      'camera:get-stream-url',
      'camera:get-rtsp-relay-info',
      'printer-settings:get',
      'printer-settings:update',
      'printer-settings:get-printer-name',
      'palette:get-components',
      'shortcut-config:get-current',
      'shortcut-config:save',
      'shortcut-config:get-available-components',
      'log-dialog-request-logs',
      'check-for-updates',
      'download-update',
      'install-update',
      'open-installer',
      'open-release-page',
      'get-update-status',
      'set-update-channel'
    ];
    
    if (validInvokeChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    } else {
      console.warn(`Invalid invoke channel: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
  },

  requestPrinterStatus: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('request-printer-status');
  },

  requestMaterialStationStatus: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('request-material-station-status');
  },

  requestModelPreview: async (): Promise<string | null> => {
    const result: unknown = await ipcRenderer.invoke('request-model-preview');
    // Validate result is string or null
    if (typeof result === 'string' || result === null) {
      return result;
    } else {
      console.warn('Invalid model preview result, returning null');
      return null;
    }
  },

  requestBackendStatus: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('request-backend-status');
  },

  onPlatformInfo: (callback: (platform: string) => void) => {
    const wrappedCallback: IPCListener = (event: unknown, platform: unknown) => {
      if (typeof platform === 'string') {
        callback(platform);
      } else {
        console.warn('Invalid platform info received:', platform);
      }
    };
    
    listeners.set('platform-info', { original: callback as IPCListener, wrapped: wrappedCallback });
    ipcRenderer.once('platform-info', wrappedCallback);
  },

  loading: {
    show: (options: LoadingOptions) => {
      ipcRenderer.send('loading-show', options);
    },
    
    hide: () => {
      ipcRenderer.send('loading-hide');
    },
    
    showSuccess: (message: string, autoHideAfter?: number) => {
      ipcRenderer.send('loading-show-success', { message, autoHideAfter });
    },
    
    showError: (message: string, autoHideAfter?: number) => {
      ipcRenderer.send('loading-show-error', { message, autoHideAfter });
    },
    
    setProgress: (progress: number) => {
      ipcRenderer.send('loading-set-progress', { progress });
    },
    
    updateMessage: (message: string) => {
      ipcRenderer.send('loading-update-message', { message });
    },
    
    cancel: () => {
      ipcRenderer.send('loading-cancel-request');
    }
  },
  
  camera: {
    getProxyPort: async (): Promise<number> => {
      const result: unknown = await ipcRenderer.invoke('camera:get-proxy-port');
      return typeof result === 'number' ? result : 8181;
    },

    getStatus: async (): Promise<unknown> => {
      return await ipcRenderer.invoke('camera:get-status');
    },

    setEnabled: async (enabled: boolean): Promise<void> => {
      await ipcRenderer.invoke('camera:set-enabled', enabled);
    },

    getConfig: async (): Promise<unknown> => {
      return await ipcRenderer.invoke('camera:get-config');
    },

    getProxyUrl: async (): Promise<string> => {
      const result: unknown = await ipcRenderer.invoke('camera:get-proxy-url');
      return typeof result === 'string' ? result : 'http://localhost:8181/camera';
    },

    restoreStream: async (): Promise<boolean> => {
      const result: unknown = await ipcRenderer.invoke('camera:restore-stream');
      return typeof result === 'boolean' ? result : false;
    },

    getStreamUrl: async (contextId?: string): Promise<string | null> => {
      const result: unknown = await ipcRenderer.invoke('camera:get-stream-url', contextId);
      return typeof result === 'string' ? result : null;
    }
  },

  printerContexts: {
    getAll: async (): Promise<unknown> => {
      return await ipcRenderer.invoke('printer-contexts:get-all');
    },

    getActive: async (): Promise<unknown> => {
      return await ipcRenderer.invoke('printer-contexts:get-active');
    },

    switch: async (contextId: string): Promise<void> => {
      await ipcRenderer.invoke('printer-contexts:switch', contextId);
    },

    remove: async (contextId: string): Promise<void> => {
      await ipcRenderer.invoke('printer-contexts:remove', contextId);
    },

    create: async (printerDetails: unknown): Promise<string> => {
      const result: unknown = await ipcRenderer.invoke('printer-contexts:create', printerDetails);
      return typeof result === 'string' ? result : '';
    }
  },

  connectionState: {
    isConnected: async (contextId?: string): Promise<boolean> => {
      const result: unknown = await ipcRenderer.invoke('connection-state:is-connected', contextId);
      return typeof result === 'boolean' ? result : false;
    },

    getState: async (contextId?: string): Promise<unknown> => {
      return await ipcRenderer.invoke('connection-state:get-state', contextId);
    }
  },

  printerSettings: {
    get: async (): Promise<unknown> => {
      return await ipcRenderer.invoke('printer-settings:get');
    },

    update: async (settings: unknown): Promise<boolean> => {
      const result: unknown = await ipcRenderer.invoke('printer-settings:update', settings);
      return typeof result === 'boolean' ? result : false;
    },

    getPrinterName: async (): Promise<string | null> => {
      const result: unknown = await ipcRenderer.invoke('printer-settings:get-printer-name');
      return typeof result === 'string' ? result : null;
    }
  }
} as ElectronAPI);

// Type declarations for the renderer process
declare global {
  interface Window {
    api: ElectronAPI;
    CAMERA_URL: string;
  }
}

