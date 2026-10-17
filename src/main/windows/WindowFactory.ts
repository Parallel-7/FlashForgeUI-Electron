/**
 * @fileoverview WindowFactory is the facade for window creation. It
 * re-exports the creation functions and shared dialog types from the
 * specialized factories (CoreWindowFactory, DialogWindowFactory,
 * UtilityWindowFactory) so callers can import everything from one place.
 * Importing from a specialized factory directly is equally fine.
 */

// Re-export shared types for backward compatibility
export type { InputDialogOptions, ManualConnectDialogOptions } from './shared/WindowTypes.js';

// Re-export all functions from specialized factory modules to maintain API compatibility

// Core application windows
export {
  createAboutDialog,
  createCalibrationDialog,
  createLogDialog,
  createSettingsWindow,
  createStatusWindow,
} from './factories/CoreWindowFactory.js';

// Dialog windows with user interaction
export {
  createConnectChoiceDialog,
  createInputDialog,
  createManualConnectDialog,
  createMaterialInfoDialog,
  createMaterialMatchingDialog,
  createPrinterConnectedWarningDialog,
  createSingleColorConfirmationDialog,
} from './factories/DialogWindowFactory.js';

// Utility and feature windows
export {
  createJobPickerWindow,
  createJobUploaderWindow,
  createPrinterSelectionWindow,
  createSendCommandsWindow,
} from './factories/UtilityWindowFactory.js';
