# TypeScript Best Practices for FlashForgeUI-Electron

## Table of Contents

1. [Project Setup and Configuration](#project-setup-and-configuration)
2. [Type Safety Best Practices](#type-safety-best-practices)
3. [Interface and Type Definitions](#interface-and-type-definitions)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Module Organization](#module-organization)
6. [Import/Export Conventions](#importexport-conventions)
7. [Generic Usage](#generic-usage)
8. [Utility Types](#utility-types)
9. [Type Guards and Assertions](#type-guards-and-assertions)
10. [Performance Considerations](#performance-considerations)
11. [Testing with TypeScript](#testing-with-typescript)
12. [Integration with Existing Patterns](#integration-with-existing-patterns)
13. [Electron-Specific TypeScript Patterns](#electron-specific-typescript-patterns)
14. [IPC Type Safety](#ipc-type-safety)
15. [Zod Integration and Runtime Validation](#zod-integration-and-runtime-validation)

## Project Setup and Configuration

### TypeScript Configuration Files

The project uses two TypeScript configurations for different build targets:

#### Main Process Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020", "DOM"],
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "types": ["node", "jest"]
  }
}
```

#### Renderer Process Configuration (`tsconfig.renderer.json`)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "noEmit": false,
    "outDir": "./dist/renderer",
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false
  }
}
```

### Key Configuration Guidelines

1. **Strict Mode**: Always enable strict mode with all strict flags
2. **Module Resolution**: Use `"node"` for main process, `"bundler"` for renderer
3. **Target/Lib**: ES2020 provides good balance of modern features and compatibility
4. **Source Maps**: Enable for debugging, disable for production renderer builds
5. **Declarations**: Generate for main process only, not renderer (webpack handles bundling)

## Type Safety Best Practices

### 1. Use Strict Type Checking

```typescript
// ✅ Good: Enable all strict flags
// tsconfig.json
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true
}

// ✅ Good: Explicit return types for public APIs
export function validateConfig(data: unknown): ValidatedAppConfig | null {
  const result = AppConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

// ❌ Bad: Implicit any
export function validateConfig(data) {
  return data;
}
```

### 2. Null Safety Patterns

```typescript
// ✅ Good: Explicit null handling
export function findPrinter(serial: string): PrinterDetails | null {
  const printer = savedPrinters[serial];
  return printer ?? null;
}

// ✅ Good: Optional chaining and nullish coalescing
export function getPrinterName(printer?: PrinterDetails): string {
  return printer?.name ?? 'Unknown Printer';
}

// ✅ Good: Defensive programming with type guards
export function processPrinterData(data: unknown): void {
  if (!isPrinterData(data)) {
    throw new AppError('Invalid printer data', ErrorCode.VALIDATION);
  }
  // data is now typed as PrinterData
}
```

### 3. Union Types and Discriminated Unions

```typescript
// ✅ Good: Discriminated unions for state management
export type PrinterState = 
  | { status: 'disconnected' }
  | { status: 'connecting'; progress: number }
  | { status: 'connected'; printer: PrinterDetails }
  | { status: 'error'; error: string };

export function handlePrinterState(state: PrinterState): void {
  switch (state.status) {
    case 'disconnected':
      // TypeScript knows this branch has no additional properties
      break;
    case 'connecting':
      // TypeScript knows progress is available
      updateProgress(state.progress);
      break;
    case 'connected':
      // TypeScript knows printer is available
      displayPrinter(state.printer);
      break;
    case 'error':
      // TypeScript knows error is available
      showError(state.error);
      break;
  }
}
```

## Interface and Type Definitions

### 1. Naming Conventions

```typescript
// ✅ Good: Clear, descriptive interface names
export interface PrinterConnectionOptions {
  readonly ipAddress: string;
  readonly timeout: number;
  readonly retries: number;
}

export interface BackendCapabilities {
  readonly hasLEDControl: boolean;
  readonly hasTemperatureControl: boolean;
  readonly supportsMaterialStation: boolean;
}

// ✅ Good: Type aliases for complex types
export type PrinterModelType = 
  | 'generic-legacy'
  | 'adventurer-5m'
  | 'adventurer-5m-pro'
  | 'ad5x';

export type EventHandler<T = void> = (data: T) => void;
```

### 2. Readonly Properties

```typescript
// ✅ Good: Use readonly for immutable data
export interface AppConfig {
  readonly DiscordSync: boolean;
  readonly AlwaysOnTop: boolean;
  readonly WebUIPort: number;
}

// ✅ Good: Separate mutable type when needed
export type MutableAppConfig = {
  -readonly [K in keyof AppConfig]: AppConfig[K];
};
```

### 3. Generic Interfaces

```typescript
// ✅ Good: Generic result types
export interface ServiceResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface EventEmitter<TEvents extends Record<string, unknown[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean;
}

// Usage example
interface PrinterServiceEvents {
  'printer-connected': [printer: PrinterDetails];
  'printer-disconnected': [serial: string];
  'status-updated': [status: PrinterStatus];
}

export class PrinterService extends EventEmitter<PrinterServiceEvents> {
  // Typed event methods are now available
}
```

### 4. Extending External Library Types

```typescript
// ✅ Good: Extend external types safely
import { FlashForgePrinter } from 'ff-api';

export interface DiscoveredPrinter extends Omit<FlashForgePrinter, 'ipAddress'> {
  readonly ipAddress: string; // Convert from IP object to string
  readonly status: 'Discovered' | 'Connected' | 'Error';
}

// ✅ Good: Augment module declarations when needed
declare module 'ff-api' {
  interface FlashForgeClient {
    // Add missing methods if needed
    customMethod?(): Promise<string>;
  }
}
```

## Error Handling Patterns

### 1. Structured Error Types

```typescript
// ✅ Good: Comprehensive error enumeration
export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  
  // Printer errors
  PRINTER_NOT_CONNECTED = 'PRINTER_NOT_CONNECTED',
  PRINTER_BUSY = 'PRINTER_BUSY',
  PRINTER_ERROR = 'PRINTER_ERROR',
  
  // Backend errors
  BACKEND_NOT_INITIALIZED = 'BACKEND_NOT_INITIALIZED',
  BACKEND_OPERATION_FAILED = 'BACKEND_OPERATION_FAILED',
}

// ✅ Good: Rich error class with context
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly originalError?: Error;
  
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.originalError = originalError;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
```

### 2. Error Factory Functions

```typescript
// ✅ Good: Type-safe error factories
export function networkError(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(message, ErrorCode.NETWORK, context);
}

export function timeoutError(operation: string, timeoutMs: number): AppError {
  return new AppError(
    `Operation timed out after ${timeoutMs}ms`,
    ErrorCode.TIMEOUT,
    { operation, timeoutMs }
  );
}

export function printerError(
  message: string,
  code: ErrorCode = ErrorCode.PRINTER_ERROR,
  context?: Record<string, unknown>
): AppError {
  return new AppError(message, code, context);
}
```

### 3. Result Types for Safe Error Handling

```typescript
// ✅ Good: Result type pattern
export type Result<T, E = AppError> = 
  | { success: true; data: T }
  | { success: false; error: E };

export async function connectToPrinter(options: PrinterConnectionOptions): Promise<Result<PrinterDetails>> {
  try {
    const printer = await establishConnection(options);
    return { success: true, data: printer };
  } catch (error) {
    return { success: false, error: toAppError(error) };
  }
}

// Usage
const result = await connectToPrinter(options);
if (result.success) {
  // TypeScript knows result.data is PrinterDetails
  console.log('Connected to:', result.data.name);
} else {
  // TypeScript knows result.error is AppError
  console.error('Connection failed:', result.error.message);
}
```

## Module Organization

### 1. File Structure

```
src/
├── types/                    # Type definitions
│   ├── config.ts            # Configuration types
│   ├── printer.ts           # Printer-related types
│   ├── notification.ts      # Notification types
│   └── ipc.ts              # IPC types
├── validation/              # Zod schemas
│   ├── config-schemas.ts
│   ├── printer-schemas.ts
│   └── job-schemas.ts
├── managers/               # Singleton managers
│   ├── ConfigManager.ts
│   └── ConnectionFlowManager.ts
├── services/              # Business logic services
│   ├── PrinterDiscoveryService.ts
│   └── PrinterPollingService.ts
└── utils/                # Utility functions
    ├── error.utils.ts
    └── validation.utils.ts
```

### 2. Type Organization Patterns

```typescript
// ✅ Good: Organize related types in modules
// src/types/printer.ts
export interface PrinterDetails {
  readonly name: string;
  readonly ipAddress: string;
  readonly serialNumber: string;
}

export interface PrinterStatus {
  readonly isOnline: boolean;
  readonly currentJob?: JobInfo;
  readonly temperature: TemperatureReading;
}

export type PrinterEvent = 
  | { type: 'connected'; printer: PrinterDetails }
  | { type: 'disconnected'; serial: string }
  | { type: 'status-changed'; status: PrinterStatus };

// Re-export for convenience
export * from './printer-backend';
export * from './camera';
```

### 3. Barrel Exports

```typescript
// ✅ Good: Clean barrel exports
// src/types/index.ts
export type { 
  AppConfig, 
  ConfigUpdateEvent,
  ValidatedAppConfig 
} from './config';

export type { 
  PrinterDetails, 
  PrinterStatus, 
  PrinterEvent 
} from './printer';

export type { 
  NotificationSettings,
  NotificationState 
} from './notification';

// Don't re-export everything - be selective
export { ErrorCode, AppError } from '../utils/error.utils';
```

## Import/Export Conventions

### 1. Import Patterns

```typescript
// ✅ Good: Explicit imports for external dependencies
import { EventEmitter } from 'events';
import { app, BrowserWindow } from 'electron';
import { z } from 'zod';

// ✅ Good: Type-only imports when possible
import type { AppConfig } from '../types/config';
import type { PrinterDetails } from '../types/printer';

// ✅ Good: Grouped imports with clear sections
import { FlashForgePrinterDiscovery } from 'ff-api';          // External
import { AppError, ErrorCode } from '../utils/error.utils';   // Internal utilities
import type { DiscoveredPrinter } from '../types/printer';    // Types
```

### 2. Export Patterns

```typescript
// ✅ Good: Named exports for everything
export class PrinterDiscoveryService extends EventEmitter {
  // Implementation
}

export const getPrinterDiscoveryService = (): PrinterDiscoveryService => {
  return PrinterDiscoveryService.getInstance();
};

// ✅ Good: Export types alongside implementations
export type PrinterDiscoveryEvents = {
  'discovery-started': [];
  'discovery-completed': [printers: DiscoveredPrinter[]];
  'discovery-failed': [error: Error];
};

// ❌ Avoid: Default exports (harder to refactor)
// export default PrinterDiscoveryService;
```

### 3. Re-export Patterns

```typescript
// ✅ Good: Controlled re-exports
// src/services/index.ts
export { PrinterDiscoveryService, getPrinterDiscoveryService } from './PrinterDiscoveryService';
export { PrinterPollingService, getPrinterPollingService } from './PrinterPollingService';
export type { ServiceResult } from './types';

// ✅ Good: Type-only re-exports
export type { 
  PrinterDiscoveryEvents,
  PrinterPollingEvents 
} from './PrinterDiscoveryService';
```

## Generic Usage

### 1. Service Base Classes

```typescript
// ✅ Good: Generic base service
export abstract class BaseService<TEvents extends Record<string, unknown[]>> 
  extends EventEmitter {
  
  protected isInitialized = false;
  
  public abstract initialize(): Promise<void>;
  public abstract dispose(): Promise<void>;
  
  protected emit<K extends keyof TEvents>(
    event: K, 
    ...args: TEvents[K]
  ): boolean {
    return super.emit(event as string, ...args);
  }
  
  public on<K extends keyof TEvents>(
    event: K, 
    listener: (...args: TEvents[K]) => void
  ): this {
    return super.on(event as string, listener);
  }
}

// Usage
interface PrinterServiceEvents {
  'printer-discovered': [printer: PrinterDetails];
  'error': [error: AppError];
}

export class PrinterService extends BaseService<PrinterServiceEvents> {
  public async initialize(): Promise<void> {
    // Implementation
  }
}
```

### 2. Generic Repository Pattern

```typescript
// ✅ Good: Generic repository for data access
export interface Repository<T, TKey = string> {
  findById(id: TKey): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: TKey): Promise<boolean>;
}

export class PrinterRepository implements Repository<PrinterDetails, string> {
  public async findById(serialNumber: string): Promise<PrinterDetails | null> {
    // Implementation
  }
  
  public async findAll(): Promise<PrinterDetails[]> {
    // Implementation
  }
  
  public async save(printer: PrinterDetails): Promise<PrinterDetails> {
    // Implementation
  }
  
  public async delete(serialNumber: string): Promise<boolean> {
    // Implementation
  }
}
```

### 3. Generic Factory Pattern

```typescript
// ✅ Good: Generic factory with constraints
export interface BackendFactory<T extends BasePrinterBackend> {
  create(config: BackendConfig): T;
  supports(modelType: PrinterModelType): boolean;
}

export class GenericBackendFactory implements BackendFactory<GenericLegacyBackend> {
  public create(config: BackendConfig): GenericLegacyBackend {
    return new GenericLegacyBackend(config);
  }
  
  public supports(modelType: PrinterModelType): boolean {
    return modelType === 'generic-legacy';
  }
}
```

## Utility Types

### 1. Common Utility Type Patterns

```typescript
// ✅ Good: Create mutable versions of readonly types
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// ✅ Good: Deep partial for configuration updates
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ✅ Good: Extract event types
export type EventMap<T> = T extends EventEmitter<infer E> ? E : never;

// ✅ Good: Create branded types for IDs
export type SerialNumber = string & { readonly __brand: 'SerialNumber' };
export type IPAddress = string & { readonly __brand: 'IPAddress' };

export function createSerialNumber(value: string): SerialNumber {
  // Validation logic
  return value as SerialNumber;
}
```

### 2. Configuration Utility Types

```typescript
// ✅ Good: Extract configuration keys
export type ConfigKey = keyof AppConfig;

// ✅ Good: Get configuration value type
export type ConfigValue<K extends ConfigKey> = AppConfig[K];

// ✅ Good: Create update types
export type ConfigUpdate = {
  [K in ConfigKey]?: {
    previous: ConfigValue<K>;
    current: ConfigValue<K>;
  };
};

// ✅ Good: Function parameter extraction
export type ExtractParameters<T> = T extends (...args: infer P) => unknown ? P : never;
export type ExtractReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;
```

### 3. IPC Utility Types

```typescript
// ✅ Good: IPC channel types
export type IPCMainChannels = {
  'printer:connect': [options: PrinterConnectionOptions];
  'printer:disconnect': [];
  'config:update': [config: Partial<AppConfig>];
};

export type IPCRendererChannels = {
  'printer:status-updated': [status: PrinterStatus];
  'config:changed': [event: ConfigUpdateEvent];
};

// ✅ Good: Channel name extraction
export type MainChannel = keyof IPCMainChannels;
export type RendererChannel = keyof IPCRendererChannels;

// ✅ Good: Handler type generation
export type MainHandler<T extends MainChannel> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: IPCMainChannels[T]
) => Promise<unknown> | unknown;
```

## Type Guards and Assertions

### 1. Type Guard Patterns

```typescript
// ✅ Good: Simple type guards
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// ✅ Good: Complex type guards
export function isPrinterData(data: unknown): data is PrinterDetails {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'ipAddress' in data &&
    'serialNumber' in data &&
    isString((data as Record<string, unknown>).name) &&
    isString((data as Record<string, unknown>).ipAddress) &&
    isString((data as Record<string, unknown>).serialNumber)
  );
}

// ✅ Good: Union type guards
export function isPrintCompleteNotification(
  notification: NotificationData
): notification is PrintCompleteNotification {
  return notification.type === 'print-complete';
}

export function isConnectionNotification(
  notification: NotificationData
): notification is ConnectionNotification {
  return notification.type === 'connection-lost' || notification.type === 'connection-error';
}
```

### 2. Assertion Functions

```typescript
// ✅ Good: Assertion functions for validation
export function assertIsValidConfig(data: unknown): asserts data is AppConfig {
  if (!isValidConfig(data)) {
    throw new AppError('Invalid configuration data', ErrorCode.CONFIG_INVALID);
  }
}

export function assertPrinterConnected(
  backend: PrinterBackend | null
): asserts backend is PrinterBackend {
  if (!backend) {
    throw new AppError('Printer not connected', ErrorCode.PRINTER_NOT_CONNECTED);
  }
}

// Usage
export function updatePrinterSettings(settings: PrinterSettings): void {
  const backend = getCurrentBackend();
  assertPrinterConnected(backend);
  // TypeScript now knows backend is not null
  backend.updateSettings(settings);
}
```

### 3. Runtime Type Checking with Zod

```typescript
// ✅ Good: Combine Zod with type guards
import { z } from 'zod';

const PrinterDetailsSchema = z.object({
  name: z.string(),
  ipAddress: z.string().ip(),
  serialNumber: z.string(),
  model: z.string(),
});

export type ValidatedPrinterDetails = z.infer<typeof PrinterDetailsSchema>;

export function validatePrinterDetails(data: unknown): data is ValidatedPrinterDetails {
  const result = PrinterDetailsSchema.safeParse(data);
  return result.success;
}

export function parsePrinterDetails(data: unknown): ValidatedPrinterDetails {
  const result = PrinterDetailsSchema.safeParse(data);
  if (!result.success) {
    throw fromZodError(result.error, ErrorCode.VALIDATION);
  }
  return result.data;
}
```

## Performance Considerations

### 1. Type-Level Optimizations

```typescript
// ✅ Good: Use const assertions for better inference
export const PRINTER_MODELS = [
  'generic-legacy',
  'adventurer-5m',
  'adventurer-5m-pro',
  'ad5x'
] as const;

export type PrinterModelType = typeof PRINTER_MODELS[number];

// ✅ Good: Avoid complex computed types in hot paths
type SlowType<T> = T extends Record<string, infer U> ? U : never;

// Better: Pre-compute or cache expensive types
export type ConfigValue = AppConfig[keyof AppConfig];
```

### 2. Interface vs Type Aliases

```typescript
// ✅ Good: Use interfaces for objects that might be extended
export interface PrinterBackend {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<PrinterStatus>;
}

export interface AD5XBackend extends PrinterBackend {
  getMaterialStationStatus(): Promise<MaterialStationStatus>;
}

// ✅ Good: Use type aliases for unions and computed types
export type BackendEvent = 
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; error: string };

export type EventHandler<T> = (event: T) => void;
```

### 3. Lazy Type Loading

```typescript
// ✅ Good: Lazy load complex types
export type LazyPrinterFeatures = () => Promise<import('../types/printer-backend').PrinterFeatureSet>;

export async function loadPrinterFeatures(): Promise<PrinterFeatureSet> {
  const { PrinterFeatureSet } = await import('../types/printer-backend');
  return PrinterFeatureSet;
}
```

## Testing with TypeScript

### 1. Test Setup

```typescript
// ✅ Good: Type-safe test utilities
export interface MockPrinterBackend extends PrinterBackend {
  __mockConnect: jest.MockedFunction<PrinterBackend['connect']>;
  __mockDisconnect: jest.MockedFunction<PrinterBackend['disconnect']>;
}

export function createMockPrinterBackend(): MockPrinterBackend {
  const mock = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getStatus: jest.fn(),
  } as unknown as MockPrinterBackend;
  
  mock.__mockConnect = mock.connect as jest.MockedFunction<PrinterBackend['connect']>;
  mock.__mockDisconnect = mock.disconnect as jest.MockedFunction<PrinterBackend['disconnect']>;
  
  return mock;
}
```

### 2. Test Type Definitions

```typescript
// ✅ Good: Test-specific types
export interface TestContext {
  mockBackend: MockPrinterBackend;
  mockConfigManager: jest.Mocked<ConfigManager>;
  cleanup: () => Promise<void>;
}

export type TestSetup<T = void> = (context: TestContext) => Promise<T>;
export type TestCleanup = (context: TestContext) => Promise<void>;

// ✅ Good: Test factory functions
export async function createTestEnvironment(): Promise<TestContext> {
  const mockBackend = createMockPrinterBackend();
  const mockConfigManager = jest.mocked(getConfigManager());
  
  return {
    mockBackend,
    mockConfigManager,
    cleanup: async () => {
      jest.clearAllMocks();
    }
  };
}
```

### 3. Type-Safe Assertions

```typescript
// ✅ Good: Custom assertion helpers
export function expectToBeValidConfig(data: unknown): asserts data is AppConfig {
  expect(data).toMatchObject({
    DiscordSync: expect.any(Boolean),
    AlwaysOnTop: expect.any(Boolean),
    WebUIPort: expect.any(Number),
  });
}

export function expectToBeAppError(error: unknown): asserts error is AppError {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toHaveProperty('code');
  expect(error).toHaveProperty('timestamp');
}

// Usage in tests
test('should throw validation error for invalid config', () => {
  expect(() => {
    validateConfig('invalid');
  }).toThrow();
  
  try {
    validateConfig('invalid');
  } catch (error) {
    expectToBeAppError(error);
    expect(error.code).toBe(ErrorCode.VALIDATION);
  }
});
```

## Integration with Existing Patterns

### 1. Singleton Pattern Implementation

```typescript
// ✅ Good: Type-safe singleton pattern
export abstract class SingletonBase<T> {
  private static instances = new Map<string, unknown>();
  
  protected constructor(private readonly key: string) {}
  
  protected static getInstance<U extends SingletonBase<U>>(
    this: new (key: string) => U,
    key = 'default'
  ): U {
    const instanceKey = `${this.name}:${key}`;
    
    if (!SingletonBase.instances.has(instanceKey)) {
      SingletonBase.instances.set(instanceKey, new this(key));
    }
    
    return SingletonBase.instances.get(instanceKey) as U;
  }
}

export class ConfigManager extends SingletonBase<ConfigManager> {
  public static getInstance(): ConfigManager {
    return super.getInstance.call(this);
  }
  
  private constructor() {
    super('config');
  }
}
```

### 2. EventEmitter Pattern Enhancement

```typescript
// ✅ Good: Type-safe EventEmitter wrapper
export class TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  private emitter = new EventEmitter();
  
  public on<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.on(event as string, listener);
    return this;
  }
  
  public emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K]
  ): boolean {
    return this.emitter.emit(event as string, ...args);
  }
  
  public removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }
}

// Usage
interface ServiceEvents {
  'data-updated': [data: PrinterStatus];
  'error': [error: AppError];
}

export class MyService extends TypedEventEmitter<ServiceEvents> {
  public updateData(data: PrinterStatus): void {
    this.emit('data-updated', data); // Type-safe
  }
}
```

### 3. Manager Pattern with Type Safety

```typescript
// ✅ Good: Generic manager base class
export abstract class BaseManager<TConfig, TState> extends TypedEventEmitter<{
  'state-changed': [state: TState];
  'config-updated': [config: TConfig];
}> {
  protected abstract config: TConfig;
  protected abstract state: TState;
  
  public abstract initialize(): Promise<void>;
  public abstract dispose(): Promise<void>;
  
  public getState(): Readonly<TState> {
    return Object.freeze({ ...this.state });
  }
  
  public getConfig(): Readonly<TConfig> {
    return Object.freeze({ ...this.config });
  }
}

// Implementation
interface ConnectionState {
  isConnected: boolean;
  currentPrinter?: PrinterDetails;
}

interface ConnectionConfig {
  timeout: number;
  retries: number;
}

export class ConnectionManager extends BaseManager<ConnectionConfig, ConnectionState> {
  protected config: ConnectionConfig = { timeout: 5000, retries: 3 };
  protected state: ConnectionState = { isConnected: false };
  
  public async initialize(): Promise<void> {
    // Implementation
  }
  
  public async dispose(): Promise<void> {
    // Implementation
  }
}
```

## Electron-Specific TypeScript Patterns

### 1. Main Process Type Safety

```typescript
// ✅ Good: Type-safe window creation
export interface WindowConfig {
  readonly width: number;
  readonly height: number;
  readonly resizable: boolean;
  readonly webPreferences: Electron.WebPreferences;
}

export function createTypedWindow<T extends WindowConfig>(
  config: T,
  url: string
): BrowserWindow {
  const window = new BrowserWindow(config);
  window.loadURL(url);
  return window;
}

// ✅ Good: Menu template with types
export interface MenuTemplate {
  readonly label: string;
  readonly submenu?: MenuTemplate[];
  readonly click?: () => void;
  readonly role?: Electron.MenuItemConstructorOptions['role'];
}

export function buildMenu(template: MenuTemplate[]): Electron.Menu {
  const menu = Menu.buildFromTemplate(template);
  return menu;
}
```

### 2. Preload Script Types

```typescript
// ✅ Good: Strongly typed preload API
export interface PreloadAPI {
  // IPC invoke handlers
  readonly invoke: {
    'printer:connect': (options: PrinterConnectionOptions) => Promise<ServiceResult<PrinterDetails>>;
    'config:get': () => Promise<AppConfig>;
    'config:update': (config: Partial<AppConfig>) => Promise<ServiceResult<void>>;
  };
  
  // IPC listeners
  readonly on: {
    'printer:status-updated': (callback: (status: PrinterStatus) => void) => () => void;
    'config:changed': (callback: (event: ConfigUpdateEvent) => void) => () => void;
  };
}

// Preload implementation
const api: PreloadAPI = {
  invoke: {
    'printer:connect': (options) => ipcRenderer.invoke('printer:connect', options),
    'config:get': () => ipcRenderer.invoke('config:get'),
    'config:update': (config) => ipcRenderer.invoke('config:update', config),
  },
  
  on: {
    'printer:status-updated': (callback) => {
      const handler = (_: unknown, status: PrinterStatus) => callback(status);
      ipcRenderer.on('printer:status-updated', handler);
      return () => ipcRenderer.removeListener('printer:status-updated', handler);
    },
    'config:changed': (callback) => {
      const handler = (_: unknown, event: ConfigUpdateEvent) => callback(event);
      ipcRenderer.on('config:changed', handler);
      return () => ipcRenderer.removeListener('config:changed', handler);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

### 3. Global Type Declarations

```typescript
// ✅ Good: Global type declarations (src/types/global.d.ts)
declare global {
  interface Window {
    electronAPI: PreloadAPI;
  }
  
  // Main process globals
  var PrinterBackendManager: import('../managers/PrinterBackendManager').PrinterBackendManager;
}

// Renderer process type checks
export function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

export function getElectronAPI(): PreloadAPI {
  if (!isElectronRenderer()) {
    throw new Error('electronAPI not available outside Electron renderer');
  }
  return window.electronAPI;
}
```

## IPC Type Safety

### 1. Channel Type Definitions

```typescript
// ✅ Good: Comprehensive IPC channel types
export interface IPCChannels {
  // Main to Renderer
  main: {
    'printer:status-updated': [status: PrinterStatus];
    'config:changed': [event: ConfigUpdateEvent];
    'notification:show': [notification: NotificationData];
    'loading:state-changed': [isLoading: boolean];
  };
  
  // Renderer to Main (invoke/handle)
  renderer: {
    'printer:connect': {
      args: [options: PrinterConnectionOptions];
      return: ServiceResult<PrinterDetails>;
    };
    'printer:disconnect': {
      args: [];
      return: ServiceResult<void>;
    };
    'config:get': {
      args: [];
      return: AppConfig;
    };
    'config:update': {
      args: [updates: Partial<AppConfig>];
      return: ServiceResult<void>;
    };
    'dialog:show-file-picker': {
      args: [options: Electron.OpenDialogOptions];
      return: Electron.OpenDialogReturnValue;
    };
  };
}

export type MainChannelName = keyof IPCChannels['main'];
export type RendererChannelName = keyof IPCChannels['renderer'];
```

### 2. Type-Safe IPC Handlers

```typescript
// ✅ Good: Type-safe IPC handler wrapper
export class TypedIPC {
  public static handleInvoke<K extends RendererChannelName>(
    channel: K,
    handler: (
      event: Electron.IpcMainInvokeEvent,
      ...args: IPCChannels['renderer'][K]['args']
    ) => Promise<IPCChannels['renderer'][K]['return']> | IPCChannels['renderer'][K]['return']
  ): void {
    ipcMain.handle(channel, handler);
  }
  
  public static sendToRenderer<K extends MainChannelName>(
    webContents: Electron.WebContents,
    channel: K,
    ...args: IPCChannels['main'][K]
  ): void {
    webContents.send(channel, ...args);
  }
  
  public static invoke<K extends RendererChannelName>(
    channel: K,
    ...args: IPCChannels['renderer'][K]['args']
  ): Promise<IPCChannels['renderer'][K]['return']> {
    return ipcRenderer.invoke(channel, ...args);
  }
  
  public static on<K extends MainChannelName>(
    channel: K,
    listener: (...args: IPCChannels['main'][K]) => void
  ): () => void {
    const handler = (_: Electron.IpcRendererEvent, ...args: IPCChannels['main'][K]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
}

// Usage
TypedIPC.handleInvoke('printer:connect', async (event, options) => {
  // options is typed as PrinterConnectionOptions
  // return type is enforced as ServiceResult<PrinterDetails>
  try {
    const printer = await connectToPrinter(options);
    return { success: true, data: printer };
  } catch (error) {
    return { success: false, error: toAppError(error).message };
  }
});
```

### 3. IPC Validation Layer

```typescript
// ✅ Good: Validation at IPC boundaries
import { z } from 'zod';

const PrinterConnectionOptionsSchema = z.object({
  ipAddress: z.string().ip(),
  timeout: z.number().positive(),
  retries: z.number().min(0).max(10),
});

export function createValidatedHandler<K extends RendererChannelName>(
  channel: K,
  schema: z.ZodSchema<IPCChannels['renderer'][K]['args'][0]>,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    validatedArgs: IPCChannels['renderer'][K]['args'][0]
  ) => Promise<IPCChannels['renderer'][K]['return']>
): void {
  TypedIPC.handleInvoke(channel, async (event, ...args) => {
    try {
      const validatedArgs = schema.parse(args[0]);
      return await handler(event, validatedArgs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw fromZodError(error, ErrorCode.VALIDATION);
      }
      throw error;
    }
  });
}

// Usage
createValidatedHandler(
  'printer:connect',
  PrinterConnectionOptionsSchema,
  async (event, options) => {
    // options is validated and typed
    const result = await connectToPrinter(options);
    return { success: true, data: result };
  }
);
```

## Zod Integration and Runtime Validation

### 1. Schema Definition Patterns

```typescript
// ✅ Good: Comprehensive schema definitions
import { z } from 'zod';

// Base schemas
export const IPAddressSchema = z.string().ip();
export const SerialNumberSchema = z.string().min(1);
export const PortSchema = z.number().int().min(1).max(65535);

// Configuration schemas
export const AppConfigSchema = z.object({
  DiscordSync: z.boolean(),
  AlwaysOnTop: z.boolean(),
  AlertWhenComplete: z.boolean(),
  AlertWhenCooled: z.boolean(),
  AudioAlerts: z.boolean(),
  VisualAlerts: z.boolean(),
  DebugMode: z.boolean(),
  WebhookUrl: z.string(),
  CustomCamera: z.boolean(),
  CustomCameraUrl: z.string(),
  CustomLeds: z.boolean(),
  ForceLegacyAPI: z.boolean(),
  DiscordUpdateIntervalMinutes: z.number().min(1).max(60),
  WebUIEnabled: z.boolean(),
  WebUIPort: PortSchema,
  WebUIPassword: z.string(),
  CameraProxyPort: PortSchema,
});

// Printer schemas
export const PrinterDetailsSchema = z.object({
  Name: z.string(),
  IPAddress: IPAddressSchema,
  SerialNumber: SerialNumberSchema,
  CheckCode: z.string(),
  ClientType: z.enum(['legacy', 'new']),
  printerModel: z.string(),
  modelType: z.enum(['generic-legacy', 'adventurer-5m', 'adventurer-5m-pro', 'ad5x']),
  lastConnected: z.string().datetime().optional(),
});
```

### 2. Type Inference and Validation

```typescript
// ✅ Good: Type inference from schemas
export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;
export type ValidatedPrinterDetails = z.infer<typeof PrinterDetailsSchema>;

// ✅ Good: Validation helper functions
export function validateAppConfig(data: unknown): ValidatedAppConfig | null {
  const result = AppConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseAppConfig(data: unknown): ValidatedAppConfig {
  const result = AppConfigSchema.safeParse(data);
  if (!result.success) {
    throw fromZodError(result.error, ErrorCode.CONFIG_INVALID);
  }
  return result.data;
}

// ✅ Good: Partial validation for updates
export const PartialAppConfigSchema = AppConfigSchema.partial();
export type PartialAppConfig = z.infer<typeof PartialAppConfigSchema>;

export function validateConfigUpdate(data: unknown): PartialAppConfig | null {
  const result = PartialAppConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

### 3. Integration with Error Handling

```typescript
// ✅ Good: Zod error transformation
export function fromZodError(
  error: z.ZodError,
  code: ErrorCode = ErrorCode.VALIDATION
): AppError {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
  
  const message = `Validation failed: ${issues.map(i => `${i.path}: ${i.message}`).join(', ')}`;
  
  return new AppError(message, code, { issues }, error);
}

// ✅ Good: Validation middleware for services
export function withValidation<TInput, TOutput>(
  inputSchema: z.ZodSchema<TInput>,
  handler: (input: TInput) => Promise<TOutput>
) {
  return async (input: unknown): Promise<TOutput> => {
    try {
      const validatedInput = inputSchema.parse(input);
      return await handler(validatedInput);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw fromZodError(error);
      }
      throw error;
    }
  };
}

// Usage
const connectToPrinter = withValidation(
  PrinterConnectionOptionsSchema,
  async (options: PrinterConnectionOptions) => {
    // Implementation with validated options
    return establishConnection(options);
  }
);
```

### 4. Schema Composition and Reuse

```typescript
// ✅ Good: Composable schemas
export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PrinterEntitySchema = BaseEntitySchema.extend({
  name: z.string(),
  ipAddress: IPAddressSchema,
  serialNumber: SerialNumberSchema,
  isOnline: z.boolean(),
});

// ✅ Good: Discriminated union schemas
export const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('print-complete'),
    printerId: z.string(),
    jobName: z.string(),
    duration: z.number(),
  }),
  z.object({
    type: z.literal('printer-cooled'),
    printerId: z.string(),
    temperature: z.number(),
  }),
  z.object({
    type: z.literal('connection-error'),
    printerId: z.string(),
    error: z.string(),
  }),
]);

export type NotificationData = z.infer<typeof NotificationSchema>;
```

### 5. Transform and Preprocessing

```typescript
// ✅ Good: Data transformation in schemas
export const ProcessedConfigSchema = z.object({
  port: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(65535)),
  timeout: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().positive()),
  enabled: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true';
    }
    return val;
  }),
});

// ✅ Good: Preprocessing for normalization
export const NormalizedPrinterSchema = PrinterDetailsSchema.preprocess((data) => {
  if (typeof data === 'object' && data !== null) {
    const normalized = { ...data };
    
    // Normalize IP address format
    if ('ipAddress' in normalized && typeof normalized.ipAddress === 'string') {
      normalized.ipAddress = normalized.ipAddress.trim();
    }
    
    // Normalize serial number
    if ('serialNumber' in normalized && typeof normalized.serialNumber === 'string') {
      normalized.serialNumber = normalized.serialNumber.toUpperCase().trim();
    }
    
    return normalized;
  }
  return data;
});
```

---

This documentation provides comprehensive TypeScript best practices specifically tailored for the FlashForgeUI-Electron project. It covers all major aspects from basic type safety to advanced patterns used in Electron applications, with practical examples that align with the existing codebase patterns. The documentation emphasizes the project's use of strict TypeScript, Zod validation, EventEmitter patterns, singleton managers, and type-safe IPC communication.