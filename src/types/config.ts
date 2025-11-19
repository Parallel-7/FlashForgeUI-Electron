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
 * - Themes: DesktopTheme, WebUITheme, ThemeProfiles
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
 * Theme profile with metadata and colors
 * Supports both built-in and user-created custom themes
 */
export interface ThemeProfile {
  readonly id: string;         // Unique identifier (preset name or UUID for custom)
  readonly name: string;       // Display name shown to users
  readonly isBuiltIn: boolean; // True for system profiles, false for user-created
  readonly colors: ThemeColors;
}

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
  readonly ThemeProfiles: ReadonlyArray<ThemeProfile>;
  readonly SelectedDesktopProfileId: string;
  readonly SelectedWebUIProfileId: string;
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
  ThemeProfiles: ThemeProfile[];
  SelectedDesktopProfileId: string;
  SelectedWebUIProfileId: string;
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
 * Fluidd-inspired theme colors
 * Purple and blue tones matching the Fluidd 3D printer interface
 */
export const FLUIDD_THEME: ThemeColors = {
  primary: '#9c27b0',     // Fluidd purple
  secondary: '#673ab7',   // Deep purple accent
  background: '#0d0d0d',  // Very dark background
  surface: '#1a1a1a',     // Dark surface
  text: '#ececec',        // Light text
};

/**
 * Mainsail-inspired theme colors
 * Orange and red tones matching the Mainsail 3D printer interface
 */
export const MAINSAIL_THEME: ThemeColors = {
  primary: '#ff6f00',     // Mainsail orange
  secondary: '#d84315',   // Deep orange/red accent
  background: '#0d0d0d',  // Very dark background
  surface: '#1c1c1c',     // Dark surface
  text: '#f5f5f5',        // Light text
};

/**
 * Nord-inspired modern dark theme
 * Cool tones using the Nord color palette
 */
export const NORD_THEME: ThemeColors = {
  primary: '#88c0d0',     // Nord frost cyan
  secondary: '#81a1c1',   // Nord frost blue
  background: '#2e3440',  // Nord polar night darkest
  surface: '#3b4252',     // Nord polar night dark
  text: '#eceff4',        // Nord snow storm lightest
};

/**
 * Built-in theme profile IDs (constants to prevent typos)
 */
export const THEME_PROFILE_IDS = {
  DEFAULT: 'default',
  FLUIDD: 'fluidd',
  MAINSAIL: 'mainsail',
  NORD: 'nord',
} as const;

/**
 * Built-in theme profiles available to all users
 * These profiles cannot be deleted or modified
 */
export const BUILT_IN_THEME_PROFILES: ReadonlyArray<ThemeProfile> = [
  {
    id: THEME_PROFILE_IDS.DEFAULT,
    name: 'Default',
    isBuiltIn: true,
    colors: DEFAULT_THEME,
  },
  {
    id: THEME_PROFILE_IDS.FLUIDD,
    name: 'Fluidd',
    isBuiltIn: true,
    colors: FLUIDD_THEME,
  },
  {
    id: THEME_PROFILE_IDS.MAINSAIL,
    name: 'Mainsail',
    isBuiltIn: true,
    colors: MAINSAIL_THEME,
  },
  {
    id: THEME_PROFILE_IDS.NORD,
    name: 'Nord',
    isBuiltIn: true,
    colors: NORD_THEME,
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
  ThemeProfiles: BUILT_IN_THEME_PROFILES,
  SelectedDesktopProfileId: THEME_PROFILE_IDS.DEFAULT,
  SelectedWebUIProfileId: THEME_PROFILE_IDS.DEFAULT,
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
 * Sanitizes a theme profile, ensuring all required fields are valid
 */
function sanitizeThemeProfile(profile: Partial<ThemeProfile> | undefined): ThemeProfile | null {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const id = typeof profile.id === 'string' && profile.id.trim() ? profile.id.trim() : null;
  const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : null;
  const isBuiltIn = typeof profile.isBuiltIn === 'boolean' ? profile.isBuiltIn : false;

  if (!id || !name) {
    return null;
  }

  const colors = sanitizeTheme(profile.colors);

  return {
    id,
    name,
    isBuiltIn,
    colors,
  };
}

/**
 * Sanitizes an array of theme profiles
 * Ensures built-in profiles are always present and custom profiles are valid
 */
function sanitizeThemeProfiles(profiles: unknown): ThemeProfile[] {
  const result: ThemeProfile[] = [...BUILT_IN_THEME_PROFILES];

  if (!Array.isArray(profiles)) {
    return result;
  }

  const builtInIds = new Set(BUILT_IN_THEME_PROFILES.map(p => p.id));
  const customProfiles: ThemeProfile[] = [];

  for (const profile of profiles) {
    const sanitized = sanitizeThemeProfile(profile as Partial<ThemeProfile>);
    if (sanitized && !builtInIds.has(sanitized.id)) {
      customProfiles.push(sanitized);
    }
  }

  return [...result, ...customProfiles];
}

/**
 * Validates and sanitizes a profile ID
 * Returns the ID if valid, otherwise returns the default profile ID
 */
function sanitizeProfileId(id: unknown, profiles: ThemeProfile[]): string {
  if (typeof id !== 'string' || !id.trim()) {
    return THEME_PROFILE_IDS.DEFAULT;
  }

  const profileExists = profiles.some(p => p.id === id);
  return profileExists ? id : THEME_PROFILE_IDS.DEFAULT;
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

  // Sanitize theme profiles (always ensures built-in profiles are present)
  sanitized.ThemeProfiles = sanitizeThemeProfiles(config.ThemeProfiles);

  // Sanitize selected profile IDs (validate against available profiles)
  sanitized.SelectedDesktopProfileId = sanitizeProfileId(
    config.SelectedDesktopProfileId,
    sanitized.ThemeProfiles
  );
  sanitized.SelectedWebUIProfileId = sanitizeProfileId(
    config.SelectedWebUIProfileId,
    sanitized.ThemeProfiles
  );

  return sanitized;
}

/**
 * Profile Management Utilities
 */

/**
 * Generates a unique ID for a custom theme profile
 */
export function generateProfileId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Finds a theme profile by ID
 */
export function findProfileById(profiles: ReadonlyArray<ThemeProfile>, id: string): ThemeProfile | undefined {
  return profiles.find(p => p.id === id);
}

/**
 * Creates a new custom theme profile
 */
export function createCustomProfile(name: string, colors: ThemeColors): ThemeProfile {
  return {
    id: generateProfileId(),
    name: name.trim(),
    isBuiltIn: false,
    colors: sanitizeTheme(colors),
  };
}

/**
 * Updates an existing custom profile
 * Returns null if the profile is built-in or doesn't exist
 */
export function updateCustomProfile(
  profiles: ReadonlyArray<ThemeProfile>,
  profileId: string,
  updates: Partial<Pick<ThemeProfile, 'name' | 'colors'>>
): ThemeProfile[] | null {
  const profile = findProfileById(profiles, profileId);

  if (!profile || profile.isBuiltIn) {
    return null;
  }

  return profiles.map(p => {
    if (p.id === profileId) {
      return {
        ...p,
        name: updates.name !== undefined ? updates.name.trim() : p.name,
        colors: updates.colors !== undefined ? sanitizeTheme(updates.colors) : p.colors,
      };
    }
    return p;
  });
}

/**
 * Deletes a custom theme profile
 * Returns null if the profile is built-in or doesn't exist
 */
export function deleteCustomProfile(
  profiles: ReadonlyArray<ThemeProfile>,
  profileId: string
): ThemeProfile[] | null {
  const profile = findProfileById(profiles, profileId);

  if (!profile || profile.isBuiltIn) {
    return null;
  }

  return profiles.filter(p => p.id !== profileId);
}

/**
 * Adds a new custom profile to the list
 */
export function addCustomProfile(
  profiles: ReadonlyArray<ThemeProfile>,
  profile: ThemeProfile
): ThemeProfile[] {
  if (profile.isBuiltIn) {
    throw new Error('Cannot add built-in profiles');
  }

  const exists = findProfileById(profiles, profile.id);
  if (exists) {
    throw new Error(`Profile with ID ${profile.id} already exists`);
  }

  return [...profiles, profile];
}

