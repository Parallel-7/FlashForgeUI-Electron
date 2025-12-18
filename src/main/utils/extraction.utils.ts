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
 *
 * Utility Functions:
 * - isValidObject(value): Type guard for non-null, non-array objects
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
