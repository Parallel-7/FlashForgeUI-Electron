/**
 * @fileoverview Global type augmentations for renderer process Window interface
 *
 * Extends the Window interface with Electron API methods exposed by the preload script
 * via contextBridge, providing complete type safety for IPC communication between
 * renderer and main processes. Defines interfaces for all exposed APIs including
 * printer control, camera management, loading states, and window controls.
 *
 * Key Interface Groups:
 * - ElectronAPI: Core IPC communication (send, receive, invoke)
 * - LoadingAPI: Loading state management and progress indication
 * - CameraAPI: Camera proxy control and stream configuration
 * - PrinterContextsAPI: Multi-printer context management
 * - ConnectionStateAPI: Connection status and state queries
 * - PrinterSettingsAPI: Per-printer settings management
 * - SpoolmanAPI: Filament tracking and spool management
 * - WindowControls: Sub-window control methods (minimize, close)
 *
 * Window Extensions:
 * - window.api: Main ElectronAPI interface
 * - window.CAMERA_URL: Camera stream URL constant
 * - window.windowControls: Window management (sub-windows only)
 * - window.logMessage: Debug logging helper
 *
 * @module types/global
 */

import type { ActiveSpoolData, SpoolResponse, SpoolSearchQuery } from './spoolman.js';
import type { CameraProxyStatus } from './camera/camera.types.js';
import type {
  ShortcutButtonConfig,
  ShortcutComponentInfo,
  ShortcutDialogInitData,
  ShortcutSaveConfigResult
} from './shortcut-config.js';

// IPC event listener function type
type IPCListener = (...args: unknown[]) => void;

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

// Camera API interface
interface CameraAPI {
  getProxyPort(): Promise<number>;
  getStatus(contextId?: string): Promise<CameraProxyStatus | null>;
  setEnabled(enabled: boolean): Promise<void>;
  getConfig(): Promise<unknown>;
  getProxyUrl(): Promise<string>;
  restoreStream(): Promise<boolean>;
  getStreamUrl(contextId?: string): Promise<string | null>;
}

// Printer Context API interface
interface PrinterContextsAPI {
  getAll(): Promise<unknown>;
  getActive(): Promise<unknown>;
  switch(contextId: string): Promise<void>;
  remove(contextId: string): Promise<void>;
  create(printerDetails: unknown): Promise<string>;
}

// Connection State API interface
interface ConnectionStateAPI {
  isConnected(contextId?: string): Promise<boolean>;
  getState(contextId?: string): Promise<unknown>;
}

// Printer Settings API interface
interface PrinterSettingsAPI {
  get(): Promise<unknown>;
  update(settings: unknown): Promise<boolean>;
  getPrinterName(): Promise<string | null>;
}

// Spoolman API interface
interface SpoolmanAPI {
  openSpoolSelection(): Promise<void>;
  getActiveSpool(contextId?: string): Promise<unknown>;
  setActiveSpool(spool: unknown, contextId?: string): Promise<void>;
  getStatus(contextId?: string): Promise<{ enabled: boolean; disabledReason?: string | null; contextId?: string | null }>;
  onSpoolSelected(callback: (spool: unknown) => void): void;
  onSpoolUpdated(callback: (spool: unknown) => void): void;
}

/**
 * Component dialog specific IPC surface exposed via context bridge.
 */
interface ComponentDialogAPI {
  receive: (
    channel: 'component-dialog:init' | 'polling-update' | 'theme-changed',
    func: (data: unknown) => void
  ) => (() => void) | undefined;
  send: (channel: 'component-dialog:close', ...data: unknown[]) => void;
  invoke: (channel: 'component-dialog:get-info', ...data: unknown[]) => Promise<unknown>;
}

/**
 * Shortcut configuration dialog IPC contract exposed through the preload script.
 */
interface ShortcutConfigDialogAPI {
  onDialogInit: (callback: (data: ShortcutDialogInitData) => void) => void;
  getCurrentConfig: () => Promise<ShortcutButtonConfig | null>;
  saveConfig: (config: ShortcutButtonConfig) => Promise<ShortcutSaveConfigResult>;
  getAvailableComponents: () => Promise<ShortcutComponentInfo[]>;
  closeDialog: (responseChannel: string) => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

/**
 * Spoolman dialog specific API for searching and selecting spools.
 */
interface SpoolmanDialogAPI {
  searchSpools: (query: SpoolSearchQuery) => Promise<SpoolResponse[]>;
  selectSpool: (spool: ActiveSpoolData) => Promise<void>;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

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
  requestConfig: () => Promise<unknown>;
  onPlatformInfo: (callback: (platform: string) => void) => void;
  loading: LoadingAPI;
  camera: CameraAPI;
  printerContexts: PrinterContextsAPI;
  connectionState: ConnectionStateAPI;
  printerSettings: PrinterSettingsAPI;
  spoolman: SpoolmanAPI;
}

// Window controls interface for sub-windows
interface WindowControls {
  minimize: () => void;
  close: () => void;
  closeGeneric: () => void;
}

// Extend the Window interface to include the Electron API
declare global {
  interface Window {
    api: ElectronAPI;
    componentDialogAPI?: ComponentDialogAPI;
    shortcutConfigAPI?: ShortcutConfigDialogAPI;
    spoolmanDialogAPI?: SpoolmanDialogAPI;
    CAMERA_URL: string;
    PLATFORM: string;
    windowControls?: WindowControls;
    logMessage?: (message: string) => void;
  }

  // Add logMessage to globalThis as well
  var logMessage: ((message: string) => void) | undefined;
}

// Export an empty object to make this a module
export {};

