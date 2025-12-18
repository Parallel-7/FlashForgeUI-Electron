/**
 * @fileoverview Connect choice dialog preload - Secure IPC bridge for the connect choice
 * dialog window. Exposes safe API for dialog interaction and result handling.
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface ConnectChoiceOption {
  action: 'enter-ip' | 'scan-network' | 'cancel';
}

export interface ConnectChoiceData {
  // Can be extended later for additional data
  timestamp?: string;
}

interface ResponseChannelData {
  responseChannel: string;
}

export interface ConnectChoiceAPI {
  onDialogInit: (callback: (data: ConnectChoiceData & { responseChannel: string }) => void) => void;
  sendChoice: (choice: ConnectChoiceOption) => Promise<void>;
  removeAllListeners: () => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

// Listener management
const listeners = new Map<string, (...args: unknown[]) => void>();

const connectChoiceAPI: ConnectChoiceAPI = {
  onDialogInit: (callback: (data: ConnectChoiceData & { responseChannel: string }) => void) => {
    const handler = (...args: unknown[]) => {
      const data = args[1] as ConnectChoiceData & { responseChannel: string };
      callback(data);
    };
    
    listeners.set('connect-choice:init', handler);
    ipcRenderer.on('connect-choice:init', handler);
  },

  sendChoice: async (choice: ConnectChoiceOption): Promise<void> => {
    try {
      // Get the response channel from main process
      const dialogData = await ipcRenderer.invoke('connect-choice:get-response-channel') as ResponseChannelData | null;
      
      if (dialogData?.responseChannel) {
        // Send choice through the unique response channel
        await ipcRenderer.invoke(dialogData.responseChannel, choice);
      } else {
        console.error('No response channel available');
        throw new Error('Response channel not available');
      }
    } catch (error) {
      console.error('Error sending connect choice:', error);
      throw error;
    }
  },

  removeAllListeners: (): void => {
    listeners.forEach((handler, channel) => {
      ipcRenderer.removeListener(channel, handler);
    });
    listeners.clear();
  },

  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
};

contextBridge.exposeInMainWorld('api', {
  dialog: {
    connectChoice: connectChoiceAPI
  }
});
