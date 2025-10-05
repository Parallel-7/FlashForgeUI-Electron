/**
 * @fileoverview Zod validation schemas for application configuration, printer details,
 * and multi-printer management. Provides type-safe runtime validation for config.json,
 * printer_details.json, and window configuration data with comprehensive schema definitions
 * matching legacy format requirements exactly.
 *
 * Key Features:
 * - Complete AppConfig schema matching legacy config.json structure
 * - Partial config schema for incremental updates
 * - Printer details schema with IP validation and client type enforcement
 * - Multi-printer configuration schema for saved printer management
 * - Window bounds schema for dialog positioning
 * - Camera configuration schema with port validation
 * - Type inference for validated data structures
 * - Validation helper functions for common operations
 *
 * Primary Schemas:
 * - AppConfigSchema: Full application configuration (Discord, alerts, WebUI, camera, etc.)
 * - PartialAppConfigSchema: Subset of config for update operations
 * - StoredPrinterDetailsSchema: Per-printer saved details (IP, serial, check code, model type)
 * - MultiPrinterConfigSchema: Collection of saved printers with last-used tracking
 * - WindowBoundsSchema: Dialog window position and size
 * - CameraConfigSchema: Camera settings with URL and proxy port
 *
 * Enums:
 * - ClientTypeSchema: 'legacy' | 'new' for API version selection
 * - PrinterModelTypeSchema: 'generic-legacy' | 'adventurer-5m' | 'adventurer-5m-pro' | 'ad5x'
 *
 * Validation Helpers:
 * - validateAppConfig(data): Validates complete config, returns null on failure
 * - validatePartialConfig(data): Validates partial config for updates
 * - validateStoredPrinterDetails(data): Validates printer details
 * - validateMultiPrinterConfig(data): Validates multi-printer configuration
 * - createDefaultConfig(): Generates default configuration with all required fields
 * - mergeConfigUpdate(current, update): Safely merges partial updates into current config
 *
 * Type Exports:
 * - ValidatedAppConfig: Inferred type from AppConfigSchema
 * - ValidatedPartialAppConfig: Inferred type for partial updates
 * - ValidatedStoredPrinterDetails: Inferred printer details type
 * - ValidatedMultiPrinterConfig: Inferred multi-printer config type
 * - ValidatedCameraConfig: Inferred camera config type
 *
 * Validation Features:
 * - IP address regex validation for printer connections
 * - Port number range validation (1-65535)
 * - Required vs. optional field enforcement
 * - Default value support for new config keys
 * - Type coercion where appropriate
 *
 * Context:
 * Used by ConfigManager, PrinterDetailsManager, and IPC handlers to ensure all configuration
 * data is valid before persistence or application. Prevents runtime errors from malformed
 * config files and provides clear error messages for debugging.
 */

import { z } from 'zod';

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

/**
 * Application configuration schema matching legacy format exactly
 */
export const AppConfigSchema = z.object({
  DiscordSync: z.boolean(),
  AlwaysOnTop: z.boolean(),
  AlertWhenComplete: z.boolean(),
  AlertWhenCooled: z.boolean(),
  AudioAlerts: z.boolean(),
  VisualAlerts: z.boolean(),
  DebugMode: z.boolean(),
  WebhookUrl: z.string(),
  CustomCamera: z.boolean(),
  CustomCameraUrl: z.string(),
  CustomLeds: z.boolean(),
  ForceLegacyAPI: z.boolean(),
  DiscordUpdateIntervalMinutes: z.number().min(1).max(60),
  WebUIEnabled: z.boolean(),
  WebUIPort: z.number().min(1).max(65535),
  WebUIPassword: z.string(),
  CameraProxyPort: z.number().min(1).max(65535),
  RoundedUI: z.boolean(),
  FilamentTrackerIntegrationEnabled: z.boolean().default(false),
  FilamentTrackerAPIKey: z.string().default('')
});

/**
 * Partial configuration for updates
 */
export const PartialAppConfigSchema = AppConfigSchema.partial();

/**
 * Configuration update event schema
 */
export const ConfigUpdateEventSchema = z.object({
  previous: AppConfigSchema,
  current: AppConfigSchema,
  changedKeys: z.array(z.string())
});

// ============================================================================
// PRINTER DETAILS SCHEMAS
// ============================================================================

/**
 * Printer client type enum
 */
export const ClientTypeSchema = z.enum(['legacy', 'new']);

/**
 * Printer model type enum
 */
export const PrinterModelTypeSchema = z.enum([
  'generic-legacy',
  'adventurer-5m',
  'adventurer-5m-pro',
  'ad5x'
]);

/**
 * Stored printer details schema
 */
export const StoredPrinterDetailsSchema = z.object({
  Name: z.string(),
  IPAddress: z.string().regex(
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IP address format'
  ),
  SerialNumber: z.string(),
  CheckCode: z.string(),
  ClientType: ClientTypeSchema,
  printerModel: z.string(),
  modelType: PrinterModelTypeSchema,
  lastConnected: z.string().optional() // ISO date string
});

/**
 * Multi-printer configuration schema
 */
export const MultiPrinterConfigSchema = z.object({
  lastUsedPrinterSerial: z.string().nullable(),
  printers: z.record(z.string(), StoredPrinterDetailsSchema)
});

// ============================================================================
// WINDOW CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Window bounds schema for dialog positioning
 */
export const WindowBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(100),
  height: z.number().min(100)
});

/**
 * Camera configuration schema
 */
export const CameraConfigSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url().optional(),
  proxyPort: z.number().min(1).max(65535)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;
export type ValidatedPartialAppConfig = z.infer<typeof PartialAppConfigSchema>;
export type ValidatedStoredPrinterDetails = z.infer<typeof StoredPrinterDetailsSchema>;
export type ValidatedMultiPrinterConfig = z.infer<typeof MultiPrinterConfigSchema>;
export type ValidatedCameraConfig = z.infer<typeof CameraConfigSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate complete configuration from file
 */
export function validateAppConfig(data: unknown): ValidatedAppConfig | null {
  const result = AppConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate partial configuration for updates
 */
export function validatePartialConfig(data: unknown): ValidatedPartialAppConfig | null {
  const result = PartialAppConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate stored printer details
 */
export function validateStoredPrinterDetails(data: unknown): ValidatedStoredPrinterDetails | null {
  const result = StoredPrinterDetailsSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate multi-printer configuration
 */
export function validateMultiPrinterConfig(data: unknown): ValidatedMultiPrinterConfig | null {
  const result = MultiPrinterConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Create default configuration with validation
 */
export function createDefaultConfig(): ValidatedAppConfig {
  return {
    DiscordSync: false,
    AlwaysOnTop: false,
    AlertWhenComplete: true,
    AlertWhenCooled: true,
    AudioAlerts: true,
    VisualAlerts: true,
    DebugMode: false,
    WebhookUrl: '',
    CustomCamera: false,
    CustomCameraUrl: '',
    CustomLeds: false,
    ForceLegacyAPI: false,
    DiscordUpdateIntervalMinutes: 5,
    WebUIEnabled: true,
    WebUIPort: 3000,
    WebUIPassword: 'changeme',
    CameraProxyPort: 8181,
    RoundedUI: false,
    FilamentTrackerIntegrationEnabled: false,
    FilamentTrackerAPIKey: ''
  };
}

/**
 * Safely merge configuration updates
 */
export function mergeConfigUpdate(
  current: ValidatedAppConfig,
  update: unknown
): ValidatedAppConfig | null {
  const validatedUpdate = validatePartialConfig(update);
  if (!validatedUpdate) return null;
  
  const merged = { ...current, ...validatedUpdate };
  return validateAppConfig(merged);
}

/**
 * Validate configuration key
 */
export function isValidConfigKey(key: string): key is keyof ValidatedAppConfig {
  return key in createDefaultConfig();
}

/**
 * Get configuration value type
 */
export function getConfigValueType(key: keyof ValidatedAppConfig): string {
  const defaultConfig = createDefaultConfig();
  return typeof defaultConfig[key];
}
