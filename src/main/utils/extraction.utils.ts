/**
 * @fileoverview Defensive getters for unknown data. safeExtractString /
 * safeExtractNumber / safeExtractBoolean / safeExtractArray read one key from
 * an unknown object and fall back to a default when the key is missing or the
 * value has the wrong type. Use them to parse printer API responses, config
 * files and IPC payloads.
 */

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
export function safeExtractArray<T = unknown>(obj: unknown, key: string, defaultValue: T[] = []): T[] {
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
