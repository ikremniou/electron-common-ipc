const electronCommonIpcPreloadModule = require('electron-common-ipc/lib/index-preload');
electronCommonIpcPreloadModule.PreloadElectronCommonIpc();

const electronCommonIpcModule = require('electron-common-ipc');
console.log(`IsElectronCommonIpcAvailable=${electronCommonIpcModule.IsElectronCommonIpcAvailable()}`);

const electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;

