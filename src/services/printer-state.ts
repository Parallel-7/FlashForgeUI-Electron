/**
 * @fileoverview Simple printer state tracker for monitoring printer operational states.
 *
 * Provides straightforward printer state tracking without complex abstractions:
 * - Current state tracking (Ready, Printing, Paused, Completed, etc.)
 * - Simple state checking methods (isPrinting, isReady, etc.)
 * - Basic state transition validation
 * - Event emission for state changes
 * - Connection state monitoring
 * - No history tracking or complex state machines
 *
 * Key exports:
 * - PrinterStateTracker class: Simple state tracker
 * - STATE_EVENTS: Event name constants
 * - StateChangeEvent interface
 *
 * This service intentionally avoids complex state machine patterns, providing a simple
 * and predictable state tracking mechanism for UI updates. Focuses on current state only
 * without maintaining transition history or complex validation rules.
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { PrinterState } from '../types/polling';

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
  private transitionCount: number;

  /**
   * Create new state tracker
   */
  constructor(initialState: PrinterState = 'Busy') {
    super();
    this.currentState = initialState;
    this.lastStateChange = new Date();
    this.transitionCount = 0;
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

  /**
   * Check if printer is in an active state (printing or paused)
   */
  public isActive(): boolean {
    return this.currentState === 'Printing' || this.currentState === 'Paused';
  }

  /**
   * Get time since last state change
   */
  public getTimeSinceLastChange(): number {
    return Date.now() - this.lastStateChange.getTime();
  }

  /**
   * Get total number of state transitions
   */
  public getTransitionCount(): number {
    return this.transitionCount;
  }

  // ============================================================================
  // STATE CHANGE METHODS
  // ============================================================================

  /**
   * Set new printer state with validation
   */
  public setState(newState: PrinterState, reason?: string): boolean {
    // Skip if no change
    if (newState === this.currentState) {
      return true;
    }

    // Validate transition
    if (!this.isValidTransition(this.currentState, newState)) {
      console.warn(`Invalid state transition: ${this.currentState} → ${newState}`);
      return false;
    }

    // Perform state change
    const previousState = this.currentState;
    this.currentState = newState;
    this.lastStateChange = new Date();
    this.transitionCount++;

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

    console.log(`State changed: ${previousState} → ${newState}${reason ? ` (${reason})` : ''}`);
    return true;
  }

  /**
   * Force state change without validation (use with caution)
   */
  public forceState(newState: PrinterState, reason: string): void {
    const previousState = this.currentState;
    this.currentState = newState;
    this.lastStateChange = new Date();
    this.transitionCount++;

    const eventData: StateChangeEvent = {
      previousState,
      currentState: newState,
      timestamp: this.lastStateChange,
      reason: `FORCED: ${reason}`
    };

    this.emit(STATE_EVENTS.CHANGED, eventData);
    this.emitSpecificStateEvents(previousState, newState);

    console.warn(`State forced: ${previousState} → ${newState} (${reason})`);
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
   * Handle print job started
   */
  public onPrintStarted(): void {
    if (this.setState('Printing', 'print job started')) {
      this.emit(STATE_EVENTS.PRINTING_STARTED);
    }
  }

  /**
   * Handle print job paused
   */
  public onPrintPaused(): void {
    this.setState('Paused', 'print job paused');
  }

  /**
   * Handle print job resumed
   */
  public onPrintResumed(): void {
    this.setState('Printing', 'print job resumed');
  }

  /**
   * Handle print job completed
   */
  public onPrintCompleted(): void {
    if (this.setState('Completed', 'print job completed')) {
      this.emit(STATE_EVENTS.PRINTING_STOPPED);
    }
  }

  /**
   * Handle error occurred
   */
  public onError(errorMessage?: string): void {
    this.setState('Error', errorMessage || 'unknown error');
  }

  /**
   * Clear error and return to ready state
   */
  public clearError(): void {
    if (this.currentState === 'Error') {
      this.setState('Ready', 'error cleared');
    }
  }

  // ============================================================================
  // STATE VALIDATION
  // ============================================================================

  /**
   * Check if state transition is valid
   * Updated to align with ff-api MachineStatus transitions for legacy printers
   */
  private isValidTransition(from: PrinterState, to: PrinterState): boolean {
    // Define valid transitions based on ff-api behavior and real printer hardware
    // FF-API can report any state change based on actual printer status
    const validTransitions: Record<PrinterState, PrinterState[]> = {
      'Ready': ['Printing', 'Paused', 'Completed', 'Error', 'Busy', 'Heating', 'Calibrating'],
      'Printing': ['Paused', 'Pausing', 'Completed', 'Cancelled', 'Error', 'Busy'],
      'Paused': ['Printing', 'Completed', 'Cancelled', 'Ready', 'Error', 'Busy'],
      'Pausing': ['Paused', 'Completed', 'Cancelled', 'Error', 'Busy'],
      'Heating': ['Printing', 'Calibrating', 'Ready', 'Cancelled', 'Error', 'Busy'],
      'Calibrating': ['Printing', 'Ready', 'Cancelled', 'Error', 'Busy'],
      'Completed': ['Ready', 'Printing', 'Busy', 'Error'],
      'Cancelled': ['Ready', 'Printing', 'Busy', 'Error'],
      'Error': ['Ready', 'Busy'],
      'Busy': ['Ready', 'Printing', 'Paused', 'Completed', 'Error', 'Heating', 'Calibrating']
    };

    return validTransitions[from]?.includes(to) ?? false;
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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get human-readable state description
   */
  public getStateDescription(): string {
    const descriptions: Record<PrinterState, string> = {
      'Ready': 'Ready for new print job',
      'Printing': 'Currently printing',
      'Paused': 'Print job paused',
      'Pausing': 'Pausing print job',
      'Heating': 'Heating up',
      'Calibrating': 'Calibrating bed level',
      'Completed': 'Print job completed',
      'Cancelled': 'Print job cancelled',
      'Error': 'Printer error occurred',
      'Busy': 'Printer is busy processing'
    };

    return descriptions[this.currentState];
  }

  /**
   * Get current state info for debugging
   */
  public getStateInfo(): {
    currentState: PrinterState;
    description: string;
    timeSinceChange: number;
    transitionCount: number;
    lastChange: Date;
  } {
    return {
      currentState: this.currentState,
      description: this.getStateDescription(),
      timeSinceChange: this.getTimeSinceLastChange(),
      transitionCount: this.transitionCount,
      lastChange: this.lastStateChange
    };
  }

  /**
   * Reset state tracker
   */
  public reset(): void {
    this.currentState = 'Busy';
    this.lastStateChange = new Date();
    this.transitionCount = 0;
    this.removeAllListeners();
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
 * Create new state tracker instance
 */
export function createStateTracker(initialState?: PrinterState): PrinterStateTracker {
  return new PrinterStateTracker(initialState);
}

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

/**
 * Reset global state tracker
 */
export function resetGlobalStateTracker(): void {
  if (globalStateTracker) {
    globalStateTracker.dispose();
    globalStateTracker = null;
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Types are exported above where they are defined

