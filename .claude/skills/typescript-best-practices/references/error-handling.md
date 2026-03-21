# Error Handling Patterns

## Structured Error Types

```typescript
// Comprehensive error enumeration
export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',

  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_ERROR = 'SERVICE_ERROR',

  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

// Rich error class with context
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

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}
```

## Error Factory Functions

```typescript
// Type-safe error factories
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

export function validationError(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(message, ErrorCode.VALIDATION, context);
}

export function notFoundError(resource: string, id: string): AppError {
  return new AppError(
    `${resource} with id '${id}' not found`,
    ErrorCode.NOT_FOUND,
    { resource, id }
  );
}
```

## Error Conversion

```typescript
// Convert unknown errors to AppError
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorCode.UNKNOWN,
      undefined,
      error
    );
  }

  if (typeof error === 'string') {
    return new AppError(error);
  }

  return new AppError('An unknown error occurred', ErrorCode.UNKNOWN, { originalError: error });
}

// Safe async wrapper
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorContext?: Record<string, unknown>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toAppError(error) };
  }
}
```

## Retry Logic with Error Handling

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry: (error: AppError) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = toAppError(error);

      if (attempt === options.maxAttempts || !options.shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt - 1),
        options.maxDelay
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const result = await withRetry(
  () => connectToService(options),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    shouldRetry: (error) => error.code === ErrorCode.NETWORK
  }
);
```

## Async Error Boundary Pattern

```typescript
export class AsyncErrorBoundary {
  static async handle<T>(
    fn: () => Promise<T>,
    errorHandler: (error: AppError) => void
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      errorHandler(toAppError(error));
      return null;
    }
  }
}

// Usage in async operations
const result = await AsyncErrorBoundary.handle(
  () => fetchData(),
  (error) => console.error('Failed to fetch:', error.message, error.context)
);
```
