/**
 * WindowTypes contains shared TypeScript interfaces and types used across all
 * window factory modules. This module provides consistent type definitions for
 * window configuration, dialog options, and security settings, ensuring type
 * safety and maintainability across the window creation system.
 */

// Branded types for window dimensions to prevent logical errors
export type WindowWidth = number & { readonly __brand: 'WindowWidth' };
export type WindowHeight = number & { readonly __brand: 'WindowHeight' };
export type WindowMinWidth = number & { readonly __brand: 'WindowMinWidth' };
export type WindowMinHeight = number & { readonly __brand: 'WindowMinHeight' };

// Branded types for security settings
export type PreloadPath = string & { readonly __brand: 'PreloadPath' };
export type ResponseChannel = string & { readonly __brand: 'ResponseChannel' };
export type DialogId = string & { readonly __brand: 'DialogId' };

// Helper functions for creating branded types
export const createWindowWidth = (width: number): WindowWidth => width as WindowWidth;
export const createWindowHeight = (height: number): WindowHeight => height as WindowHeight;
export const createWindowMinWidth = (minWidth: number): WindowMinWidth => minWidth as WindowMinWidth;
export const createWindowMinHeight = (minHeight: number): WindowMinHeight => minHeight as WindowMinHeight;
export const createPreloadPath = (path: string): PreloadPath => path as PreloadPath;
export const createResponseChannel = (channel: string): ResponseChannel => channel as ResponseChannel;
export const createDialogId = (id: string): DialogId => id as DialogId;

// Interface for input dialog options (extracted from WindowFactory)
export interface InputDialogOptions {
  readonly title?: string;
  readonly message?: string;
  readonly defaultValue?: string;
  readonly inputType?: 'text' | 'password' | 'hidden';
  readonly placeholder?: string;
}

// Common window dimension configuration
export interface WindowDimensions {
  readonly width: WindowWidth;
  readonly height: WindowHeight;
  readonly minWidth?: WindowMinWidth;
  readonly minHeight?: WindowMinHeight;
}

// Window behavior configuration
export interface WindowBehavior {
  readonly modal: boolean;
  readonly resizable: boolean;
  readonly frame: boolean;
  readonly show: boolean;
}

// Security configuration for web preferences
export interface WindowSecurity {
  readonly preload: PreloadPath;
  readonly nodeIntegration: boolean;
  readonly contextIsolation: boolean;
}

// Complete window configuration interface
export interface WindowConfiguration {
  readonly dimensions: WindowDimensions;
  readonly behavior: WindowBehavior;
  readonly security: WindowSecurity;
}

// Dialog response handling interface
export interface DialogResponse<T> {
  readonly dialogId: DialogId;
  readonly responseChannel: ResponseChannel;
  readonly resolve: (result: T | null) => void;
}

// Material matching dialog data interface
export interface MaterialMatchingDialogData {
  readonly fileName: string;
  readonly toolDatas: readonly unknown[];
  readonly leveling: boolean;
  readonly context?: 'job-start' | 'file-upload'; // Context to determine button text
}

// Single color confirmation dialog data interface
export interface SingleColorConfirmationDialogData {
  readonly fileName: string;
  readonly leveling: boolean;
}

// Auto-connect choice dialog data interface
export interface AutoConnectChoiceDialogData {
  readonly lastUsedPrinter?: {
    name: string;
    serialNumber: string;
  } | null;
  readonly savedPrinterCount: number;
}

// Job picker initialization data interface
export interface JobPickerInitData {
  readonly isRecentFiles: boolean;
}

// Window type discriminated union for type safety
export type WindowType = 
  | { kind: 'Settings' }
  | { kind: 'Status' }
  | { kind: 'InputDialog'; options: InputDialogOptions }
  | { kind: 'JobUploader' }
  | { kind: 'PrinterSelection' }
  | { kind: 'JobPicker'; data: JobPickerInitData }
  | { kind: 'SendCommands' }
  | { kind: 'IFSDialog' }
  | { kind: 'MaterialInfo'; data: unknown }
  | { kind: 'MaterialMatching'; data: MaterialMatchingDialogData }
  | { kind: 'SingleColorConfirmation'; data: SingleColorConfirmationDialogData }
  | { kind: 'AutoConnectChoice'; data: AutoConnectChoiceDialogData };

// Common window size constants
export const WINDOW_SIZES = {
  SETTINGS: {
    width: createWindowWidth(600),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(400)
  },
  STATUS: {
    width: createWindowWidth(650),
    height: createWindowHeight(600),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(500)
  },
  INPUT_DIALOG: {
    width: createWindowWidth(400),
    height: createWindowHeight(250),
    minWidth: createWindowMinWidth(350),
    minHeight: createWindowMinHeight(220)
  },
  JOB_UPLOADER: {
    width: createWindowWidth(750),
    height: createWindowHeight(550),
    minWidth: createWindowMinWidth(700),
    minHeight: createWindowMinHeight(500)
  },
  PRINTER_SELECTION: {
    width: createWindowWidth(500),
    height: createWindowHeight(400),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(350)
  },
  JOB_PICKER: {
    width: createWindowWidth(700),
    height: createWindowHeight(600),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(500)
  },
  SEND_COMMANDS: {
    width: createWindowWidth(600),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(400)
  },
  IFS_DIALOG: {
    width: createWindowWidth(600),
    height: createWindowHeight(600),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(600)
  },
  MATERIAL_INFO: {
    width: createWindowWidth(600),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(400)
  },
  MATERIAL_MATCHING: {
    width: createWindowWidth(700),
    height: createWindowHeight(650),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(550)
  },
  SINGLE_COLOR_CONFIRMATION: {
    width: createWindowWidth(450),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(400),
    minHeight: createWindowMinHeight(450)
  },
  AUTO_CONNECT_CHOICE: {
    width: createWindowWidth(550),
    height: createWindowHeight(580),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(540)
  }
} as const;