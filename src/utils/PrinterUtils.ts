/**
 * @fileoverview Printer family detection, model identification, and connection utilities
 * for FlashForge printer compatibility management. Provides comprehensive printer classification
 * (5M family vs. legacy), feature detection (camera, LED, filtration, material station), and
 * validation helpers for IP addresses, serial numbers, and check codes.
 *
 * Key Features:
 * - Printer model type detection from typeName strings (5M, 5M Pro, AD5X, legacy)
 * - Enhanced printer family information with feature capability flags
 * - Client type determination (new API vs. legacy API)
 * - Connection parameter validation (IP, serial number, check code)
 * - Feature availability checking and override capability detection
 * - Error message generation for connection failures
 * - Timeout calculation based on printer family
 * - Display name formatting and sanitization
 *
 * Printer Classification:
 * - 5M Family: Adventurer 5M, 5M Pro, AD5X (new API, check code required)
 * - Legacy: All other models (legacy API, direct connection)
 *
 * Model-Specific Features:
 * - Adventurer 5M Pro: Built-in camera, LED, filtration
 * - Adventurer 5M: No built-in peripherals
 * - AD5X: Material station support, no built-in camera/LED/filtration
 * - Generic Legacy: No built-in peripherals, no material station
 *
 * Key Functions:
 * - detectPrinterModelType(typeName): Returns PrinterModelType enum
 * - getPrinterModelInfo(typeName): Returns comprehensive feature info
 * - detectPrinterFamily(typeName): Returns family classification with check code requirement
 * - determineClientType(is5MFamily): Returns 'new' or 'legacy' client type
 * - supportsDualAPI(modelType): Checks if printer can use both APIs
 *
 * Validation Functions:
 * - isValidIPAddress(ip): IPv4 format validation
 * - isValidSerialNumber(serial): Serial number format validation
 * - isValidCheckCode(code): Check code format validation
 * - shouldPromptForCheckCode(): Determines if check code prompt is needed
 *
 * Utilities:
 * - formatPrinterName/sanitizePrinterName: Display and filesystem-safe naming
 * - getConnectionErrorMessage(error): User-friendly error messages
 * - getConnectionTimeout(is5MFamily): Dynamic timeout based on printer type
 * - formatConnectionStatus(isConnected, name): Status string generation
 *
 * Context:
 * Central to printer backend selection, connection workflow, and feature availability
 * throughout the application. Used by ConnectionFlowManager, PrinterBackendManager,
 * and UI components for printer-specific behavior.
 */

// src/utils/PrinterUtils.ts
// Utility functions for printer connection and family detection

import { PrinterFamilyInfo, PrinterClientType } from '../types/printer.js';
import { PrinterModelType } from '../types/printer-backend/index.js';

/**
 * Enhanced printer family info with specific model type
 */
export interface EnhancedPrinterFamilyInfo extends PrinterFamilyInfo {
  readonly modelType: PrinterModelType;
  readonly hasBuiltinCamera: boolean;
  readonly hasBuiltinLED: boolean;
  readonly hasBuiltinFiltration: boolean;
  readonly supportsMaterialStation: boolean;
}

/**
 * Detect specific printer model type from typeName
 * Returns detailed model information for backend selection
 */
export const detectPrinterModelType = (typeName: string): PrinterModelType => {
  if (!typeName) {
    return 'generic-legacy';
  }

  const typeNameLower = typeName.toLowerCase();
  
  // Check for specific models in order of specificity
  if (typeNameLower.includes('5m pro')) {
    return 'adventurer-5m-pro';
  } else if (typeNameLower.includes('5m')) {
    return 'adventurer-5m';
  } else if (typeNameLower.includes('ad5x')) {
    return 'ad5x';
  }
  
  // Default to generic legacy for all other printers
  return 'generic-legacy';
};

/**
 * Get detailed printer model information
 * Includes feature capabilities and requirements
 */
export const getPrinterModelInfo = (typeName: string): EnhancedPrinterFamilyInfo => {
  const modelType = detectPrinterModelType(typeName);
  
  switch (modelType) {
    case 'adventurer-5m-pro':
      return {
        is5MFamily: true,
        requiresCheckCode: true,
        familyName: 'Adventurer 5M Pro',
        modelType,
        hasBuiltinCamera: true,
        hasBuiltinLED: true,
        hasBuiltinFiltration: true,
        supportsMaterialStation: false
      };
      
    case 'adventurer-5m':
      return {
        is5MFamily: true,
        requiresCheckCode: true,
        familyName: 'Adventurer 5M',
        modelType,
        hasBuiltinCamera: false,
        hasBuiltinLED: false,
        hasBuiltinFiltration: false,
        supportsMaterialStation: false
      };
      
    case 'ad5x':
      return {
        is5MFamily: true,
        requiresCheckCode: true,
        familyName: 'AD5X',
        modelType,
        hasBuiltinCamera: false,
        hasBuiltinLED: false,
        hasBuiltinFiltration: false,
        supportsMaterialStation: true
      };
      
    case 'generic-legacy':
    default:
      return {
        is5MFamily: false,
        requiresCheckCode: false,
        familyName: typeName || 'Legacy Printer',
        modelType: 'generic-legacy',
        hasBuiltinCamera: false,
        hasBuiltinLED: false,
        hasBuiltinFiltration: false,
        supportsMaterialStation: false
      };
  }
};

/**
 * Check if printer supports dual API usage
 * Modern printers (5M family) can use both new and legacy APIs
 */
export const supportsDualAPI = (modelType: PrinterModelType): boolean => {
  return modelType !== 'generic-legacy';
};

/**
 * Get human-readable model name for UI display
 */
export const getModelDisplayName = (modelType: PrinterModelType): string => {
  switch (modelType) {
    case 'adventurer-5m-pro':
      return 'Adventurer 5M Pro';
    case 'adventurer-5m':
      return 'Adventurer 5M';
    case 'ad5x':
      return 'AD5X';
    case 'generic-legacy':
    default:
      return 'Legacy Printer';
  }
};

/**
 * Determine if model requires material station configuration
 * Currently only AD5X has material station support
 */
export const requiresMaterialStation = (modelType: PrinterModelType): boolean => {
  return modelType === 'ad5x';
};

/**
 * Get feature stub message for disabled features
 */
export const getFeatureStubMessage = (feature: string, modelType: PrinterModelType): string => {
  const modelName = getModelDisplayName(modelType);
  return `${feature} is not available on the ${modelName}.`;
};

/**
 * Check if feature can be overridden by user settings
 */
export const canOverrideFeature = (feature: string, modelType: PrinterModelType): boolean => {
  switch (feature) {
    case 'camera':
      return true; // Custom camera URL can be set on any printer
    case 'led-control':
      return supportsDualAPI(modelType); // Custom LED control only on modern printers
    case 'filtration':
      return false; // Filtration is hardware-specific and cannot be overridden
    default:
      return false;
  }
};

/**
 * Get settings key for feature override
 */
export const getFeatureOverrideSettingsKey = (feature: string): string | null => {
  switch (feature) {
    case 'camera':
      return 'CustomCameraEnabled';
    case 'led-control':
      return 'CustomLEDControl';
    default:
      return null;
  }
};

/**
 * Determine if a printer belongs to the 5M family based on typeName
 * 5M family includes: Adventurer 5M, Adventurer 5M Pro, AD5X
 * These printers require check codes for pairing
 */
export const detectPrinterFamily = (typeName: string): PrinterFamilyInfo => {
  if (!typeName) {
    return {
      is5MFamily: false,
      requiresCheckCode: false,
      familyName: 'Unknown'
    };
  }

  const typeNameLower = typeName.toLowerCase();
  
  // Check for 5M family indicators
  const is5MFamily = typeNameLower.includes('5m') || typeNameLower.includes('ad5x');
  
  if (is5MFamily) {
    let familyName = 'Adventurer 5M Family';
    
    if (typeNameLower.includes('5m pro')) {
      familyName = 'Adventurer 5M Pro';
    } else if (typeNameLower.includes('5m')) {
      familyName = 'Adventurer 5M';
    } else if (typeNameLower.includes('ad5x')) {
      familyName = 'AD5X';
    }
    
    return {
      is5MFamily: true,
      requiresCheckCode: true,
      familyName
    };
  }
  
  // Legacy/older printers - direct connection
  return {
    is5MFamily: false,
    requiresCheckCode: false,
    familyName: typeName
  };
};

/**
 * Determine client type based on printer family
 * 5M family uses "new" API, others use "legacy" API
 */
export const determineClientType = (is5MFamily: boolean): PrinterClientType => {
  return is5MFamily ? 'new' : 'legacy';
};

/**
 * Format printer name for display
 * Ensures consistent naming across the UI
 */
export const formatPrinterName = (name: string, serialNumber?: string): string => {
  if (!name || name.trim().length === 0) {
    return serialNumber ? `Printer (${serialNumber})` : 'Unknown Printer';
  }
  
  return name.trim();
};

/**
 * Validate IP address format
 * Basic validation for IPv4 addresses
 */
export const isValidIPAddress = (ip: string): boolean => {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  
  const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

/**
 * Validate serial number format
 * Basic validation for FlashForge serial numbers
 */
export const isValidSerialNumber = (serialNumber: string): boolean => {
  if (!serialNumber || typeof serialNumber !== 'string') {
    return false;
  }
  
  // Serial numbers should be at least 3 characters and contain alphanumeric characters
  const trimmed = serialNumber.trim();
  return trimmed.length >= 3 && /^[A-Za-z0-9\-_]+$/.test(trimmed);
};

/**
 * Validate check code format
 * Check codes are typically numeric or alphanumeric
 */
export const isValidCheckCode = (checkCode: string): boolean => {
  if (!checkCode || typeof checkCode !== 'string') {
    return false;
  }
  
  // Check codes should be at least 1 character
  const trimmed = checkCode.trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
};

/**
 * Generate a default check code
 * Used as fallback when no check code is required
 */
export const getDefaultCheckCode = (): string => {
  return '123';
};

/**
 * Sanitize printer name for file system usage
 * Removes invalid characters that could cause issues
 */
export const sanitizePrinterName = (name: string): string => {
  if (!name) {
    return 'unknown_printer';
  }
  
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid file system characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase();
};

/**
 * Get user-friendly error message for connection failures
 */
export const getConnectionErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'Unknown connection error';
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // Type guard for error objects
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    
    // Handle specific error types
    if (errorObj.code === 'ECONNREFUSED') {
      return 'Connection refused - printer may be offline or unreachable';
    }
    
    if (errorObj.code === 'ETIMEDOUT') {
      return 'Connection timed out - check network connection';
    }
    
    if (errorObj.code === 'ENOTFOUND') {
      return 'Printer not found - check IP address';
    }
  }
  
  return 'Connection failed - please check printer and network settings';
};

/**
 * Calculate connection timeout based on printer type
 * 5M family printers may need longer timeouts for pairing
 */
export const getConnectionTimeout = (is5MFamily: boolean): number => {
  // Return timeout in milliseconds
  return is5MFamily ? 15000 : 10000; // 15s for 5M, 10s for legacy
};

/**
 * Check if a check code prompt is needed
 * Based on printer family and configuration
 */
export const shouldPromptForCheckCode = (
  is5MFamily: boolean, 
  savedCheckCode?: string,
  ForceLegacyAPI: boolean = false
): boolean => {
  if (ForceLegacyAPI) {
    return false; // Legacy API mode doesn't need check codes
  }
  
  if (!is5MFamily) {
    return false; // Non-5M printers don't need check codes
  }
  
  // 5M printers need check code if not already saved or saved code is default/empty
  return !savedCheckCode || savedCheckCode === getDefaultCheckCode() || savedCheckCode.trim().length === 0;
};

/**
 * Format connection status message
 */
export const formatConnectionStatus = (isConnected: boolean, printerName?: string): string => {
  if (isConnected && printerName) {
    return `Connected to ${printerName}`;
  } else if (isConnected) {
    return 'Connected to printer';
  } else {
    return 'Not connected';
  }
};

