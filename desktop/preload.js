// Exposes exactly one capability to the page: receiving files passed on the command line.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exactDiffHost', {
  onOpenFiles(callback) {
    ipcRenderer.on('open-files', (_event, files) => callback(files));
  }
});
