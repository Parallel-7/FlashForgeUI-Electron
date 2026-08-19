/**
 * @fileoverview Zod-based validation toolkit: success/failure result types
 * with issue details, safe-parse helpers with defaults, common schemas for
 * primitives, type-guard factories, and error formatting. Use it wherever
 * external data (config, API responses, user input) crosses into typed code.
 */

import { z } from 'zod';
import { AppError } from './error.utils.js';

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
export const IPAddressSchema = z
  .string()
  .regex(
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IP address'
  );

// ============================================================================
// OBJECT VALIDATION UTILITIES
// ============================================================================
