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
import { AppError, fromZodError } from './error.utils.js';

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

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * IP address schema (basic regex validation)
 */
export const IPAddressSchema = z.string()
  .regex(
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IP address'
  );

// ============================================================================
// OBJECT VALIDATION UTILITIES
// ============================================================================

