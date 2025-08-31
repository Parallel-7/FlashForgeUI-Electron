// src/types/config.ts

/**
 * Application configuration interface that exactly matches the legacy JS format.
 * Property names must remain consistent for user config migration compatibility.
 */
export interface AppConfig {
  readonly DiscordSync: boolean;
  readonly AlwaysOnTop: boolean;
  readonly AlertWhenComplete: boolean;
  readonly AlertWhenCooled: boolean;
  readonly AudioAlerts: boolean;
  readonly VisualAlerts: boolean;
  readonly DebugMode: boolean;
  readonly WebhookUrl: string;
  readonly CustomCamera: boolean;
  readonly CustomCameraUrl: string;
  readonly CustomLeds: boolean;
  readonly ForceLegacyAPI: boolean;
  readonly DiscordUpdateIntervalMinutes: number;
  readonly WebUIEnabled: boolean;
  readonly WebUIPort: number;
  readonly WebUIPassword: string;
  readonly CameraProxyPort: number;
  readonly RoundedUI: boolean;
}

/**
 * Mutable version of AppConfig for internal modifications
 */
export interface MutableAppConfig {
  DiscordSync: boolean;
  AlwaysOnTop: boolean;
  AlertWhenComplete: boolean;
  AlertWhenCooled: boolean;
  AudioAlerts: boolean;
  VisualAlerts: boolean;
  DebugMode: boolean;
  WebhookUrl: string;
  CustomCamera: boolean;
  CustomCameraUrl: string;
  CustomLeds: boolean;
  ForceLegacyAPI: boolean;
  DiscordUpdateIntervalMinutes: number;
  WebUIEnabled: boolean;
  WebUIPort: number;
  WebUIPassword: string;
  CameraProxyPort: number;
  RoundedUI: boolean;
}

/**
 * Default configuration values that match the legacy JS defaults
 */
export const DEFAULT_CONFIG: AppConfig = {
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
  WebUIEnabled: false,
  WebUIPort: 3000,
  WebUIPassword: 'changeme',
  CameraProxyPort: 8181,
  RoundedUI: false
} as const;

/**
 * Configuration update event data
 */
export interface ConfigUpdateEvent {
  readonly previous: Readonly<AppConfig>;
  readonly current: Readonly<AppConfig>;
  readonly changedKeys: ReadonlyArray<keyof AppConfig>;
}

/**
 * Type guard to validate config object structure
 */
export function isValidConfigKey(key: string): key is keyof AppConfig {
  return key in DEFAULT_CONFIG;
}

/**
 * Type guard to validate an entire config object
 */
export function isValidConfig(config: unknown): config is AppConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  const obj = config as Record<string, unknown>;
  
  // Check all required keys exist and have correct types
  for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
    if (!(key in obj)) {
      return false;
    }
    
    const value = obj[key];
    const expectedType = typeof defaultValue;
    
    if (typeof value !== expectedType) {
      return false;
    }
    
    // Additional validation for specific types
    if (expectedType === 'number' && (!Number.isFinite(value) || (value as number) < 0)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Type-safe assignment helper for configuration properties
 */
function assignConfigValue<K extends keyof MutableAppConfig>(
  config: MutableAppConfig,
  key: K,
  value: MutableAppConfig[K]
): void {
  config[key] = value;
}

/**
 * Sanitizes and ensures a config object contains only valid keys with correct types
 */
export function sanitizeConfig(config: Partial<AppConfig>): AppConfig {
  const sanitized: MutableAppConfig = { ...DEFAULT_CONFIG };
  
  for (const [key, value] of Object.entries(config)) {
    if (isValidConfigKey(key)) {
      const defaultValue = DEFAULT_CONFIG[key];
      const expectedType = typeof defaultValue;
      
      if (typeof value === expectedType) {
        if (expectedType === 'number') {
          // Ensure numbers are valid and within reasonable bounds
          const numValue = value as number;
          if (Number.isFinite(numValue) && numValue >= 0) {
            if (key === 'WebUIPort' || key === 'CameraProxyPort') {
              // Validate port numbers
              if (numValue >= 1 && numValue <= 65535) {
                assignConfigValue(sanitized, key, numValue);
              }
            } else {
              assignConfigValue(sanitized, key, numValue);
            }
          }
        } else {
          assignConfigValue(sanitized, key, value as MutableAppConfig[typeof key]);
        }
      }
    }
  }
  
  return sanitized;
}
