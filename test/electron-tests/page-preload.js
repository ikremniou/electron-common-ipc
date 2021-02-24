const electronCommonIPCModule = require('../..');
electronCommonIPCModule.PreloadElectronCommonIPC();

console.log(`IsElectronCommonIPCAvailable=${electronCommonIPCModule.IsElectronCommonIPCAvailable()}`);

const ipcRenderer = require('electron').ipcRenderer;
window.ipcRenderer = ipcRenderer;
