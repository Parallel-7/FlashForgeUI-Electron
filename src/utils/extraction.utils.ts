/**
 * @fileoverview Type-safe data extraction utilities for safely retrieving and converting
 * values from unknown or untyped objects. Provides defensive programming helpers for parsing
 * API responses, configuration files, and IPC message payloads with robust default value
 * handling and type coercion capabilities.
 *
 * Key Features:
 * - Safe extraction of primitives (string, number, boolean) from unknown objects
 * - Array extraction with generic type support
 * - Nested property access via dot-notation paths
 * - Multi-property extraction with schema-based defaults
 * - Value existence checking with empty string/array detection
 * - Type coercion with validation and range clamping
 * - Default value fallback for all extraction operations
 *
 * Primary Functions:
 * - safeExtractString(obj, key, default): Extract string with fallback
 * - safeExtractNumber(obj, key, default): Extract/parse number with fallback
 * - safeExtractBoolean(obj, key, default): Extract/coerce boolean with fallback
 * - safeExtractArray(obj, key, default): Extract array with type parameter
 * - safeExtractNested(obj, path, default): Dot-notation property access
 * - safeExtractMultiple(obj, schema): Batch extraction with schema definition
 *
 * Utility Functions:
 * - isValidObject(value): Type guard for non-null, non-array objects
 * - toNumber(value, default, min, max): Convert to number with range validation
 * - hasValue(value): Check for non-empty, non-null values
 *
 * Type Coercion:
 * - Numbers: Parses strings, validates finite values
 * - Booleans: Handles string "true"/"false", numbers (0=false), and native booleans
 * - Strings: Converts non-null values via String() constructor
 *
 * Usage Context:
 * Extensively used for parsing printer API responses, configuration file loading,
 * IPC message handling, and any scenario requiring safe access to potentially
 * undefined or incorrectly typed data.
 */

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
