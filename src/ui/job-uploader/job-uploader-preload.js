// src/ui/job-uploader/job-uploader-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uploaderApi', {
    // Renderer -> Main
    browseFile: () => ipcRenderer.send('uploader:browse-file'),
    uploadJob: (payload) => ipcRenderer.send('uploader:upload-job', payload), // { filePath, startNow, autoLevel }
    cancelUpload: () => ipcRenderer.send('uploader:cancel'),

    // Main -> Renderer
    receiveFile: (func) => {
        ipcRenderer.on('uploader:file-selected', (event, filePath) => func(filePath));
    },
    receiveMetadata: (func) => {
        // Listen for result (could be success data or error object)
        ipcRenderer.on('uploader:metadata-result', (event, result) => func(result));
    },
    // Cleanup
    removeListeners: () => {
        ipcRenderer.removeAllListeners('uploader:file-selected');
        ipcRenderer.removeAllListeners('uploader:metadata-result');
        ipcRenderer.removeAllListeners('uploader:show-loading');
    }
});