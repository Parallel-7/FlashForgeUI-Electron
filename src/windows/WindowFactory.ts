/**
 * WindowFactory serves as the main entry point for all window creation functions,
 * providing backward compatibility while delegating to specialized factory modules.
 * This refactored structure maintains the same public API while organizing window
 * creation logic into focused modules: DialogWindowFactory for modal dialogs,
 * UtilityWindowFactory for application feature windows, and CoreWindowFactory
 * for primary application windows. All existing import paths continue to work.
 */

// Re-export shared types for backward compatibility
export type { InputDialogOptions } from './shared/WindowTypes';

// Re-export all functions from specialized factory modules to maintain API compatibility

// Core application windows
export {
  createSettingsWindow,
  createStatusWindow,
  createLogDialog
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
