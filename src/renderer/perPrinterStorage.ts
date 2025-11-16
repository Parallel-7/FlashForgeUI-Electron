/**
 * @fileoverview Helper utilities for per-printer layout and shortcut persistence.
 */

import { layoutPersistence } from '../ui/gridstack/LayoutPersistence';
import { shortcutConfigManager } from '../ui/shortcuts/ShortcutConfigManager';
import type { LayoutConfig } from '../ui/gridstack/types';
import type { ShortcutButtonConfig } from '../ui/shortcuts/types';

const toStorageKey = (serial?: string | null): string | undefined => serial ?? undefined;

export const loadLayoutForSerial = (serial?: string | null): LayoutConfig =>
  layoutPersistence.load(toStorageKey(serial));

export const saveLayoutForSerial = (
  layout: LayoutConfig,
  serial?: string | null,
  immediate = false
): void => {
  layoutPersistence.save(layout, toStorageKey(serial), immediate);
};

export const loadShortcutsForSerial = (serial?: string | null): ShortcutButtonConfig =>
  shortcutConfigManager.load(serial);

export const saveShortcutsForSerial = (
  config: ShortcutButtonConfig,
  serial?: string | null
): void => {
  shortcutConfigManager.save(config, serial);
};

export const getPinnedComponentIdsForSerial = (serial?: string | null): string[] =>
  shortcutConfigManager.getPinnedComponentIds(serial);

