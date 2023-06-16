const electronCommonIpcPreloadModule = require('electron-common-ipc/lib/index-preload');
electronCommonIpcPreloadModule.PreloadElectronCommonIpc();

const electron = require('electron');
window.ipcRenderer = electron.ipcRenderer;

