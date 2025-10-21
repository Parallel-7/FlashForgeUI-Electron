/**
 * @fileoverview Camera IPC handler registration
 *
 * Provides registration function for camera-related IPC handlers to be included
 * in the central handler registration system. This ensures camera handlers are
 * available before any windows are created.
 */

import { cameraIPCHandler } from '../camera-ipc-handler';
import type { AppManagers } from './index';

/**
 * Register camera IPC handlers
 *
 * @param _managers - Application managers (not currently used by camera handlers but included for consistency)
 */
export function registerCameraHandlers(_managers: AppManagers): void {
  // Initialize the camera IPC handler singleton
  cameraIPCHandler.initialize();

  console.log('Camera IPC handlers registered');
}
