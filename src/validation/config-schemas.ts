/**
 * Zod validation schemas for application configuration.
 * Ensures configuration data from files or IPC is valid and type-safe.
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
  CameraProxyPort: z.number().min(1).max(65535)
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
    CameraProxyPort: 8181
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
