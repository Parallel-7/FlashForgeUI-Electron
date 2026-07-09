/**
 * @fileoverview Shared type definitions for centralized per-printer SSH settings.
 *
 * SSH credentials are stored once per printer (keyed by serial number) and
 * consumed by every SSH-based feature: the file manager, the calibration
 * assistant, and the WebUI calibration routes. Defaults match the FlashForge
 * easy-SSH provisioning script (root / flashforge on port 22), so features
 * work out of the box; advanced users can override them in Settings -> SSH.
 *
 * Key exports:
 * - SSH_DEFAULTS: default credentials provisioned by flashforge-easyssh
 * - SSHSettings / SSHSettingsUpdate: resolved settings + settings-tab payloads
 */

/** Default SSH credentials provisioned by the flashforge-easyssh script. */
export const SSH_DEFAULTS = {
  username: 'root',
  password: 'flashforge',
  port: 22,
} as const;

/** Resolved SSH settings for a printer (defaults applied). */
export interface SSHSettings {
  readonly username: string;
  readonly password: string;
  readonly port: number;
  /** Optional path to an SSH private key file (overrides password auth). */
  readonly keyPath?: string;
  /** Whether any value differs from the easy-SSH defaults. */
  readonly isCustom: boolean;
}

/** Partial update from the settings UI. Empty strings mean "use default". */
export interface SSHSettingsUpdate {
  readonly username?: string;
  readonly password?: string;
  readonly port?: number;
  readonly keyPath?: string;
}

/** IPC response for 'ssh-settings:get' (null when no printer is connected). */
export interface SSHSettingsResponse {
  readonly settings: SSHSettings | null;
  readonly printerName?: string;
  readonly error?: string;
}
