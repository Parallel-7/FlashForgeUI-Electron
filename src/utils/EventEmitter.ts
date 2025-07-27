/**
 * Browser-compatible EventEmitter implementation with full TypeScript support
 * 
 * This provides a type-safe event emitter that works in browser environments
 * without requiring Node.js modules. Uses generics to ensure type safety for
 * event names and their corresponding payload types.
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
