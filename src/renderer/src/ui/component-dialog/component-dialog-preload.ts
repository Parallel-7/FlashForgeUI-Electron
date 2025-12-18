/**
 * @fileoverview Preload script for component dialog windows
 *
 * Provides secure IPC communication bridge between the component dialog renderer
 * and the main process. Exposes both the specialized componentDialogAPI used for
 * dialog lifecycle coordination and a scoped window.api surface that mirrors the
 * main renderer preload so shared components can operate without modification.
 *
 * The API surface intentionally mirrors the main renderer preload to ensure
 * components instantiated inside the dialog have access to the same IPC helpers
 * (send/receive/invoke, camera API, input dialogs, etc.). Channel validation is
 * preserved to maintain security guarantees.
 *
 * @module ui/component-dialog/component-dialog-preload
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { CameraProxyStatus } from '@shared/types/camera/camera.types.js';
import type { AppConfig, ThemeColors } from '@shared/types/config.js';
import type {} from '@shared/types/global.d.ts';

// ---------------------------------------------------------------------------
// Shared type definitions
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Channel validation setup (mirrors main preload)
// ---------------------------------------------------------------------------

type DialogIPCListener = (...args: unknown[]) => void;
type DialogEventDisposer = () => void;

interface DialogInputDialogOptions {
  readonly title?: string;
  readonly message?: string;
  readonly defaultValue?: string;
  readonly inputType?: 'text' | 'password' | 'hidden';
  readonly placeholder?: string;
}

interface DialogLoadingOptions {
  readonly message: string;
  readonly canCancel?: boolean;
  readonly showProgress?: boolean;
  readonly autoHideAfter?: number;
}

interface DialogCameraAPI {
  getProxyPort: () => Promise<number>;
  getStatus: (contextId?: string) => Promise<CameraProxyStatus | null>;
  setEnabled: (enabled: boolean) => Promise<void>;
  getConfig: () => Promise<unknown>;
  getProxyUrl: () => Promise<string>;
  restoreStream: () => Promise<boolean>;
  getStreamUrl: (contextId?: string) => Promise<string | null>;
}

interface DialogPrinterContextsAPI {
  getAll: () => Promise<unknown>;
  getActive: () => Promise<unknown>;
  switch: (contextId: string) => Promise<void>;
  remove: (contextId: string) => Promise<void>;
  create: (printerDetails: unknown) => Promise<string>;
}

interface DialogConnectionStateAPI {
  isConnected: (contextId?: string) => Promise<boolean>;
  getState: (contextId?: string) => Promise<unknown>;
}

interface DialogPrinterSettingsAPI {
  get: () => Promise<unknown>;
  update: (settings: unknown) => Promise<boolean>;
  getPrinterName: () => Promise<string | null>;
}

interface DialogSpoolmanAPI {
  openSpoolSelection: () => Promise<void>;
  getActiveSpool: (contextId?: string) => Promise<unknown>;
  setActiveSpool: (spool: unknown, contextId?: string) => Promise<void>;
  getStatus: (contextId?: string) => Promise<{ enabled: boolean; disabledReason?: string | null; contextId?: string | null }>;
  onSpoolSelected: (callback: (spool: unknown) => void) => void;
  onSpoolUpdated: (callback: (spool: unknown) => void) => void;
}

interface DialogConfigAPI {
  get: () => Promise<AppConfig>;
  onLoaded: (callback: () => void) => DialogEventDisposer;
  onUpdated: (callback: (config: AppConfig) => void) => DialogEventDisposer;
  onThemePreview: (callback: (theme: ThemeColors) => void) => DialogEventDisposer;
}

interface DialogLoadingAPI {
  show: (options: DialogLoadingOptions) => void;
  hide: () => void;
  showSuccess: (message: string, autoHideAfter?: number) => void;
  showError: (message: string, autoHideAfter?: number) => void;
  setProgress: (progress: number) => void;
  updateMessage: (message: string) => void;
  cancel: () => void;
}

interface DialogElectronAPI {
  readonly isProxyAvailable: boolean;
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: DialogIPCListener) => void;
  removeListener: (channel: string) => void;
  removeAllListeners: () => void;
  showInputDialog: (options: DialogInputDialogOptions) => Promise<string | null>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  requestPrinterStatus: () => Promise<unknown>;
  requestMaterialStationStatus: () => Promise<unknown>;
  requestModelPreview: () => Promise<string | null>;
  requestBackendStatus: () => Promise<unknown>;
  requestConfig: () => Promise<unknown>;
  onPlatformInfo: (callback: (platform: string) => void) => void;
  readonly config: DialogConfigAPI;
  readonly loading: DialogLoadingAPI;
  readonly camera: DialogCameraAPI;
  readonly printerContexts: DialogPrinterContextsAPI;
  readonly connectionState: DialogConnectionStateAPI;
  readonly printerSettings: DialogPrinterSettingsAPI;
  readonly spoolman: DialogSpoolmanAPI;
}

const listeners = new Map<string, { original: DialogIPCListener; wrapped: DialogIPCListener }>();

const componentDialogAPI = {
  receive: (channel: string, func: (data: unknown) => void): (() => void) | undefined => {
    const validChannels = ['component-dialog:init', 'polling-update', 'theme-changed'];
    if (validChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        func(args.length === 1 ? args[0] : args);
      };
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return undefined;
  },
  send: (channel: string, ...data: unknown[]) => {
    const validChannels = ['component-dialog:close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...data);
    }
  },
  invoke: async (channel: string, ...data: unknown[]): Promise<unknown> => {
    const validChannels = ['component-dialog:get-info', 'component-dialog:get-polling-data'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...data);
    }
    return null;
  }
};

const registerDialogVoidListener = (channel: string, callback: () => void): DialogEventDisposer => {
  const wrapped: DialogIPCListener = () => callback();
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const registerDialogPayloadListener = <T,>(channel: string, callback: (payload: T) => void): DialogEventDisposer => {
  const wrapped: DialogIPCListener = (_event: unknown, payload: unknown) => {
    callback(payload as T);
  };
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

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
  'open-about-dialog',
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
  'component-dialog:open',
  'component-dialog:close'
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
  'shortcut-config:updated',
  'shortcut-config:get-current-request',
  'shortcut-config:save-request',
  'shortcut-config:get-components-request',
  'log-dialog-new-message',
  'log-dialog-cleared',
  'spoolman:spool-selected',
  'spoolman:spool-updated'
];

const validInvokeChannels = [
  'renderer-ready',
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
  'request-config',
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
  'spoolman:get-status',
  'palette:get-components',
  'shortcut-config:get-current',
  'shortcut-config:save',
  'shortcut-config:get-available-components',
  'log-dialog-request-logs',
  'log-dialog-clear-logs',
  'spoolman:open-dialog',
  'spoolman:get-active-spool',
  'spoolman:set-active-spool'
];

// ---------------------------------------------------------------------------
// window.api exposure (mirrors main renderer preload)
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('PLATFORM', process.platform as string);

const dialogConfigAPI: DialogConfigAPI = {
  get: async (): Promise<AppConfig> => {
    const result = await ipcRenderer.invoke('request-config');
    return result as AppConfig;
  },
  onLoaded: (callback: () => void): DialogEventDisposer => {
    return registerDialogVoidListener('config-loaded', callback);
  },
  onUpdated: (callback: (config: AppConfig) => void): DialogEventDisposer => {
    return registerDialogPayloadListener<AppConfig>('config-updated', (config) => {
      if (config) {
        callback(config);
      }
    });
  },
  onThemePreview: (callback: (theme: ThemeColors) => void): DialogEventDisposer => {
    return registerDialogPayloadListener<ThemeColors>('desktop-theme-preview', (theme) => {
      if (theme) {
        callback(theme);
      }
    });
  }
};

contextBridge.exposeInMainWorld('api', {
  isProxyAvailable: true,

  send: (channel: string, data?: unknown) => {
    const isResponseChannel =
      (channel.startsWith('shortcut-config:') || channel.startsWith('component-dialog:')) &&
      channel.includes('-response-');

    if (validSendChannels.includes(channel) || isResponseChannel) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },

  receive: (channel: string, func: DialogIPCListener) => {
    if (validReceiveChannels.includes(channel)) {
      const wrapped: DialogIPCListener = (_event: unknown, ...args: unknown[]) => func(...args);
      listeners.set(channel, { original: func, wrapped });
      ipcRenderer.on(channel, wrapped);
    } else {
      console.warn(`Invalid receive channel: ${channel}`);
    }
  },

  removeListener: (channel: string) => {
    if (validReceiveChannels.includes(channel)) {
      const listener = listeners.get(channel);
      if (listener?.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
        listeners.delete(channel);
      } else {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  },

  removeAllListeners: () => {
    listeners.forEach((listener, channel) => {
      if (listener?.wrapped) {
        ipcRenderer.removeListener(channel, listener.wrapped);
      }
    });
    listeners.clear();
  },

  showInputDialog: async (options: DialogInputDialogOptions): Promise<string | null> => {
    const result: unknown = await ipcRenderer.invoke('show-input-dialog', options);
    return typeof result === 'string' || result === null ? result : null;
  },

  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!validInvokeChannels.includes(channel)) {
      console.warn(`Invalid invoke channel: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  requestPrinterStatus: async (): Promise<unknown> => ipcRenderer.invoke('request-printer-status'),
  requestMaterialStationStatus: async (): Promise<unknown> => ipcRenderer.invoke('request-material-station-status'),
  requestModelPreview: async (): Promise<string | null> => {
    const result: unknown = await ipcRenderer.invoke('request-model-preview');
    return typeof result === 'string' || result === null ? result : null;
  },
  requestBackendStatus: async (): Promise<unknown> => ipcRenderer.invoke('request-backend-status'),
  requestConfig: async (): Promise<unknown> => ipcRenderer.invoke('request-config'),
  config: dialogConfigAPI,

  onPlatformInfo: (callback: (platform: string) => void) => {
    const wrapped: DialogIPCListener = (_event: unknown, platform: unknown) => {
      if (typeof platform === 'string') {
        callback(platform);
      } else {
        console.warn('Invalid platform info received:', platform);
      }
    };

    listeners.set('platform-info', { original: callback as DialogIPCListener, wrapped });
    ipcRenderer.once('platform-info', wrapped);
  },

  loading: {
    show: (options: DialogLoadingOptions) => ipcRenderer.send('loading-show', options),
    hide: () => ipcRenderer.send('loading-hide'),
    showSuccess: (message: string, autoHideAfter?: number) =>
      ipcRenderer.send('loading-show-success', { message, autoHideAfter }),
    showError: (message: string, autoHideAfter?: number) =>
      ipcRenderer.send('loading-show-error', { message, autoHideAfter }),
    setProgress: (progress: number) => ipcRenderer.send('loading-set-progress', { progress }),
    updateMessage: (message: string) => ipcRenderer.send('loading-update-message', { message }),
    cancel: () => ipcRenderer.send('loading-cancel-request')
  },

  camera: {
    getProxyPort: async (): Promise<number> => {
      const result: unknown = await ipcRenderer.invoke('camera:get-proxy-port');
      return typeof result === 'number' ? result : 8181;
    },
    getStatus: async (contextId?: string): Promise<CameraProxyStatus | null> => {
      const result: unknown = await ipcRenderer.invoke('camera:get-status', contextId);
      if (result === null) {
        return null;
      }

      return typeof result === 'object' ? (result as CameraProxyStatus) : null;
    },
    setEnabled: async (enabled: boolean): Promise<void> => {
      await ipcRenderer.invoke('camera:set-enabled', enabled);
    },
    getConfig: async (): Promise<unknown> => ipcRenderer.invoke('camera:get-config'),
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
    getAll: async (): Promise<unknown> => ipcRenderer.invoke('printer-contexts:get-all'),
    getActive: async (): Promise<unknown> => ipcRenderer.invoke('printer-contexts:get-active'),
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
    getState: async (contextId?: string): Promise<unknown> => ipcRenderer.invoke('connection-state:get-state', contextId)
  },

  printerSettings: {
    get: async (): Promise<unknown> => ipcRenderer.invoke('printer-settings:get'),
    update: async (settings: unknown): Promise<boolean> => {
      const result: unknown = await ipcRenderer.invoke('printer-settings:update', settings);
      return typeof result === 'boolean' ? result : false;
    },
    getPrinterName: async (): Promise<string | null> => {
      const result: unknown = await ipcRenderer.invoke('printer-settings:get-printer-name');
      return typeof result === 'string' ? result : null;
    }
  },

  spoolman: {
    openSpoolSelection: async (): Promise<void> => {
      await ipcRenderer.invoke('spoolman:open-dialog');
    },
    getActiveSpool: async (contextId?: string): Promise<unknown> => {
      return await ipcRenderer.invoke('spoolman:get-active-spool', contextId);
    },
    setActiveSpool: async (spool: unknown, contextId?: string): Promise<void> => {
      await ipcRenderer.invoke('spoolman:set-active-spool', spool, contextId);
    },
    getStatus: async (contextId?: string): Promise<{ enabled: boolean; contextId: string | null; disabledReason: string | null }> => {
      return await ipcRenderer.invoke('spoolman:get-status', contextId) as { enabled: boolean; contextId: string | null; disabledReason: string | null };
    },
    onSpoolSelected: (callback: (spool: unknown) => void) => {
      const wrapped: DialogIPCListener = (_event: unknown, spool: unknown) => callback(spool);
      listeners.set('spoolman:spool-selected', { original: callback as DialogIPCListener, wrapped });
      ipcRenderer.on('spoolman:spool-selected', wrapped);
    },
    onSpoolUpdated: (callback: (spool: unknown) => void) => {
      const wrapped: DialogIPCListener = (_event: unknown, spool: unknown) => callback(spool);
      listeners.set('spoolman:spool-updated', { original: callback as DialogIPCListener, wrapped });
      ipcRenderer.on('spoolman:spool-updated', wrapped);
    }
  },
  dialog: {
    component: componentDialogAPI
  }
} as DialogElectronAPI);

// ---------------------------------------------------------------------------
// Component dialog specific API
// ---------------------------------------------------------------------------

