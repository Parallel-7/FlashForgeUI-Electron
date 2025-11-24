/**
 * @fileoverview Shared API interfaces for the settings renderer sections.
 */

// src/ui/settings/types/external.ts

import type { AppConfig } from '../../../types/config.js';

export interface ISettingsAPI {
  requestConfig: () => Promise<AppConfig>;
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>;
  closeWindow: () => void;
  receiveConfig: (callback: (config: AppConfig) => void) => void;
  removeListeners: () => void;
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
