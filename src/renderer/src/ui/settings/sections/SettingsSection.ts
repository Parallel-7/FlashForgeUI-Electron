/**
 * @fileoverview Base contract for modular settings sections in the renderer.
 *
 * Each section encapsulates one logical area of the settings dialog (tabs,
 * auto-update, Spoolman integration, etc.) and exposes lifecycle hooks so the
 * root renderer can initialize and dispose them in a predictable order.
 */

// src/ui/settings/sections/SettingsSection.ts

export interface SettingsSection {
  initialize(): void | Promise<void>;
  dispose(): void;
}
