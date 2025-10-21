/**
 * @fileoverview Zod-based validation utilities providing type-safe schema validation,
 * error handling, and common validation patterns for configuration, API responses, and
 * user input. Includes reusable schemas for primitives, type guard factories, and
 * specialized validation result structures for consistent error handling.
 *
 * Key Features:
 * - Comprehensive validation result types (success/failure with detailed errors)
 * - Safe parsing with default value fallback
 * - Partial validation for update operations
 * - Validation with transformation pipelines
 * - Type guard generation from schemas
 * - Array validation with individual item error tracking
 * - Object schema field picking/omitting
 * - Type coercion utilities (string to number/boolean/date)
 * - Validation error formatting for user display
 *
 * Validation Result Types:
 * - ValidationSuccess<T>: Contains validated data
 * - ValidationFailure: Contains AppError and detailed issue array
 * - ValidationResult<T>: Union type for result handling
 *
 * Core Functions:
 * - validate(schema, data): Full validation with detailed error info
 * - parseWithDefault(schema, data, default): Safe parse with fallback
 * - validatePartial(schema, data): Partial validation for updates
 * - validateAndTransform(schema, data, transform): Validation + transformation pipeline
 *
 * Common Schemas:
 * - NonEmptyStringSchema: Minimum 1 character string
 * - URLSchema: Valid URL format
 * - EmailSchema: Valid email format
 * - PortSchema: Integer 1-65535
 * - IPAddressSchema: IPv4 regex validation
 * - FilePathSchema: Non-empty path without null characters
 * - PositiveNumberSchema: Positive finite number
 * - PercentageSchema: Number 0-100
 *
 * Type Guard Factories:
 * - createTypeGuard(schema): Synchronous type guard function
 * - createAsyncTypeGuard(schema): Async type guard for async schemas
 *
 * Array Utilities:
 * - validateArray(schema, data): Individual item validation with indexed errors
 * - filterValid(schema, data): Extract only valid items from array
 *
 * Object Utilities:
 * - pickFields(schema, fields): Create schema with subset of fields
 * - omitFields(schema, fields): Create schema excluding specific fields
 *
 * Coercion:
 * - coerceToNumber(value): Safe number coercion with null on failure
 * - coerceToBoolean(value): Smart boolean coercion ("true", 1, etc.)
 * - coerceToDate(value): Date coercion with validation
 *
 * Error Formatting:
 * - formatValidationErrors(error): Multi-line error message with paths
 * - getFirstErrorMessage(error): First error message for simple feedback
 *
 * Context:
 * Used throughout the application for configuration validation, API response validation,
 * form input validation, and ensuring type safety at runtime for external data sources.
 */

import { z, ZodError, ZodSchema, ZodObject } from 'zod';
import { AppError, fromZodError } from './error.utils';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Success validation result
 */
export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/**
 * Failed validation result
 */
export interface ValidationFailure {
  success: false;
  error: AppError;
  issues?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validation result union type
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate data against a schema with detailed error info
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const appError = fromZodError(error);
      return {
        success: false,
        error: appError,
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      };
    }
    
    return {
      success: false,
      error: error instanceof AppError 
        ? error 
        : new AppError('Validation failed', undefined, { error })
    };
  }
}

/**
 * Safe parse with default value
 */
export function parseWithDefault<T>(
  schema: ZodSchema<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}

/**
 * Partial validation for updates (only works with object schemas)
 */
export function validatePartial<T, U extends Record<string, z.ZodTypeAny>>(
  schema: ZodObject<U>,
  data: unknown
): ValidationResult<T> {
  const partialSchema = schema.partial();
  return validate(partialSchema, data) as ValidationResult<T>;
}

/**
 * Validate and transform data
 */
export function validateAndTransform<Input, Output>(
  schema: ZodSchema<Input>,
  data: unknown,
  transform: (input: Input) => Output
): ValidationResult<Output> {
  const validationResult = validate(schema, data);
  
  if (!validationResult.success) {
    return validationResult;
  }
  
  try {
    const transformed = transform(validationResult.data);
    return {
      success: true,
      data: transformed
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof AppError
        ? error
        : new AppError('Transformation failed', undefined, { error })
    };
  }
}

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * Non-empty string schema
 */
export const NonEmptyStringSchema = z.string().min(1, 'Value cannot be empty');

/**
 * URL validation schema
 */
export const URLSchema = z.string().url('Invalid URL format');

/**
 * Email validation schema
 */
export const EmailSchema = z.string().email('Invalid email format');

/**
 * Port number schema
 */
export const PortSchema = z.number()
  .int('Port must be an integer')
  .min(1, 'Port must be at least 1')
  .max(65535, 'Port must be at most 65535');

/**
 * IP address schema (basic regex validation)
 */
export const IPAddressSchema = z.string()
  .regex(
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IP address'
  );

/**
 * File path schema (basic validation)
 */
export const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .refine(
    (path) => !path.includes('\0'),
    'File path contains invalid characters'
  );

/**
 * Positive number schema
 */
export const PositiveNumberSchema = z.number()
  .positive('Value must be positive')
  .finite('Value must be finite');

/**
 * Percentage schema (0-100)
 */
export const PercentageSchema = z.number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100');

// ============================================================================
// TYPE GUARD FACTORIES
// ============================================================================

/**
 * Create a type guard from a Zod schema
 */
export function createTypeGuard<T>(
  schema: ZodSchema<T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return schema.safeParse(value).success;
  };
}

/**
 * Create an async type guard from a Zod schema
 */
export function createAsyncTypeGuard<T>(
  schema: ZodSchema<T>
): (value: unknown) => Promise<boolean> {
  return async (value: unknown): Promise<boolean> => {
    const result = await schema.safeParseAsync(value);
    return result.success;
  };
}

// ============================================================================
// ARRAY VALIDATION UTILITIES
// ============================================================================

/**
 * Validate array items individually
 */
export function validateArray<T>(
  schema: ZodSchema<T>,
  data: unknown[]
): Array<ValidationResult<T>> {
  return data.map((item, index) => {
    const result = validate(schema, item);
    if (!result.success && result.issues) {
      // Prefix paths with array index
      result.issues.forEach(issue => {
        issue.path = `[${index}]${issue.path ? '.' + issue.path : ''}`;
      });
    }
    return result;
  });
}

/**
 * Filter valid items from array
 */
export function filterValid<T>(
  schema: ZodSchema<T>,
  data: unknown[]
): T[] {
  return data
    .map(item => schema.safeParse(item))
    .filter(result => result.success)
    .map(result => result.data!);
}

// ============================================================================
// OBJECT VALIDATION UTILITIES
// ============================================================================

/**
 * Pick specific fields from schema
 */
export function pickFields<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  fields: Array<keyof T>
): z.ZodObject<Pick<T, typeof fields[number]>> {
  const picked: Partial<T> = {};
  fields.forEach(field => {
    picked[field] = schema.shape[field];
  });
  return z.object(picked as Pick<T, typeof fields[number]>);
}

/**
 * Omit specific fields from schema
 */
export function omitFields<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  fields: Array<keyof T>
): z.ZodObject<Omit<T, typeof fields[number]>> {
  const shape = { ...schema.shape };
  fields.forEach(field => {
    delete shape[field];
  });
  return z.object(shape as Omit<T, typeof fields[number]>);
}

// ============================================================================
// COERCION UTILITIES
// ============================================================================

/**
 * Coerce string to number with validation
 */
export function coerceToNumber(value: unknown): number | null {
  const schema = z.coerce.number();
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Coerce string to boolean
 */
export function coerceToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

/**
 * Coerce to date
 */
export function coerceToDate(value: unknown): Date | null {
  const schema = z.coerce.date();
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: ZodError): string {
  const messages = error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
  
  return messages.join('\n');
}

/**
 * Get first error message
 */
export function getFirstErrorMessage(error: ZodError): string {
  return error.issues[0]?.message || 'Validation failed';
}

