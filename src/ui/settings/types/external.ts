/**
 * @fileoverview Shared API interfaces for the settings renderer sections.
 */

// src/ui/settings/types/external.ts

import type {
  AppConfig,
  ThemeColors,
  ThemeProfileAddData,
  ThemeProfileUpdateData,
  ThemeProfileDeleteData,
} from '../../../types/config.js';

export type ThemeProfileOperationData =
  | ThemeProfileAddData
  | ThemeProfileUpdateData
  | ThemeProfileDeleteData;

export interface ISettingsAPI {
  requestConfig: () => Promise<AppConfig>;
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>;
  saveDesktopTheme?: (theme: ThemeColors) => Promise<boolean>;
  closeWindow: () => void;
  send?: (channel: string, data?: unknown) => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
  receiveConfig: (callback: (config: AppConfig) => void) => void;
  onConfigUpdated: (callback: (config: AppConfig) => void) => void;
  removeListeners: () => void;
  performThemeProfileOperation: (uiType: 'desktop' | 'web', operation: 'add' | 'update' | 'delete', data: ThemeProfileOperationData) => void;
  testSpoolmanConnection: (url: string) => Promise<{ connected: boolean; error?: string }>;
  testDiscordWebhook: (url: string) => Promise<{ success: boolean; error?: string }>;
  getRoundedUISupportInfo: () => Promise<RoundedUISupportInfo>;
}

export interface IPrinterSettingsAPI {
  get: () => Promise<unknown>;
  update: (settings: unknown) => Promise<boolean>;
  getPrinterName: () => Promise<string | null>;
}

export interface UpdateInfoSummary {
  readonly version?: string;
  readonly releaseNotes?: unknown;
}

export interface UpdateDownloadProgress {
  readonly percent?: number;
  readonly total?: number;
  readonly transferred?: number;
}

export interface UpdateStatusResponse {
  readonly state: string;
  readonly updateInfo: UpdateInfoSummary | null;
  readonly downloadProgress: UpdateDownloadProgress | null;
  readonly error: { readonly message: string } | null;
  readonly currentVersion: string;
  readonly supportsDownload: boolean;
}

export interface RoundedUISupportInfo {
  readonly supported: boolean;
  readonly reason: 'macos' | 'windows11' | null;
}

export interface IAutoUpdateAPI {
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<UpdateStatusResponse>;
  setUpdateChannel: (channel: 'stable' | 'alpha') => Promise<{ success: boolean }>;
}
