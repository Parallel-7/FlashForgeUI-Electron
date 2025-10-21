/**
 * @fileoverview Structured error handling system with typed error codes, contextual metadata,
 * and user-friendly message generation. Provides custom AppError class extending Error with
 * categorized error codes, serialization support, and comprehensive error factory functions
 * for common error scenarios across the application.
 *
 * Key Features:
 * - Typed error code enumeration covering all application error categories
 * - Enhanced AppError class with context, timestamp, and original error tracking
 * - User-friendly message generation from error codes
 * - JSON serialization support for IPC transmission and logging
 * - Error factory functions for common scenarios (network, timeout, validation, etc.)
 * - Zod validation error conversion to structured AppError
 * - Error handling utilities (type guards, async wrappers, logging)
 * - IPC-compatible error result formatting
 *
 * Error Categories:
 * - General: UNKNOWN, VALIDATION, NETWORK, TIMEOUT
 * - Printer: NOT_CONNECTED, BUSY, ERROR, COMMUNICATION
 * - Backend: NOT_INITIALIZED, OPERATION_FAILED, UNSUPPORTED
 * - File: NOT_FOUND, TOO_LARGE, INVALID_FORMAT, UPLOAD_FAILED
 * - Configuration: INVALID, SAVE_FAILED, LOAD_FAILED
 * - IPC: CHANNEL_INVALID, TIMEOUT, HANDLER_NOT_FOUND
 *
 * AppError Properties:
 * - code: ErrorCode enum value for programmatic handling
 * - context: Record of additional metadata (printer info, operation details, etc.)
 * - timestamp: Error occurrence time for debugging
 * - originalError: Wrapped native Error for stack trace preservation
 *
 * Factory Functions:
 * - fromZodError(): Converts Zod validation errors with issue details
 * - networkError(): Creates network-related errors with context
 * - timeoutError(): Timeout errors with operation and duration info
 * - printerError(): Printer-specific errors with contextual data
 * - backendError(): Backend operation failures
 * - fileError(): File operation errors with file name context
 *
 * Utilities:
 * - isAppError(): Type guard for AppError instances
 * - toAppError(): Converts unknown errors to AppError
 * - withErrorHandling(): Async wrapper with error handling
 * - createErrorResult(): Formats errors for IPC responses
 * - logError(): Structured error logging with context
 */

import { ZodError } from 'zod';

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  
  // Printer errors
  PRINTER_NOT_CONNECTED = 'PRINTER_NOT_CONNECTED',
  PRINTER_BUSY = 'PRINTER_BUSY',
  PRINTER_ERROR = 'PRINTER_ERROR',
  PRINTER_COMMUNICATION = 'PRINTER_COMMUNICATION',
  
  // Backend errors
  BACKEND_NOT_INITIALIZED = 'BACKEND_NOT_INITIALIZED',
  BACKEND_OPERATION_FAILED = 'BACKEND_OPERATION_FAILED',
  BACKEND_UNSUPPORTED = 'BACKEND_UNSUPPORTED',
  
  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_FORMAT = 'FILE_INVALID_FORMAT',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  
  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  
  // IPC errors
  IPC_CHANNEL_INVALID = 'IPC_CHANNEL_INVALID',
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_HANDLER_NOT_FOUND = 'IPC_HANDLER_NOT_FOUND'
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

/**
 * Enhanced error class with structured context
 */
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
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
  
  /**
   * Convert to plain object for serialization
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
  
  /**
   * Get user-friendly error message
   */
  public getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.PRINTER_NOT_CONNECTED:
        return 'Please connect to a printer first';
      case ErrorCode.PRINTER_BUSY:
        return 'Printer is busy. Please wait for the current operation to complete';
      case ErrorCode.PRINTER_ERROR:
        return 'Printer reported an error. Please check the printer display';
      case ErrorCode.BACKEND_NOT_INITIALIZED:
        return 'Printer backend not initialized. Please reconnect';
      case ErrorCode.FILE_NOT_FOUND:
        return 'File not found. Please check the file path';
      case ErrorCode.FILE_TOO_LARGE:
        return 'File is too large to upload';
      case ErrorCode.FILE_INVALID_FORMAT:
        return 'Invalid file format. Please use a supported file type';
      case ErrorCode.CONFIG_INVALID:
        return 'Configuration is invalid. Please check your settings';
      case ErrorCode.NETWORK:
        return 'Network error. Please check your connection';
      case ErrorCode.TIMEOUT:
        return 'Operation timed out. Please try again';
      default:
        return this.message || 'An unexpected error occurred';
    }
  }
}

// ============================================================================
// ERROR FACTORIES
// ============================================================================

/**
 * Create error from Zod validation error
 */
export function fromZodError(error: ZodError, code: ErrorCode = ErrorCode.VALIDATION): AppError {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
  
  return new AppError(
    'Validation failed',
    code,
    { issues },
    error
  );
}

/**
 * Create network error
 */
export function networkError(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(message, ErrorCode.NETWORK, context);
}

/**
 * Create timeout error
 */
export function timeoutError(operation: string, timeoutMs: number): AppError {
  return new AppError(
    `Operation timed out after ${timeoutMs}ms`,
    ErrorCode.TIMEOUT,
    { operation, timeoutMs }
  );
}

/**
 * Create printer error
 */
export function printerError(
  message: string,
  code: ErrorCode = ErrorCode.PRINTER_ERROR,
  context?: Record<string, unknown>
): AppError {
  return new AppError(message, code, context);
}

/**
 * Create backend error
 */
export function backendError(
  message: string,
  operation: string,
  context?: Record<string, unknown>
): AppError {
  return new AppError(
    message,
    ErrorCode.BACKEND_OPERATION_FAILED,
    { operation, ...context }
  );
}

/**
 * Create file error
 */
export function fileError(
  message: string,
  fileName: string,
  code: ErrorCode = ErrorCode.FILE_INVALID_FORMAT
): AppError {
  return new AppError(message, code, { fileName });
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown, defaultCode: ErrorCode = ErrorCode.UNKNOWN): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof ZodError) {
    return fromZodError(error);
  }
  
  if (error instanceof Error) {
    return new AppError(
      error.message,
      defaultCode,
      undefined,
      error
    );
  }
  
  if (typeof error === 'string') {
    return new AppError(error, defaultCode);
  }
  
  return new AppError(
    'An unknown error occurred',
    defaultCode,
    { error }
  );
}

/**
 * Execute function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: AppError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const appError = toAppError(error);
    if (errorHandler) {
      errorHandler(appError);
    } else {
      console.error('Unhandled error:', appError.toJSON());
    }
    return null;
  }
}

/**
 * Create error result for IPC responses
 */
export function createErrorResult(error: unknown): { success: false; error: string } {
  const appError = toAppError(error);
  return {
    success: false,
    error: appError.getUserMessage()
  };
}

/**
 * Log error with context
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const appError = toAppError(error);
  console.error('Error occurred:', {
    ...appError.toJSON(),
    additionalContext: context
  });
}

