/**
 * @fileoverview WindowTypes holds the shared type system for window
 * creation: branded dimension and security types, dialog data interfaces,
 * the WindowType discriminated union, and the WINDOW_SIZES constants.
 *
 * WINDOW_SIZES is the single source of truth for window dimensions — do not
 * hardcode sizes elsewhere. The branded types (WindowWidth, PreloadPath, ...)
 * are nominal on purpose: they stop a width from passing as a height, or an
 * unvetted string as a preload path. Build them with the create* helpers.
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

// Interface for input dialog options (extracted from WindowFactory)
export interface InputDialogOptions {
  readonly title?: string;
  readonly message?: string;
  readonly defaultValue?: string;
  readonly inputType?: 'text' | 'password' | 'hidden';
  readonly placeholder?: string;
}

// Options for the multi-field manual printer-connection dialog
export interface ManualConnectDialogOptions {
  readonly title?: string;
  readonly message?: string;
  readonly defaultIpAddress?: string;
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
  // Pop-out of the Material Station grid component (AD5X IFS + Creator 5 / 5 Pro).
  // Unlike the bespoke Material* dialogs below, this is served by the generic
  // component-dialog path: `component-dialog:open` IPC -> createComponentDialog(
  // 'material-station'). Replaces the never-wired legacy 'IFSDialog' kind.
  | { kind: 'MaterialStation' }
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
    minHeight: createWindowMinHeight(780),
  },
  STATUS: {
    width: createWindowWidth(750),
    height: createWindowHeight(900),
    minWidth: createWindowMinWidth(750),
    minHeight: createWindowMinHeight(800),
  },
  LOG_DIALOG: {
    width: createWindowWidth(900),
    height: createWindowHeight(750),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(400),
  },
  INPUT_DIALOG: {
    width: createWindowWidth(420),
    height: createWindowHeight(300),
    minWidth: createWindowMinWidth(380),
    minHeight: createWindowMinHeight(280),
  },
  MANUAL_CONNECT_DIALOG: {
    width: createWindowWidth(480),
    height: createWindowHeight(480),
    minWidth: createWindowMinWidth(420),
    minHeight: createWindowMinHeight(420),
  },
  JOB_UPLOADER: {
    width: createWindowWidth(950),
    height: createWindowHeight(820),
    minWidth: createWindowMinWidth(875),
    minHeight: createWindowMinHeight(700),
  },
  PRINTER_SELECTION: {
    width: createWindowWidth(500),
    height: createWindowHeight(400),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(350),
  },
  JOB_PICKER: {
    width: createWindowWidth(700),
    height: createWindowHeight(700),
    minWidth: createWindowMinWidth(700),
    minHeight: createWindowMinHeight(700),
  },
  SEND_COMMANDS: {
    width: createWindowWidth(600),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(500),
    minHeight: createWindowMinHeight(400),
  },
  MATERIAL_INFO: {
    width: createWindowWidth(700),
    height: createWindowHeight(620),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(400),
  },
  MATERIAL_MATCHING: {
    width: createWindowWidth(800),
    height: createWindowHeight(720),
    minWidth: createWindowMinWidth(600),
    minHeight: createWindowMinHeight(550),
  },
  SINGLE_COLOR_CONFIRMATION: {
    width: createWindowWidth(450),
    height: createWindowHeight(500),
    minWidth: createWindowMinWidth(400),
    minHeight: createWindowMinHeight(450),
  },
  AUTO_CONNECT_CHOICE: {
    width: createWindowWidth(500),
    height: createWindowHeight(480),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(420),
  },
  CONNECT_CHOICE: {
    width: createWindowWidth(480),
    height: createWindowHeight(450),
    minWidth: createWindowMinWidth(450),
    minHeight: createWindowMinHeight(400),
  },
  ABOUT_DIALOG: {
    width: createWindowWidth(540),
    height: createWindowHeight(620),
    minWidth: createWindowMinWidth(520),
    minHeight: createWindowMinHeight(560),
  },
  PRINTER_CONNECTED_WARNING: {
    width: createWindowWidth(450),
    height: createWindowHeight(380),
    minWidth: createWindowMinWidth(400),
    minHeight: createWindowMinHeight(350),
  },
  COMPONENT_PALETTE: {
    width: createWindowWidth(350),
    height: createWindowHeight(700),
    minWidth: createWindowMinWidth(350),
    minHeight: createWindowMinHeight(700),
  },
  UPDATE_AVAILABLE_DIALOG: {
    width: createWindowWidth(740),
    height: createWindowHeight(720),
    minWidth: createWindowMinWidth(640),
    minHeight: createWindowMinHeight(610),
  },
  CALIBRATION_DIALOG: {
    width: createWindowWidth(1180),
    height: createWindowHeight(860),
    minWidth: createWindowMinWidth(980),
    minHeight: createWindowMinHeight(720),
  },
  FILE_MANAGER: {
    width: createWindowWidth(980),
    height: createWindowHeight(760),
    minWidth: createWindowMinWidth(760),
    minHeight: createWindowMinHeight(560),
  },
} as const;
