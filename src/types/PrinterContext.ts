/**
 * @fileoverview Type definitions for the multi-printer context system.
 *
 * This module defines the core types used by the PrinterContextManager to manage
 * multiple simultaneous printer connections. Each context represents a complete
 * printer connection state including backend, polling service, camera proxy, and
 * connection state.
 *
 * Key Types:
 * - PrinterContextInfo: Serializable context information for UI display
 * - ContextSwitchEvent: Event payload for context switching events
 *
 * Related:
 * - PrinterContext interface is defined in PrinterContextManager.ts
 * - Uses PrinterDetails from types/printer.ts
 * - Integrates with existing backend and service types
 */

/**
 * Connection state for a printer context
 */
export type ContextConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Serializable printer context information for UI display
 * This type is safe to send over IPC and contains all information
 * needed to render a printer tab in the UI
 */
export interface PrinterContextInfo {
  /** Unique identifier for this context */
  readonly id: string;

  /** Display name for the tab (usually printer name) */
  readonly name: string;

  /** IP address of the printer */
  readonly ip: string;

  /** Printer model string for display */
  readonly model: string;

  /** Current connection status */
  readonly status: ContextConnectionState;

  /** Whether this context is the active one */
  readonly isActive: boolean;

  /** Whether this printer has camera support */
  readonly hasCamera: boolean;

  /** Local camera proxy URL if available */
  readonly cameraUrl?: string;

  /** When this context was created */
  readonly createdAt: string; // ISO date string

  /** Last activity timestamp for sorting/cleanup */
  readonly lastActivity: string; // ISO date string
}

/**
 * Event payload for context switching events
 * Emitted when the active context changes
 */
export interface ContextSwitchEvent {
  /** ID of the newly active context */
  readonly contextId: string;

  /** ID of the previously active context (null if none) */
  readonly previousContextId: string | null;

  /** Basic info about the new active context */
  readonly contextInfo: PrinterContextInfo;
}

/**
 * Event payload for context creation
 */
export interface ContextCreatedEvent {
  /** ID of the newly created context */
  readonly contextId: string;

  /** Basic info about the new context */
  readonly contextInfo: PrinterContextInfo;
}

/**
 * Event payload for context removal
 */
export interface ContextRemovedEvent {
  /** ID of the removed context */
  readonly contextId: string;

  /** Whether this was the active context */
  readonly wasActive: boolean;
}
