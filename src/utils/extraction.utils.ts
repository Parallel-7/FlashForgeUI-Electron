// src/utils/extraction.utils.ts
// Common data extraction utilities for safe type handling
// Used throughout the application for extracting values from unknown objects

/**
 * Check if value is a valid object (not null, not array)
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely extract a number from an unknown object
 * @param obj - Object to extract from
 * @param key - Property key
 * @param defaultValue - Default value if extraction fails
 */
export function safeExtractNumber(obj: unknown, key: string, defaultValue = 0): number {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return defaultValue;
}

/**
 * Safely extract a string from an unknown object
 * @param obj - Object to extract from
 * @param key - Property key
 * @param defaultValue - Default value if extraction fails
 */
export function safeExtractString(obj: unknown, key: string, defaultValue = ''): string {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (value !== null && value !== undefined) {
    return String(value);
  }
  
  return defaultValue;
}

/**
 * Safely extract a boolean from an unknown object
 * @param obj - Object to extract from
 * @param key - Property key
 * @param defaultValue - Default value if extraction fails
 */
export function safeExtractBoolean(obj: unknown, key: string, defaultValue = false): boolean {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  
  if (typeof value === 'number') {
    return value !== 0;
  }
  
  return defaultValue;
}

/**
 * Safely extract an array from an unknown object
 * @param obj - Object to extract from
 * @param key - Property key
 * @param defaultValue - Default value if extraction fails
 */
export function safeExtractArray<T = unknown>(
  obj: unknown, 
  key: string, 
  defaultValue: T[] = []
): T[] {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  
  if (Array.isArray(value)) {
    return value as T[];
  }
  
  return defaultValue;
}

/**
 * Safely extract nested object property
 * @param obj - Object to extract from
 * @param path - Dot-separated path (e.g., 'parent.child.value')
 * @param defaultValue - Default value if extraction fails
 */
export function safeExtractNested<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue: T
): T {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (!isValidObject(current) || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current as T;
}

/**
 * Extract multiple properties from an object with defaults
 * @param obj - Object to extract from
 * @param schema - Schema defining properties and their defaults
 */
export function safeExtractMultiple<T extends Record<string, unknown>>(
  obj: unknown,
  schema: { [K in keyof T]: { key: string; default: T[K]; type: 'string' | 'number' | 'boolean' } }
): T {
  const result = {} as T;
  
  for (const [prop, config] of Object.entries(schema) as Array<[keyof T, typeof schema[keyof T]]>) {
    switch (config.type) {
      case 'string':
        result[prop] = safeExtractString(obj, config.key, config.default as string) as T[keyof T];
        break;
      case 'number':
        result[prop] = safeExtractNumber(obj, config.key, config.default as number) as T[keyof T];
        break;
      case 'boolean':
        result[prop] = safeExtractBoolean(obj, config.key, config.default as boolean) as T[keyof T];
        break;
    }
  }
  
  return result;
}

/**
 * Convert value to number with validation
 * @param value - Value to convert
 * @param defaultValue - Default if conversion fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 */
export function toNumber(
  value: unknown,
  defaultValue = 0,
  min = -Infinity,
  max = Infinity
): number {
  let num = defaultValue;
  
  if (typeof value === 'number' && !isNaN(value)) {
    num = value;
  } else if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      num = parsed;
    }
  }
  
  // Clamp to range
  return Math.max(min, Math.min(max, num));
}

/**
 * Check if a value exists and is not empty
 * @param value - Value to check
 */
export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  
  return true;
}
