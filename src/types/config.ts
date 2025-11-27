/**
 * @fileoverview Application configuration type definitions with legacy format compatibility
 *
 * Defines the complete application configuration schema with exact property name matching
 * to the legacy JavaScript implementation for seamless config migration. Includes type-safe
 * defaults, validation functions, sanitization helpers, and change event tracking.
 *
 * Key Features:
 * - AppConfig interface with readonly properties for immutability
 * - MutableAppConfig for internal modification scenarios
 * - DEFAULT_CONFIG with type-safe constant values
 * - Configuration validation with isValidConfig type guard
 * - Sanitization function for safe config loading
 * - ConfigUpdateEvent for change tracking and listeners
 * - Port number validation (1-65535 range)
 *
 * Configuration Categories:
 * - Notifications: AlertWhenComplete, AlertWhenCooled, AudioAlerts, VisualAlerts
 * - UI Behavior: AlwaysOnTop, RoundedUI, DebugMode
 * - Camera: CustomCamera, CustomCameraUrl, CameraProxyPort
 * - WebUI: WebUIEnabled, WebUIPort, WebUIPassword
 * - Integrations: DiscordSync, Spoolman
 * - Themes: DesktopTheme, WebUITheme
 * - Advanced: ForceLegacyAPI, CustomLeds
 * - Auto-Update: CheckForUpdatesOnLaunch, UpdateChannel, AutoDownloadUpdates
 *
 * @module types/config
 */

/**
 * Theme color configuration
 * Defines the color palette for the application UI
 */
export interface ThemeColors {
  primary: string;    // Main accent colour (used for buttons, highlights)
  secondary: string;  // Secondary accent colour or gradient end
  background: string; // Base background for content (not the window itself)
  surface: string;    // Card/panel background inside windows
  text: string;       // Primary text colour
}

/**
 * Defines a theme profile, which includes a name and a set of colors.
 * System profiles are built-in and cannot be modified by the user.
 */
export interface ThemeProfile {
  name: string;
  colors: ThemeColors;
  isSystem: boolean;
}

/**
 * Theme profile operation payload types for IPC and API requests
 */
export interface ThemeProfileAddData {
  name: string;
  colors: ThemeColors;
}

export interface ThemeProfileUpdateData {
  originalName: string;
  updatedProfile: {
    name: string;
    colors: ThemeColors;
  };
}

export interface ThemeProfileDeleteData {
  name: string;
}

export type ThemeProfileOperationPayload =
  | { operation: 'add'; data: ThemeProfileAddData }
  | { operation: 'update'; data: ThemeProfileUpdateData }
  | { operation: 'delete'; data: ThemeProfileDeleteData };

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
  readonly WebUIPasswordRequired: boolean;
  readonly CameraProxyPort: number;
  readonly RoundedUI: boolean;
  readonly CheckForUpdatesOnLaunch: boolean;
  readonly UpdateChannel: 'stable' | 'alpha';
  readonly AutoDownloadUpdates: boolean;
  readonly RtspFrameRate: number;        // Per-printer, not saved to config.json
  readonly RtspQuality: number;          // Per-printer, not saved to config.json
  readonly SpoolmanEnabled: boolean;
  readonly SpoolmanServerUrl: string;
  readonly SpoolmanUpdateMode: 'length' | 'weight';
  readonly DesktopTheme: ThemeColors;
  readonly WebUITheme: ThemeColors;
  readonly desktopThemeProfiles: readonly ThemeProfile[];
  readonly webUIThemeProfiles: readonly ThemeProfile[];
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
  WebUIPasswordRequired: boolean;
  CameraProxyPort: number;
  RoundedUI: boolean;
  CheckForUpdatesOnLaunch: boolean;
  UpdateChannel: 'stable' | 'alpha';
  AutoDownloadUpdates: boolean;
  RtspFrameRate: number;
  RtspQuality: number;
  SpoolmanEnabled: boolean;
  SpoolmanServerUrl: string;
  SpoolmanUpdateMode: 'length' | 'weight';
  DesktopTheme: ThemeColors;
  WebUITheme: ThemeColors;
  desktopThemeProfiles: readonly ThemeProfile[];
  webUIThemeProfiles: readonly ThemeProfile[];
}

/**
 * Default theme colors - dark theme matching current UI
 */
export const DEFAULT_THEME: ThemeColors = {
  primary: '#4285f4',     // accent blue
  secondary: '#357abd',   // gradient end
  background: '#121212',  // dark base for content
  surface: '#1e1e1e',     // card background
  text: '#e0e0e0',        // light text
};

/**
 * Built-in system theme profiles.
 */
export const SYSTEM_THEME_PROFILES: readonly ThemeProfile[] = [
  {
    name: 'Fluidd',
    isSystem: true,
    colors: {
      primary: '#2196F3',
      secondary: '#1976D2',
      background: '#1a202c',
      surface: '#2d3748',
      text: '#e2e8f0',
    },
  },
  {
    name: 'Mainsail',
    isSystem: true,
    colors: {
      primary: '#F44336',
      secondary: '#D32F2F',
      background: '#212121',
      surface: '#333333',
      text: '#FFFFFF',
    },
  },
  {
    name: 'Solarized Dark',
    isSystem: true,
    colors: {
      primary: '#268bd2',
      secondary: '#cb4b16',
      background: '#002b36',
      surface: '#073642',
      text: '#839496',
    },
  },
  {
    name: 'Monokai',
    isSystem: true,
    colors: {
      primary: '#F92672',
      secondary: '#A6E22E',
      background: '#272822',
      surface: '#3E3D32',
      text: '#F8F8F2',
    },
  },
  {
    name: 'Aurora Light',
    isSystem: true,
    colors: {
      primary: '#2962FF',
      secondary: '#5C79FF',
      background: '#F5F7FB',
      surface: '#FFFFFF',
      text: '#1E2433',
    },
  },
  {
    name: 'Glacial Prism',
    isSystem: true,
    colors: {
      primary: '#0B8BD9',
      secondary: '#4BC3FF',
      background: '#F7FBFF',
      surface: '#FFFFFF',
      text: '#0F1B2B',
    },
  },
  {
    name: 'Sandstone Dawn',
    isSystem: true,
    colors: {
      primary: '#C25C35',
      secondary: '#E48B4A',
      background: '#FDF7F1',
      surface: '#FFFDF9',
      text: '#2C1F18',
    },
  },
  {
    name: 'Sage Studio',
    isSystem: true,
    colors: {
      primary: '#4B9C7C',
      secondary: '#7AC6A2',
      background: '#F4F8F5',
      surface: '#FEFFFD',
      text: '#1F2A24',
    },
  },
];

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
  WebUIPasswordRequired: true,
  CameraProxyPort: 8181,
  RoundedUI: false,
  CheckForUpdatesOnLaunch: true,
  UpdateChannel: 'stable',
  AutoDownloadUpdates: false,
  RtspFrameRate: 30,           // Default 30 FPS
  RtspQuality: 3,              // Default quality 3
  SpoolmanEnabled: false,
  SpoolmanServerUrl: '',
  SpoolmanUpdateMode: 'weight', // Default to weight-based updates
  DesktopTheme: DEFAULT_THEME,
  WebUITheme: DEFAULT_THEME,
  desktopThemeProfiles: [...SYSTEM_THEME_PROFILES],
  webUIThemeProfiles: [...SYSTEM_THEME_PROFILES],
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
      // Bypass for theme profiles since they are arrays of objects
      if (key === 'desktopThemeProfiles' || key === 'webUIThemeProfiles') {
        continue;
      }
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
 * Validates that a value is a valid 6-digit hex color code
 */
function isValidHexColour(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6})$/.test(value);
}

/**
 * Sanitizes a theme object, ensuring all colors are valid hex codes
 * Falls back to default theme values for invalid colors
 */
export function sanitizeTheme(theme: Partial<ThemeColors> | undefined): ThemeColors {
  const result: ThemeColors = { ...DEFAULT_THEME };
  if (!theme) return result;

  if (isValidHexColour(theme.primary)) result.primary = theme.primary;
  if (isValidHexColour(theme.secondary)) result.secondary = theme.secondary;
  if (isValidHexColour(theme.background)) result.background = theme.background;
  if (isValidHexColour(theme.surface)) result.surface = theme.surface;
  if (isValidHexColour(theme.text)) result.text = theme.text;

  return result;
}

/**
 * Sanitizes a theme profile, ensuring it has a valid structure.
 */
function sanitizeThemeProfile(profile: Partial<ThemeProfile>): ThemeProfile {
  return {
    name: typeof profile.name === 'string' ? profile.name : 'Untitled',
    colors: sanitizeTheme(profile.colors),
    isSystem: typeof profile.isSystem === 'boolean' ? profile.isSystem : false,
  };
}

/**
 * Ensures the theme profile list contains all built-in system themes while preserving custom entries.
 * System profiles are always replaced with the canonical definitions so palette updates propagate.
 */
function mergeSystemThemeProfiles(profiles: readonly ThemeProfile[]): ThemeProfile[] {
  const customProfiles = profiles.filter(profile => !profile.isSystem).map(profile => ({
    ...profile,
    colors: { ...profile.colors },
    isSystem: false,
  }));

  const systemProfiles = SYSTEM_THEME_PROFILES.map(profile => ({
    ...profile,
    colors: { ...profile.colors },
    isSystem: true,
  }));

  return [...systemProfiles, ...customProfiles];
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
        } else if (expectedType === 'string') {
          if (key === 'UpdateChannel') {
            const channel = value as string;
            if (channel === 'stable' || channel === 'alpha') {
              assignConfigValue(sanitized, key, channel);
            }
          } else if (key === 'SpoolmanUpdateMode') {
            const mode = value as string;
            if (mode === 'length' || mode === 'weight') {
              assignConfigValue(sanitized, key, mode);
            }
          } else {
            assignConfigValue(sanitized, key, value as MutableAppConfig[typeof key]);
          }
        } else {
          assignConfigValue(sanitized, key, value as MutableAppConfig[typeof key]);
        }
      }
    }
  }

  // Sanitize theme objects separately
  if (config.DesktopTheme) {
    sanitized.DesktopTheme = sanitizeTheme(config.DesktopTheme);
  }
  if (config.WebUITheme) {
    sanitized.WebUITheme = sanitizeTheme(config.WebUITheme);
  }

  // Sanitize theme profiles
  if (Array.isArray(config.desktopThemeProfiles)) {
    sanitized.desktopThemeProfiles = config.desktopThemeProfiles.map(sanitizeThemeProfile);
  }
  if (Array.isArray(config.webUIThemeProfiles)) {
    sanitized.webUIThemeProfiles = config.webUIThemeProfiles.map(sanitizeThemeProfile);
  }

  sanitized.desktopThemeProfiles = mergeSystemThemeProfiles(sanitized.desktopThemeProfiles);
  sanitized.webUIThemeProfiles = mergeSystemThemeProfiles(sanitized.webUIThemeProfiles);

  return sanitized;
}
