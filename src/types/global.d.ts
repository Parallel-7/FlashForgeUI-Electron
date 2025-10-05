/**
 * Global type definitions for the FlashForge UI TypeScript application.
 * 
 * This file extends the Window interface with Electron API methods
 * exposed by the preload script via contextBridge.
 */

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
  getStatus(): Promise<unknown>;
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
    CAMERA_URL: string;
    windowControls?: WindowControls;
    logMessage?: (message: string) => void;
  }

  // Add logMessage to globalThis as well
  var logMessage: ((message: string) => void) | undefined;
}

// Export an empty object to make this a module
export {};
