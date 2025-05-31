// dialog-preload.js
const { contextBridge, ipcRenderer } = require('electron');

let responseChannel = null; // Store the unique response channel

contextBridge.exposeInMainWorld(
    'dialogApi',
    {
        receive: (channel, func) => {
            const validChannels = ['dialog-init'];
            if (validChannels.includes(channel)) {
                // When dialog initializes, store the unique response channel
                ipcRenderer.on(channel, (event, options) => {
                    if (options && options.responseChannel) {
                        responseChannel = options.responseChannel;
                    }
                    func(options); // Pass all options to the renderer
                });
            }
        },
        submit: (result) => {
            if (responseChannel) {
                ipcRenderer.send(responseChannel, result);
            } else {
                console.error("Dialog response channel not set!");
            }
        },
        cancel: () => {
            if (responseChannel) {
                ipcRenderer.send(responseChannel, null); // Send null for cancellation
            } else {
                console.error("Dialog response channel not set!");
            }
        }
    }
);