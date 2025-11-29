/**
 * @fileoverview Renderer-side printer state tracker service.
 *
 * Provides printer state tracking within the renderer process, mirroring the
 * main process state but adapted for UI consumption.
 *
 * Key exports:
 * - PrinterStateTracker class: Simple state tracker for UI
 * - STATE_EVENTS: Event name constants
 * - getGlobalStateTracker: Singleton accessor
 *
 * Note: This service should be kept in sync with the main process service
 * regarding state definitions and event names.
 */

import { EventEmitter } from '@shared/utils/EventEmitter.js';
import type { PrinterState } from '@shared/types/polling.js';

// ============================================================================
// SIMPLE STATE EVENTS
// ============================================================================

/**
 * State change event names
 */
export const STATE_EVENTS = {
  CHANGED: 'state-changed',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  PRINTING_STARTED: 'printing-started',
  PRINTING_STOPPED: 'printing-stopped'
} as const;

/**
 * State change event data
 */
export interface StateChangeEvent {
  previousState: PrinterState;
  currentState: PrinterState;
  timestamp: Date;
  reason?: string;
}

/**
 * Event map for PrinterStateTracker
 */
interface StateTrackerEventMap extends Record<string, unknown[]> {
  'state-changed': [StateChangeEvent];
  'connected': [];
  'disconnected': [];
  'printing-started': [];
  'printing-stopped': [];
}

// ============================================================================
// PRINTER STATE TRACKER
// ============================================================================

/**
 * Simple printer state tracker - lightweight and practical
 */
export class PrinterStateTracker extends EventEmitter<StateTrackerEventMap> {
  private currentState: PrinterState;
  private lastStateChange: Date;

  /**
   * Create new state tracker
   */
  constructor(initialState: PrinterState = 'Busy') {
    super();
    this.currentState = initialState;
    this.lastStateChange = new Date();
  }

  // ============================================================================
  // STATE ACCESS METHODS
  // ============================================================================

  /**
   * Get current printer state
   */
  public getCurrentState(): PrinterState {
    return this.currentState;
  }

  /**
   * Check if printer is connected
   */
  public isConnected(): boolean {
    return this.currentState !== 'Busy' && this.currentState !== 'Error';
  }

  /**
   * Check if printer is currently printing
   */
  public isPrinting(): boolean {
    return this.currentState === 'Printing';
  }

  /**
   * Check if printer is paused
   */
  public isPaused(): boolean {
    return this.currentState === 'Paused';
  }

  /**
   * Check if printer is ready for new jobs
   */
  public isReady(): boolean {
    return this.currentState === 'Ready' || this.currentState === 'Completed';
  }

  /**
   * Check if printer is in an error state
   */
  public hasError(): boolean {
    return this.currentState === 'Error';
  }

  // ============================================================================
  // STATE CHANGE METHODS
  // ============================================================================

  /**
   * Set new printer state
   */
  public setState(newState: PrinterState, reason?: string): boolean {
    // Skip if no change
    if (newState === this.currentState) {
      return true;
    }

    // Perform state change
    const previousState = this.currentState;
    this.currentState = newState;
    this.lastStateChange = new Date();

    // Create event data
    const eventData: StateChangeEvent = {
      previousState,
      currentState: newState,
      timestamp: this.lastStateChange,
      reason
    };

    // Emit events
    this.emit(STATE_EVENTS.CHANGED, eventData);
    this.emitSpecificStateEvents(previousState, newState);

    return true;
  }

  /**
   * Handle connection established
   */
  public onConnected(): void {
    if (this.setState('Ready', 'connection established')) {
      this.emit(STATE_EVENTS.CONNECTED);
    }
  }

  /**
   * Handle connection lost
   */
  public onDisconnected(): void {
    if (this.setState('Busy', 'connection lost')) {
      this.emit(STATE_EVENTS.DISCONNECTED);
    }
  }

  /**
   * Emit specific state events for common transitions
   */
  private emitSpecificStateEvents(previousState: PrinterState, currentState: PrinterState): void {
    // Connection events
    if ((previousState === 'Busy' || previousState === 'Error') && 
        (currentState !== 'Busy' && currentState !== 'Error')) {
      this.emit(STATE_EVENTS.CONNECTED);
    }
    
    if ((previousState !== 'Busy' && previousState !== 'Error') && 
        (currentState === 'Busy' || currentState === 'Error')) {
      this.emit(STATE_EVENTS.DISCONNECTED);
    }

    // Printing events
    if (previousState !== 'Printing' && currentState === 'Printing') {
      this.emit(STATE_EVENTS.PRINTING_STARTED);
    }

    if (previousState === 'Printing' && currentState !== 'Printing' && currentState !== 'Paused') {
      this.emit(STATE_EVENTS.PRINTING_STOPPED);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.removeAllListeners();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Global state tracker instance (singleton pattern)
 */
let globalStateTracker: PrinterStateTracker | null = null;

/**
 * Get global state tracker instance
 */
export function getGlobalStateTracker(): PrinterStateTracker {
  if (!globalStateTracker) {
    globalStateTracker = new PrinterStateTracker();
  }
  return globalStateTracker;
}

export default PrinterStateTracker;
