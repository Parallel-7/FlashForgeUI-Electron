/**
 * @fileoverview Global type augmentations for main process
 *
 * Extends the global namespace and globalThis with main process-specific type definitions.
 * Provides type safety for global singleton managers and services accessible throughout
 * the Electron main process.
 *
 * Global Augmentations:
 * - printerBackendManager: Global singleton for printer backend orchestration
 *
 * Usage:
 * This file is automatically included via tsconfig.json types configuration.
 * Enables type-safe access to global.printerBackendManager and globalThis.printerBackendManager
 * without explicit imports.
 *
 * @module types/global-main
 */

import { PrinterBackendManager } from '../managers/PrinterBackendManager';

declare global {
  namespace NodeJS {
    interface Global {
      printerBackendManager: PrinterBackendManager | undefined;
    }
  }
  
  // Also augment globalThis for modern TypeScript
  var printerBackendManager: PrinterBackendManager | undefined;
}

export {};

