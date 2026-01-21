# Type Guards and Assertions

## Simple Type Guards

```typescript
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
```

## Complex Type Guards

```typescript
interface UserData {
  name: string;
  email: string;
  age: number;
}

export function isUserData(data: unknown): data is UserData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'email' in data &&
    'age' in data &&
    isString((data as Record<string, unknown>).name) &&
    isString((data as Record<string, unknown>).email) &&
    isNumber((data as Record<string, unknown>).age)
  );
}
```

## Assertion Functions

```typescript
// Assertion functions narrow types in subsequent code
export function assertIsString(value: unknown): asserts value is string {
  if (!isString(value)) {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

export function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error('Value is undefined or null');
  }
}

export function assertIsValidConfig(data: unknown): asserts data is AppConfig {
  if (!isValidConfig(data)) {
    throw new Error('Invalid configuration data');
  }
}

// Usage
function processValue(value: unknown) {
  assertIsString(value);
  // TypeScript now knows value is string
  console.log(value.toUpperCase());
}

function getConnection(id: string | null) {
  assertIsDefined(id);
  // TypeScript now knows id is string (not null)
  return connections.get(id);
}
```

## Runtime Type Checking with Validation

```typescript
export function validateUserData(data: unknown): data is UserData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.age === 'number' &&
    obj.age >= 0 && obj.age <= 150
  );
}

export function parseUserData(data: unknown): UserData {
  if (!validateUserData(data)) {
    throw new Error('Invalid user data');
  }
  return data;
}
```

## Branded Types for ID Validation

```typescript
// Create branded types for type-safe IDs
export type UserId = string & { readonly __brand: 'UserId' };
export type EmailAddress = string & { readonly __brand: 'EmailAddress' };

export function createUserId(value: string): UserId {
  if (!/^[a-zA-Z0-9_-]{8,}$/.test(value)) {
    throw new Error('Invalid user ID format');
  }
  return value as UserId;
}

export function createEmailAddress(value: string): EmailAddress {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error('Invalid email address format');
  }
  return value as EmailAddress;
}

// Usage - TypeScript prevents mixing these types
function sendNotification(userId: UserId, message: string): void {
  // implementation
}

function sendEmail(email: EmailAddress, subject: string): void {
  // implementation
}

// Error: Argument of type 'string' is not assignable to parameter of type 'UserId'
// sendNotification('user123', 'Hello');

// Error: Arguments don't match
// sendNotification(createUserId('user123'), 'Hello');
// sendEmail(createUserId('user123'), 'Welcome'); // Error!

// Correct usage
sendNotification(createUserId('user_12345'), 'Hello');
sendEmail(createEmailAddress('user@example.com'), 'Welcome');
```

## Guard Factory

```typescript
// Generic type guard factory for checking object properties
function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function hasProperties<T extends PropertyKey>(
  obj: unknown,
  keys: readonly T[]
): obj is Record<T, unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    keys.every(key => key in obj)
  );
}

// Usage
function processConfig(config: unknown) {
  if (!hasProperties(config, ['host', 'port', 'timeout'])) {
    throw new Error('Invalid config');
  }
  // Now TypeScript knows config has host, port, timeout
  console.log(config.host, config.port, config.timeout);
}
```
