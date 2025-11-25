/**
 * @fileoverview WindowTypes contains shared TypeScript interfaces and types used across all
 * window factory modules.
 *
 * This type definition module provides the foundational type system for the window creation
 * infrastructure, ensuring type safety and consistency across all factory modules. It defines
 * branded types for dimensional and security primitives, interfaces for window configuration
 * and dialog data, and constants for standardized window dimensions. The module uses TypeScript's
 * advanced type features including branded types, readonly properties, and discriminated unions
 * to prevent logical errors and enforce immutability where appropriate.
 *
 * Key Features:
 * - Branded types for dimensions and security settings to prevent accidental value mixing
 * - Immutable interface definitions using readonly properties for configuration data
 * - Discriminated union types for type-safe window creation
 * - Centralized window size constants with min/max dimension specifications
 * - Helper functions for creating branded type instances with type safety
 * - Comprehensive dialog data interfaces for all dialog types in the application
 * - Type-safe window configuration combining dimensions, behavior, and security
 *
 * Core Responsibilities:
 * - Define branded types for window dimensions to prevent width/height confusion
 * - Define branded types for security settings to ensure proper preload path handling
 * - Provide immutable interfaces for window configuration data structures
 * - Define dialog option interfaces for all interactive dialog types
 * - Provide window size constants for consistent dimensions across the application
 * - Define discriminated union types for type-safe window creation patterns
 * - Provide helper functions for creating branded type instances
 *
 * Branded Types:
 * Branded types use TypeScript's intersection types to create nominal types from primitives,
 * preventing accidental mixing of logically different values that share the same runtime type.
 * For example, WindowWidth and WindowHeight are both numbers at runtime, but the branded types
 * prevent accidentally passing a width where a height is expected.
 *
 * Type Categories:
 * - Dimensional Types: WindowWidth, WindowHeight, WindowMinWidth, WindowMinHeight
 * - Security Types: PreloadPath, ResponseChannel, DialogId
 * - Configuration Interfaces: WindowDimensions, WindowBehavior, WindowSecurity, WindowConfiguration
 * - Dialog Data Interfaces: InputDialogOptions, MaterialMatchingDialogData, SingleColorConfirmationDialogData, etc.
 * - Discriminated Unions: WindowType for type-safe window creation
 *
 * Window Sizes:
 * All window sizes are defined in WINDOW_SIZES constant with standardized dimensions including
 * width, height, minWidth, and minHeight for each window type. This ensures consistent sizing
 * across the application and provides a single source of truth for dimension specifications.
 *
 * Dialog Data Interfaces:
 * Each interactive dialog type has a corresponding data interface that defines the initialization
 * data structure passed to the dialog renderer. These interfaces ensure type safety when passing
 * data from main process to renderer process via IPC.
 *
 * @exports WindowWidth, WindowHeight, WindowMinWidth, WindowMinHeight - Branded dimensional types
 * @exports PreloadPath, ResponseChannel, DialogId - Branded security types
 * @exports createWindowWidth, createWindowHeight, createWindowMinWidth, createWindowMinHeight - Dimensional helpers
 * @exports createPreloadPath, createResponseChannel, createDialogId - Security helpers
 * @exports InputDialogOptions - Input dialog configuration interface
 * @exports WindowDimensions - Window dimension configuration interface
 * @exports WindowBehavior - Window behavior configuration interface
 * @exports WindowSecurity - Window security configuration interface
 * @exports WindowConfiguration - Complete window configuration interface
 * @exports DialogResponse - Dialog response handling interface
 * @exports MaterialMatchingDialogData - Material matching dialog data interface
 * @exports SingleColorConfirmationDialogData - Single color confirmation dialog data interface
 * @exports AutoConnectChoiceDialogData - Auto-connect choice dialog data interface
 * @exports ConnectChoiceDialogData - Connect choice dialog data interface
 * @exports PrinterConnectedWarningData - Printer connected warning dialog data interface
 * @exports JobPickerInitData - Job picker initialization data interface
 * @exports WindowType - Discriminated union for type-safe window creation
 * @exports WINDOW_SIZES - Standardized window dimension constants
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

// Connect choice dialog data interface
export interface ConnectChoiceDialogData {
  // Currently minimal - can be extended to include printer status info
  [key: string]: unknown;
}

// Printer connected warning dialog data interface
export interface PrinterConnectedWarningData {
  readonly printerName: string;
}

// Update dialog data interface (currently empty, dialog fetches state via IPC)
export interface UpdateDialogInitData {
  readonly placeholder?: never;
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
  | { kind: 'AutoConnectChoice'; data: AutoConnectChoiceDialogData }
  | { kind: 'ConnectChoice'; data: ConnectChoiceDialogData }
  | { kind: 'AboutDialog' }
  | { kind: 'UpdateAvailableDialog'; data?: UpdateDialogInitData }
  | { kind: 'PrinterConnectedWarning'; data: PrinterConnectedWarningData };

// Common window size constants
export const WINDOW_SIZES = {
  SETTINGS: {
    width: createWindowWidth(820),
    height: createWindowHeight(820),
    minWidth: createWindowMinWidth(760),
    minHeight: createWindowMinHeight(780)
  },
  STATUS: {
    width: createWindowWidth(750),
    height: createWindowHeight(900),
    minWidth: createWindowMinWidth(750),
    minHeight: createWindowMinHeight(800)
  },
  LOG_DIALOG: {
    width: createWindowWidth(900),
    height: createWindowHeight(750),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(400)
  },
  INPUT_DIALOG: {
    width: createWindowWidth(420),
    height: createWindowHeight(300),
    minWidth: createWindowMinWidth(380),
    minHeight: createWindowMinHeight(280)
  },
  JOB_UPLOADER: {
    width: createWindowWidth(950),
    height: createWindowHeight(720),
    minWidth: createWindowMinWidth(875),
    minHeight: createWindowMinHeight(650)
  },
  PRINTER_SELECTION: {
    width: createWindowWidth(500),
    height: createWindowHeight(400),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(350)
  },
  JOB_PICKER: {
    width: createWindowWidth(700),
    height: createWindowHeight(700),
    minWidth: createWindowMinWidth(700),
    minHeight: createWindowMinHeight(700)
  },
  SEND_COMMANDS: {
    width: createWindowWidth(600),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(400)
  },
  IFS_DIALOG: {
    width: createWindowWidth(600),
    height: createWindowHeight(700),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(650)
  },
  MATERIAL_INFO: {
    width: createWindowWidth(700),
    height: createWindowHeight(620),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(400)
  },
  MATERIAL_MATCHING: {
    width: createWindowWidth(800),
    height: createWindowHeight(720),
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
    width: createWindowWidth(500),
    height: createWindowHeight(480),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(420)
  },
  CONNECT_CHOICE: {
    width: createWindowWidth(480),
    height: createWindowHeight(450),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(400)
  },
  ABOUT_DIALOG: {
    width: createWindowWidth(540),
    height: createWindowHeight(620),
    minWidth: createWindowMinWidth(520),
    minHeight: createWindowMinHeight(560)
  },
  PRINTER_CONNECTED_WARNING: {
    width: createWindowWidth(450),
    height: createWindowHeight(380),
    minWidth: createWindowMinWidth(400),
    minHeight: createWindowMinHeight(350)
  },
  COMPONENT_PALETTE: {
    width: createWindowWidth(350),
    height: createWindowHeight(700),
    minWidth: createWindowMinWidth(350),
    minHeight: createWindowMinHeight(700)
  },
  UPDATE_AVAILABLE_DIALOG: {
    width: createWindowWidth(740),
    height: createWindowHeight(720),
    minWidth: createWindowMinWidth(640),
    minHeight: createWindowMinHeight(610)
  }
} as const;
