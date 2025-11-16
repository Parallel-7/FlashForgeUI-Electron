/**
 * @fileoverview WindowFactory serves as the main entry point for all window creation functions,
 * providing backward compatibility while delegating to specialized factory modules.
 *
 * This module acts as a facade over the refactored window creation system, re-exporting all
 * window creation functions from specialized factory modules while maintaining the same public
 * API as the original monolithic implementation. This design allows existing code to continue
 * importing from WindowFactory without changes, while benefiting from the improved organization
 * of window creation logic into focused, maintainable modules. The refactored structure separates
 * concerns into DialogWindowFactory (modal dialogs with user interaction), UtilityWindowFactory
 * (application feature windows), and CoreWindowFactory (primary application windows).
 *
 * Key Features:
 * - Backward compatibility with existing import paths and function signatures
 * - Centralized export location for all window creation functions
 * - Delegation to specialized factory modules for improved code organization
 * - Type re-export for dialog options and configuration interfaces
 * - Clear separation of concerns between dialog, utility, and core windows
 *
 * Core Responsibilities:
 * - Re-export all window creation functions from specialized factory modules
 * - Re-export shared types (InputDialogOptions) for backward compatibility
 * - Maintain stable public API while allowing internal refactoring
 * - Provide single import source for all window creation needs
 *
 * Module Organization:
 * - CoreWindowFactory: Primary application windows (settings, status, log dialog)
 * - DialogWindowFactory: Interactive modal dialogs with promise-based results
 * - UtilityWindowFactory: Feature windows for job management and printer control
 *
 * Exported Functions by Category:
 *
 * Core Application Windows:
 * - createSettingsWindow: Application configuration window
 * - createStatusWindow: Detailed printer status display
 * - createLogDialog: Application logging and debugging
 *
 * Dialog Windows (Promise-based):
 * - createInputDialog: User text input with promise result
 * - createMaterialMatchingDialog: Material configuration with mapping result
 * - createSingleColorConfirmationDialog: Print validation with boolean result
 * - createMaterialInfoDialog: Material slot information display
 * - createIFSDialog: Material station management display
 * - createConnectChoiceDialog: Connection method selection
 * - createPrinterConnectedWarningDialog: Connection conflict warning
 *
 * Utility Windows:
 * - createJobUploaderWindow: File upload interface
 * - createJobPickerWindow: File selection from printer
 * - createPrinterSelectionWindow: Printer management interface
 * - createSendCommandsWindow: Direct printer command execution
 *
 * Migration Path:
 * Existing code can continue to import from WindowFactory:
 * ```typescript
 * import { createSettingsWindow, createInputDialog } from './windows/WindowFactory';
 * ```
 *
 * New code can optionally import directly from specialized modules:
 * ```typescript
 * import { createSettingsWindow } from './windows/factories/CoreWindowFactory';
 * import { createInputDialog } from './windows/factories/DialogWindowFactory';
 * ```
 *
 * @exports InputDialogOptions - Type for input dialog configuration
 * @exports createSettingsWindow, createStatusWindow, createLogDialog - Core window functions
 * @exports createInputDialog, createMaterialMatchingDialog, createSingleColorConfirmationDialog,
 *          createMaterialInfoDialog, createIFSDialog, createConnectChoiceDialog,
 *          createPrinterConnectedWarningDialog - Dialog window functions
 * @exports createJobUploaderWindow, createJobPickerWindow, createPrinterSelectionWindow,
 *          createSendCommandsWindow - Utility window functions
 */

// Re-export shared types for backward compatibility
export type { InputDialogOptions } from './shared/WindowTypes';

// Re-export all functions from specialized factory modules to maintain API compatibility

// Core application windows
export {
  createSettingsWindow,
  createStatusWindow,
  createLogDialog,
  createAboutDialog
} from './factories/CoreWindowFactory';

// Dialog windows with user interaction
export {
  createInputDialog,
  createMaterialMatchingDialog,
  createSingleColorConfirmationDialog,
  createMaterialInfoDialog,
  createIFSDialog,
  createConnectChoiceDialog,
  createPrinterConnectedWarningDialog
} from './factories/DialogWindowFactory';

// Utility and feature windows
export {
  createJobUploaderWindow,
  createJobPickerWindow,
  createPrinterSelectionWindow,
  createSendCommandsWindow
} from './factories/UtilityWindowFactory';
