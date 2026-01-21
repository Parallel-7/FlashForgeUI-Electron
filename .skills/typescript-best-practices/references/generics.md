# Generics

## Service Base Classes

```typescript
// Generic base service with typed events
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

## Generic Repository Pattern

```typescript
export interface Repository<T, TKey = string> {
  findById(id: TKey): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: TKey): Promise<boolean>;
}

export class PrinterRepository implements Repository<PrinterDetails, string> {
  private cache = new Map<string, PrinterDetails>();

  public async findById(serialNumber: string): Promise<PrinterDetails | null> {
    return this.cache.get(serialNumber) ?? null;
  }

  public async findAll(): Promise<PrinterDetails[]> {
    return Array.from(this.cache.values());
  }

  public async save(printer: PrinterDetails): Promise<PrinterDetails> {
    this.cache.set(printer.serialNumber, printer);
    return printer;
  }

  public async delete(serialNumber: string): Promise<boolean> {
    return this.cache.delete(serialNumber);
  }
}
```

## Generic Factory Pattern

```typescript
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

// Factory registry
export class BackendFactoryRegistry {
  private factories: BackendFactory<BasePrinterBackend>[] = [];

  public register(factory: BackendFactory<BasePrinterBackend>): void {
    this.factories.push(factory);
  }

  public getFactory(modelType: PrinterModelType): BackendFactory<BasePrinterBackend> | null {
    return this.factories.find(f => f.supports(modelType)) ?? null;
  }
}
```

## Generic Builder Pattern

```typescript
export class RequestBuilder<T> {
  private config: Partial<T> = {};

  public set<K extends keyof T>(key: K, value: T[K]): this {
    this.config[key] = value;
    return this;
  }

  public build(defaults: T): T {
    return { ...defaults, ...this.config } as T;
  }
}

// Usage
interface PrinterConnectionOptions {
  ipAddress: string;
  timeout: number;
  retries: number;
  enableLogging: boolean;
}

const options = new RequestBuilder<PrinterConnectionOptions>()
  .set('ipAddress', '192.168.1.100')
  .set('timeout', 5000)
  .build({ ipAddress: '', timeout: 3000, retries: 3, enableLogging: false });
```

## Generic Event Emitter

```typescript
export class TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  private emitter = new EventEmitter();

  public on<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.on(event as string, listener);
    return this;
  }

  public once<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.once(event as string, listener);
    return this;
  }

  public emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K]
  ): boolean {
    return this.emitter.emit(event as string, ...args);
  }

  public off<K extends keyof TEvents>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.off(event as string, listener);
    return this;
  }

  public removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }
}
```
