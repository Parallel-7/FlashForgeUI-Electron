// src/constants/IPCChannels.js - Centralized IPC channel definitions

/**
 * IPC channels that the renderer can send to the main process
 */
const SEND_CHANNELS = [
  'request-printer-data',
  'home-axes',
  'pause-print',
  'resume-print',
  'cancel-print',
  'clear-status',
  'led-on',
  'led-off',
  'bed-temp-off',
  'set-bed-temp',
  'extruder-temp-off',
  'set-extruder-temp',
  'external-filtration',
  'internal-filtration',
  'no-filtration',
  'toggle-preview',
  'upload-job-dialog',
  'show-recent-files',
  'show-local-files',
  'show-filament-dialog',
  'show-command-dialog',
  'show-send-cmds',
  'connect-button-clicked',
  'open-settings-window',
  'open-status-dialog',
  'window-minimize',
  'window-maximize',
  'window-close',
  'show-input-dialog',
  'close-job-picker',
  'job-selected',
  'request-thumbnail',
  'request-legacy-thumbnail'
];

/**
 * IPC channels that the renderer can receive from the main process
 */
const RECEIVE_CHANNELS = [
  'printer-data',
  'printer-connected',
  'printer-disconnected',
  'command-response',
  'log-message',
  'dialog-response',
  'job-list',
  'thumbnail-result',
  'legacy-thumbnail-result',
  'job-selection-result'
];

/**
 * Channels for cleanup and event management
 */
const CLEANUP_CHANNELS = [
  'printer-data',
  'printer-connected',
  'printer-disconnected',
  'command-response',
  'log-message',
  'dialog-response',
  'job-list',
  'thumbnail-result',
  'legacy-thumbnail-result',
  'job-selection-result'
];

module.exports = {
  SEND_CHANNELS,
  RECEIVE_CHANNELS,
  CLEANUP_CHANNELS
};
