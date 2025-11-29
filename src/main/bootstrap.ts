/**
 * @fileoverview Bootstrap module for FlashForgeUI Electron application.
 *
 * CRITICAL: This file must be imported FIRST in index.ts, before any other imports.
 *
 * Purpose:
 * Sets the Electron app name and user model ID before any singletons are instantiated.
 * This ensures that all services using app.getPath('userData') point to the correct
 * directory across all platforms and execution modes (normal UI and headless).
 *
 * Problem it solves:
 * - Singletons like ConfigManager and PrinterDetailsManager capture app.getPath('userData')
 *   during construction
 * - If app.setName() is called after these singletons are created, they will use the wrong
 *   directory (e.g., "Electron" instead of "FlashForgeUI")
 * - This caused headless mode on macOS/Linux to read from a different config directory
 *   than the main UI, resulting in missing per-printer settings (custom camera/LED config)
 *
 * Platform-specific userData paths:
 * - macOS: ~/Library/Application Support/FlashForgeUI/
 * - Linux: ~/.config/FlashForgeUI/
 * - Windows: %APPDATA%/FlashForgeUI/
 *
 * Without this bootstrap (default "Electron" name):
 * - macOS: ~/Library/Application Support/Electron/
 * - Linux: ~/.config/Electron/
 * - Windows: %APPDATA%/Electron/
 */

import { app } from 'electron';

// Set app name BEFORE any singletons are created
// This ensures ConfigManager, PrinterDetailsManager, and all other services
// use the correct userData directory path
app.setName('FlashForgeUI');

// Set AppUserModelId to match electron-builder appId for proper notification routing
// This works across all platforms (Windows uses it for Action Center, macOS for notification attribution)
app.setAppUserModelId('com.ghosttypes.flashforgeui');

console.log('[Bootstrap] App name set to "FlashForgeUI"');
console.log(`[Bootstrap] userData path: ${app.getPath('userData')}`);
