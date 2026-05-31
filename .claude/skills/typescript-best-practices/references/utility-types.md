# Utility Types

## Common Utility Type Patterns

```typescript
// Create mutable versions of readonly types
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Deep partial for configuration updates
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Extract event types
export type EventMap<T> = T extends EventEmitter<infer E> ? E : never;

// Create branded types for IDs
export type SerialNumber = string & { readonly __brand: 'SerialNumber' };
export type IPAddress = string & { readonly __brand: 'IPAddress' };

export function createSerialNumber(value: string): SerialNumber {
  // Validation logic
  return value as SerialNumber;
}
```

## Configuration Utility Types

```typescript
// Extract configuration keys
export type ConfigKey = keyof AppConfig;

// Get configuration value type
export type ConfigValue<K extends ConfigKey> = AppConfig[K];

// Create update types
export type ConfigUpdate = {
  [K in ConfigKey]?: {
    previous: ConfigValue<K>;
    current: ConfigValue<K>;
  };
};

// Function parameter extraction
export type ExtractParameters<T> = T extends (...args: infer P) => unknown ? P : never;
export type ExtractReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;
```

## Built-in Utility Type Patterns

```typescript
// Pick - select specific properties
export type PrinterConfig = Pick<AppConfig, 'DiscordSync' | 'WebUIPort'>;

// Omit - remove specific properties
export type PrinterWithoutIP = Omit<PrinterDetails, 'ipAddress'>;

// Partial - make all properties optional
export type PartialConfig = Partial<AppConfig>;

// Required - make all properties required
export type RequiredPrinter = Required<PartialPrinter>;

// Readonly - make all properties readonly
export type ReadonlyConfig = Readonly<AppConfig>;

// Record - create object type with specific keys
export type PrinterMap = Record<string, PrinterDetails>;

// Extract - extract from union
export type EventNames = Extract<PrinterEvent, { type: string }>['type'];

// Exclude - exclude from union
export type NonErrorEvents = Exclude<PrinterEvent, { type: 'error' }>;

// ReturnType - extract return type of function
export type PrinterStatusResult = ReturnType<typeof getPrinterStatus>;

// Parameters - extract parameter types of function
export type ConnectParams = Parameters<typeof connectToPrinter>;
```

## Const Assertions for Better Inference

```typescript
// Use const assertions for better type inference
export const PRINTER_MODELS = [
  'generic-legacy',
  'adventurer-5m',
  'adventurer-5m-pro',
  'ad5x'
] as const;

export type PrinterModelType = typeof PRINTER_MODELS[number];

// Const assertion for objects
export const DEFAULT_CONFIG = {
  timeout: 5000,
  retries: 3,
  enableLogging: true
} as const;

// Type is now readonly with literal values
type DefaultConfig = typeof DEFAULT_CONFIG;
// { readonly timeout: 5000; readonly retries: 3; readonly enableLogging: true; }
```

## Template Literal Types

```typescript
// Create typed event names
export type EventPrefix = 'printer:' | 'config:' | 'notification:';
export type EventName<T extends string> = `${EventPrefix}${T}`;

// Usage
export type PrinterEventName = EventName<'connected' | 'disconnected' | 'status-changed'>;
// 'printer:connected' | 'printer:disconnected' | 'printer:status-changed'

// Typed getter functions
export type GetterName<T extends string> = `get${Capitalize<T>}`;
export type SetterName<T extends string> = `set${Capitalize<T>}`;

// For a property 'name', these become 'getName' and 'setName'
```
