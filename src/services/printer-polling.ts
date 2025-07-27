// src/services/printer-polling.ts
// REFACTORED: This file now re-exports from the new modular structure
// Maintains backward compatibility while delegating to focused modules

// Re-export everything from the new polling service
export {
  PrinterPollingService,
  POLLING_EVENTS,
  createPollingService,
  getGlobalPollingService,
  resetGlobalPollingService
} from './PrinterPollingService';

// Re-export types
export type {
  PollingData,
  PollingConfig,
  PrinterStatus,
  CurrentJobInfo,
  MaterialStationStatus,
  MaterialSlot
} from '../types/polling';

// Export event types for backward compatibility
export interface PollingErrorEvent {
  error: string;
  timestamp: Date;
  retryCount: number;
  willRetry: boolean;
}

export interface ConnectionEvent {
  connected: boolean;
}

// For backward compatibility, expose the polling service as default
import { PrinterPollingService } from './PrinterPollingService';
export default PrinterPollingService;
