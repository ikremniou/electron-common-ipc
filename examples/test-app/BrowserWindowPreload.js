//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

const electronCommonIpc = require('electron-common-ipc');
if (electronCommonIpc.PreloadElectronCommonIpc()) {
  // electronCommonIpc.ActivateIpcBusTrace(true);
}

window.ipcRenderer = require('electron').ipcRenderer;

const PerfTests = require('./PerfTests.js');
window.PerfTests = PerfTests;

const ProcessConnector = require('./ProcessConnector.js');
window.ProcessConnector = ProcessConnector;


