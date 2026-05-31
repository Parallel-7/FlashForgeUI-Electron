# Import/Export Conventions

## Import Patterns

```typescript
// Explicit imports for external dependencies
import { EventEmitter } from 'events';
import { app, BrowserWindow } from 'electron';

// Type-only imports when possible (reduces bundle size)
import type { AppConfig } from '../types/config';
import type { PrinterDetails } from '../types/printer';

// Grouped imports with clear sections
import { FlashForgePrinterDiscovery } from 'ff-api';          // External
import { AppError, ErrorCode } from '../utils/error.utils';   // Internal utilities
import type { DiscoveredPrinter } from '../types/printer';    // Types

// Namespace import for side-effect modules
import './polyfills';
```

## Export Patterns

```typescript
// Named exports for everything (preferred)
export class PrinterDiscoveryService extends EventEmitter {
  // Implementation
}

export const getPrinterDiscoveryService = (): PrinterDiscoveryService => {
  return PrinterDiscoveryService.getInstance();
};

// Export types alongside implementations
export type PrinterDiscoveryEvents = {
  'discovery-started': [];
  'discovery-completed': [printers: DiscoveredPrinter[]];
  'discovery-failed': [error: Error];
};

// Re-export types from dependencies
export type { Printer } from 'ff-api';

// AVOID: Default exports (harder to refactor, tree-shake)
// export default PrinterDiscoveryService;
```

## Re-export Patterns

```typescript
// Controlled re-exports in index files
// src/services/index.ts
export { PrinterDiscoveryService, getPrinterDiscoveryService } from './PrinterDiscoveryService';
export { PrinterPollingService, getPrinterPollingService } from './PrinterPollingService';
export type { ServiceResult } from './types';

// Type-only re-exports
export type {
  PrinterDiscoveryEvents,
  PrinterPollingEvents
} from './PrinterDiscoveryService';

// Barrel export pattern for types
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
```

## Circular Dependency Prevention

```typescript
// Use type-only imports to break circular dependencies
// File A: service.ts
import type { Repository } from './repository';
import type { Logger } from './logger';

export class Service {
  constructor(private repo: Repository, private logger: Logger) {}
}

// File B: repository.ts
import type { Service } from './service';

export class Repository {
  constructor(private service: Service) {}
}

// Or use dependency injection pattern
export interface ServiceDependencies {
  repository: Repository;
  logger: Logger;
}

export class Service {
  constructor(private deps: ServiceDependencies) {}
}
```

## Dynamic Imports

```typescript
// Lazy load modules for code splitting
export async function loadPrinterModule(): Promise<typeof import('./printer')> {
  return import('./printer');
}

// Conditional imports
export async function getBackendForModel(model: PrinterModelType) {
  switch (model) {
    case 'adventurer-5m':
      return import('./backends/ad5m');
    case 'adventurer-5m-pro':
      return import('./backends/ad5m-pro');
    default:
      return import('./backends/generic');
  }
}

// Dynamic import with type assertion
export async function loadPlugin<T>(name: string): Promise<T> {
  const module = await import(`./plugins/${name}`);
  return module as unknown as T;
}
```
