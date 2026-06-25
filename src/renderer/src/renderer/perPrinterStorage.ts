/**
 * @fileoverview Helper utilities for per-printer layout and shortcut persistence.
 */

import { migrateLayoutForToolChanger } from '../ui/gridstack/defaults.js';
import { layoutPersistence } from '../ui/gridstack/LayoutPersistence.js';
import type { LayoutConfig } from '../ui/gridstack/types.js';
import { shortcutConfigManager } from '../ui/shortcuts/ShortcutConfigManager.js';
import type { ShortcutButtonConfig } from '../ui/shortcuts/types.js';

const toStorageKey = (serial?: string | null): string | undefined => serial ?? undefined;

export const loadLayoutForSerial = (serial?: string | null): LayoutConfig =>
  layoutPersistence.load(toStorageKey(serial));

/**
 * Load a printer's layout and apply the one-time tool-changer migration. If the
 * migration changes anything (Creator 5 series, not yet migrated), the result is
 * persisted immediately so it runs exactly once and is preserved thereafter.
 *
 * @param serial Printer serial (storage key).
 * @param isToolChanger Whether the connected printer is a Creator 5 series.
 * @returns The (possibly migrated) layout.
 */
export const loadLayoutForSerialMigrated = (
  serial: string | null | undefined,
  isToolChanger: boolean
): LayoutConfig => {
  const layout = loadLayoutForSerial(serial);
  const migrated = migrateLayoutForToolChanger(layout, isToolChanger);
  if (migrated !== layout) {
    saveLayoutForSerial(migrated, serial, true);
  }
  return migrated;
};

export const saveLayoutForSerial = (layout: LayoutConfig, serial?: string | null, immediate = false): void => {
  layoutPersistence.save(layout, toStorageKey(serial), immediate);
};

export const loadShortcutsForSerial = (serial?: string | null): ShortcutButtonConfig =>
  shortcutConfigManager.load(serial);

export const saveShortcutsForSerial = (config: ShortcutButtonConfig, serial?: string | null): void => {
  shortcutConfigManager.save(config, serial);
};

export const getPinnedComponentIdsForSerial = (serial?: string | null): string[] =>
  shortcutConfigManager.getPinnedComponentIds(serial);
