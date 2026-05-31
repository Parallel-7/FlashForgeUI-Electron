/**
 * @fileoverview Shared type definitions for shortcut configuration dialog IPC.
 *
 * Captures the payloads exchanged between the shortcut configuration renderer,
 * preload script, and main process. Centralizing these interfaces keeps the
 * renderer and preload layers in sync and avoids duplicating structures for
 * shortcut slots, available component metadata, initialization payloads, and
 * save responses.
 */

/**
 * Slot configuration for the shortcut buttons dialog.
 */
export interface ShortcutButtonConfig {
  version: number;
  slots: {
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
  };
  lastModified: string;
}

/**
 * Component metadata surfaced to the shortcut configuration dialog.
 */
export interface ShortcutComponentInfo {
  id: string;
  name: string;
  icon: string;
  isPinned: boolean;
  category: string;
}

/**
 * Initialization payload delivered when the dialog opens.
 */
export interface ShortcutDialogInitData {
  responseChannel: string;
}

/**
 * Response payload returned after attempting to save the configuration.
 */
export interface ShortcutSaveConfigResult {
  success: boolean;
  error?: string;
}
