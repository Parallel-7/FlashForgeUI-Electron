# Union Types and Discriminated Unions

## Discriminated Unions for State Management

```typescript
// Discriminated unions provide type-safe state handling
export type ConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; progress: number }
  | { status: 'connected'; connectionId: string }
  | { status: 'error'; message: string };

export function handleState(state: ConnectionState): void {
  switch (state.status) {
    case 'disconnected':
      // TypeScript knows this branch has no additional properties
      console.log('Not connected');
      break;
    case 'connecting':
      // TypeScript knows progress is available
      updateProgressBar(state.progress);
      break;
    case 'connected':
      // TypeScript knows connectionId is available
      console.log('Connected to:', state.connectionId);
      break;
    case 'error':
      // TypeScript knows message is available
      showError(state.message);
      break;
  }
}
```

## Union Type Guards

```typescript
export type NotificationData =
  | { type: 'task-complete'; taskName: string; duration: number }
  | { type: 'task-failed'; taskName: string; error: string }
  | { type: 'connection-lost'; serviceName: string }
  | { type: 'connection-error'; host: string; error: string };

export function isTaskCompleteNotification(
  notification: NotificationData
): notification is { type: 'task-complete'; taskName: string; duration: number } {
  return notification.type === 'task-complete';
}

export function isConnectionNotification(
  notification: NotificationData
): notification is { type: 'connection-lost' | 'connection-error' } {
  return notification.type === 'connection-lost' || notification.type === 'connection-error';
}

// Usage with exhaustive checking
export function handleNotification(notification: NotificationData): void {
  switch (notification.type) {
    case 'task-complete':
      logCompletion(notification.taskName, notification.duration);
      break;
    case 'task-failed':
      logFailure(notification.taskName, notification.error);
      break;
    case 'connection-lost':
      notifyConnectionLost(notification.serviceName);
      break;
    case 'connection-error':
      notifyConnectionError(notification.host, notification.error);
      break;
    default:
      // TypeScript ensures all cases are handled
      const _exhaustiveCheck: never = notification;
      break;
  }
}
```

## Result Type Pattern

```typescript
// Result type for safe error handling
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function connectToService(options: ConnectionOptions): Promise<Result<ServiceConnection>> {
  try {
    const connection = await establishConnection(options);
    return { success: true, data: connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

// Usage
const result = await connectToService(options);
if (result.success) {
  // TypeScript knows result.data is ServiceConnection
  console.log('Connected to:', result.data.id);
} else {
  // TypeScript knows result.error is Error
  console.error('Connection failed:', result.error.message);
}
```

## Tagged Unions for API Responses

```typescript
export type ApiResponse =
  | { tag: 'success'; data: UserData }
  | { tag: 'not_found'; message: string }
  | { tag: 'error'; code: number; message: string };

export async function fetchUser(id: string): Promise<ApiResponse> {
  const response = await fetch(`/api/users/${id}`);

  if (response.ok) {
    const data = await response.json();
    return { tag: 'success', data };
  }

  if (response.status === 404) {
    return { tag: 'not_found', message: 'User not found' };
  }

  return { tag: 'error', code: response.status, message: response.statusText };
}

// Usage
const result = await fetchUser('123');
if (result.tag === 'success') {
  console.log('User:', result.data.name);
} else if (result.tag === 'not_found') {
  console.log(result.message);
} else {
  console.log(`Error ${result.code}: ${result.message}`);
}
```
