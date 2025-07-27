/**
 * Global type augmentations for the main process
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
