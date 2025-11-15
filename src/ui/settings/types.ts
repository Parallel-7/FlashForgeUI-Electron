/**
 * @fileoverview Shared types for the settings renderer.
 *
 * Provides cross-module typings for the mutable settings state that the renderer
 * uses while editing both global (config.json) and per-printer settings.
 */

// src/ui/settings/types.ts

export interface MutableSettings {
  global: Record<string, unknown>;
  perPrinter: Record<string, unknown>;
}
