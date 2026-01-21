# Interface and Type Definitions

## Naming Conventions

```typescript
// Clear, descriptive interface names
export interface ConnectionOptions {
  readonly host: string;
  readonly port: number;
  readonly timeout: number;
  readonly retries: number;
}

export interface ServiceCapabilities {
  readonly hasFeatureA: boolean;
  readonly hasFeatureB: boolean;
  readonly supportsExtension: boolean;
}

// Type aliases for complex types
export type ModelType =
  | 'basic'
  | 'standard'
  | 'premium'
  | 'enterprise';

export type EventHandler<T = void> = (data: T) => void;
```

## Readonly Properties

```typescript
// Use readonly for immutable data
export interface AppConfig {
  readonly enableFeature: boolean;
  readonly port: number;
  readonly maxConnections: number;
}

// Separate mutable type when needed
export type MutableAppConfig = {
  -readonly [K in keyof AppConfig]: AppConfig[K];
};

// Usage
const config: AppConfig = { enableFeature: true, port: 8080, maxConnections: 10 };
const mutableConfig: MutableAppConfig = { ...config };
mutableConfig.port = 9090; // OK
config.port = 9090; // Error
```

## Generic Interfaces

```typescript
// Generic result types
export interface ServiceResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// Generic event emitter pattern
export interface EventEmitter<TEvents extends Record<string, unknown[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean;
}

// Usage example
interface ServiceEvents {
  'connected': [id: string];
  'disconnected': [id: string];
  'status-changed': [status: Status];
}

export class MyService extends EventEmitter<ServiceEvents> {
  // Typed event methods are now available
  notifyConnected(id: string) {
    this.emit('connected', id);
  }
}
```

## Extending External Library Types

```typescript
// Extend external types safely
import { ExternalResource } from 'external-lib';

export interface EnhancedResource extends Omit<ExternalResource, 'id'> {
  readonly id: string; // Convert from ID object to string
  readonly status: 'Active' | 'Inactive' | 'Error';
}

// Augment module declarations when needed
declare module 'external-lib' {
  interface ExternalClient {
    // Add missing methods if needed
    customMethod?(): Promise<string>;
  }
}
```

## Interface vs Type Aliases

```typescript
// Use interfaces for objects that might be extended
export interface DataSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<Status>;
}

export interface SQLDataSource extends DataSource {
  executeQuery(sql: string): Promise<QueryResult>;
}

export interface NoSQLDataSource extends DataSource {
  find(filter: Filter): Promise<Document[]>;
}

// Use type aliases for unions and computed types
export type DataEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; code: number };

export type EventHandler<T> = (event: T) => void;
```
