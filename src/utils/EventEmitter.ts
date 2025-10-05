/**
 * @fileoverview Browser-compatible EventEmitter implementation with full TypeScript generic
 * type safety for event names and payloads. Provides a lightweight, Node.js-independent event
 * system suitable for renderer processes and browser contexts. Uses generic event map interfaces
 * to enforce compile-time type checking on event emissions and listener registrations.
 *
 * Key Features:
 * - Generic type parameters for event map specification
 * - Type-safe event listener registration with parameter inference
 * - Standard EventEmitter API (on, once, off, emit, removeAllListeners)
 * - Error isolation: listener exceptions don't break other listeners
 * - Copy-on-iterate pattern to prevent modification-during-iteration issues
 * - Listener count tracking and event name enumeration
 * - No Node.js dependencies (browser-safe)
 *
 * Type Safety:
 * - Event map interface defines event names as keys and parameter arrays as values
 * - Listener functions automatically infer correct parameter types from event map
 * - Compile-time errors for mismatched event names or parameter types
 *
 * API Methods:
 * - on(event, listener): Register persistent listener
 * - once(event, listener): Register one-time listener with auto-cleanup
 * - off(event, listener): Remove specific listener
 * - emit(event, ...args): Trigger all listeners for event with type-safe arguments
 * - removeAllListeners(event?): Remove all or event-specific listeners
 * - listenerCount(event): Count active listeners for event
 * - eventNames(): Get array of registered event names
 *
 * Error Handling:
 * - Listener exceptions are caught and logged without affecting other listeners
 * - Error details include event name for debugging context
 *
 * Usage Pattern:
 * Define event map interface, instantiate EventEmitter with map type, register listeners
 * with automatic type inference, emit events with compile-time argument validation.
 *
 * Context:
 * Used throughout the application for component communication, state change notifications,
 * and asynchronous event coordination in both main and renderer processes.
 */

// Default event map allows any string key with unknown array values
export type DefaultEventMap = Record<string, unknown[]>;

// Generic event listener type that extracts correct parameter types
export type EventListener<TEventMap extends Record<string, unknown[]>, TEventName extends keyof TEventMap> = (
  ...args: TEventMap[TEventName]
) => void;

// Generic EventEmitter class that accepts an event map interface
export class EventEmitter<TEventMap extends Record<string, unknown[]> = DefaultEventMap> {
  private readonly events: Map<keyof TEventMap, EventListener<TEventMap, keyof TEventMap>[]> = new Map();

  on<TEventName extends keyof TEventMap>(
    event: TEventName,
    listener: EventListener<TEventMap, TEventName>
  ): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener as EventListener<TEventMap, keyof TEventMap>);
    return this;
  }

  once<TEventName extends keyof TEventMap>(
    event: TEventName,
    listener: EventListener<TEventMap, TEventName>
  ): this {
    const onceWrapper = (...args: TEventMap[TEventName]): void => {
      this.off(event, onceWrapper as EventListener<TEventMap, TEventName>);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  off<TEventName extends keyof TEventMap>(
    event: TEventName,
    listener: EventListener<TEventMap, TEventName>
  ): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener as EventListener<TEventMap, keyof TEventMap>);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  emit<TEventName extends keyof TEventMap>(
    event: TEventName,
    ...args: TEventMap[TEventName]
  ): boolean {
    const listeners = this.events.get(event);
    if (listeners && listeners.length > 0) {
      // Create a copy to avoid issues if listeners modify the array
      const listenersCopy = [...listeners];
      listenersCopy.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for "${String(event)}":`, error);
        }
      });
      return true;
    }
    return false;
  }

  removeAllListeners<TEventName extends keyof TEventMap>(event?: TEventName): this {
    if (event !== undefined) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount<TEventName extends keyof TEventMap>(event: TEventName): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.length : 0;
  }

  eventNames(): Array<keyof TEventMap> {
    return Array.from(this.events.keys());
  }
}

// Export a convenience type for simple string-based events
export type SimpleEventEmitter = EventEmitter<Record<string, unknown[]>>;
