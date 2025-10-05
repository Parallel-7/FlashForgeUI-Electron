/**
 * @fileoverview Backward compatibility re-export module for printer polling functionality.
 *
 * Maintains backward compatibility while delegating to the new modular structure:
 * - Re-exports PrinterPollingService and related functionality
 * - Re-exports polling types (PollingData, PollingConfig, etc.)
 * - Re-exports event types for backward compatibility
 * - Provides default export for legacy imports
 *
 * Key exports:
 * - All exports from PrinterPollingService module
 * - All polling types from types/polling
 * - Legacy event interfaces (PollingErrorEvent, ConnectionEvent)
 *
 * Note: New code should import directly from PrinterPollingService.ts instead of using
 * this compatibility module. This file exists to prevent breaking changes in existing code.
 */

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
