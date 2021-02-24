//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

const electronCommonIPC = require('electron-common-ipc');
if (electronCommonIPC.PreloadElectronCommonIPC()) {
  // electronCommonIPC.ActivateIpcBusTrace(true);
}

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.PerfTests = PerfTests;

const ProcessConnector = require('./ProcessConnector.js');
window.ProcessConnector = ProcessConnector;


