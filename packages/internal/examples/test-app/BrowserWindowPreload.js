//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

const electronCommonIpcPreloadModule = require('electron-common-ipc-ik/lib/index-preload');
if (electronCommonIpcPreloadModule.PreloadElectronCommonIpc()) {
  // electronCommonIpc.ActivateIpcBusTrace(true);
}

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.PerfTests = PerfTests;

const ProcessConnector = require('./ProcessConnector.js');
window.ProcessConnector = ProcessConnector;


