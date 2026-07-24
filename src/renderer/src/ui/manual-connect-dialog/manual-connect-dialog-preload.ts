/**
 * @fileoverview Preload script for the manual printer-connection dialog.
 *
 * Provides the secure bridge for the multi-field manual connect form (IP address,
 * printer type, serial number, check code). Mirrors the input-dialog preload's
 * unique-response-channel pattern so several dialogs can be open without their
 * results crossing over.
 *
 * Key exports:
 * - ManualConnectDialogAPI: secure API for dialog init and result submission
 * - ManualConnectDialogInitOptions: configuration received from the main process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ManualConnectResult } from '@shared/types/manual-connect.js';

// Response channel for this dialog instance, supplied by the main process on init
let responseChannel: string | null = null;

// Valid channels for security
const validReceiveChannels = ['manual-connect:init', 'theme-changed'];

/** Initialization payload sent by the main process. */
export interface ManualConnectDialogInitOptions {
  title?: string;
  message?: string;
  defaultIpAddress?: string;
  responseChannel: string;
}

/** IPC surface exposed to the dialog renderer. */
export interface ManualConnectDialogAPI {
  receive: (channel: string, func: (options: unknown) => void) => void;
  submit: (result: ManualConnectResult) => Promise<void>;
  cancel: () => Promise<void>;
}

const invokeResponse = async (payload: ManualConnectResult | null): Promise<void> => {
  if (!responseChannel) {
    const error = new Error('Manual connect dialog response channel not set!');
    console.error(error.message);
    throw error;
  }

  try {
    await ipcRenderer.invoke(responseChannel, payload);
  } catch (error) {
    console.error('Failed to send manual connect dialog result:', error);
    throw error;
  }
};

const manualConnectDialogAPI: ManualConnectDialogAPI = {
  receive: (channel: string, func: (options: unknown) => void): void => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, options: ManualConnectDialogInitOptions) => {
        if (options?.responseChannel) {
          responseChannel = options.responseChannel;
        }
        func(options);
      });
    }
  },

  submit: (result: ManualConnectResult): Promise<void> => invokeResponse(result),

  cancel: (): Promise<void> => invokeResponse(null),
};

contextBridge.exposeInMainWorld('api', {
  dialog: {
    manualConnect: manualConnectDialogAPI,
  },
});
