import { Create as CreateIpcBusClientWindow } from './IpcBusClientRenderer-factory';
import type { IpcWindow } from './IpcBusConnectorRenderer';

let electron: any;
try {
    // Will work in a preload or with nodeIntegration=true
    electron = require('electron');
}
catch (err) {
}

const trace = false; // true;
export const ElectronCommonIPCNamespace = 'ElectronCommonIPC';

function CreateGlobals(windowLocal: any, ipcWindow: IpcWindow) {
    return {
        CreateIpcBusClient: () => {
            trace && console.log(`${ElectronCommonIPCNamespace}.CreateIpcBusClient`);
            const ipcBusClient = CreateIpcBusClientWindow('renderer', (windowLocal.self === windowLocal.top), ipcWindow);
            // This instance may be proxyfied and then loose property members
            return ipcBusClient;
        }
    }
}

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function PreloadElectronCommonIPCAutomatic(): boolean {
    return _PreloadElectronCommonIPC();
}

export function PreloadElectronCommonIPC(contextIsolation?: boolean): boolean {
    return _PreloadElectronCommonIPC(contextIsolation);
}

const ContextIsolationDefaultValue = false;

let _PreloadElectronCommonIPCDone = false;
function _PreloadElectronCommonIPC(contextIsolation?: boolean): boolean {
    // trace && console.log(`process.argv:${window.process?.argv}`);
    // trace && console.log(`process.env:${window.process?.env}`);
    // trace && console.log(`contextIsolation:${contextIsolation}`);
    if (contextIsolation == null) {
        contextIsolation = window.process?.argv?.includes('--context-isolation') ?? ContextIsolationDefaultValue;
    }
    if (!_PreloadElectronCommonIPCDone) {
        _PreloadElectronCommonIPCDone = true;
        if (electron && electron.ipcRenderer) {
            const windowLocal = window as any;
            if (contextIsolation) {
                try {
                    electron.contextBridge.exposeInMainWorld(ElectronCommonIPCNamespace, CreateGlobals(windowLocal, electron.ipcRenderer));
                }
                catch (error) {
                    console.error(error);
                    contextIsolation = false;
                }
            }

            if (!contextIsolation) {
                windowLocal[ElectronCommonIPCNamespace] = CreateGlobals(windowLocal, electron.ipcRenderer);
            }
        }
    }
    return IsElectronCommonIPCAvailable();
}

export function IsElectronCommonIPCAvailable(): boolean {
    try {
        const windowLocal = window as any;
        const electronCommonIPCSpace = windowLocal[ElectronCommonIPCNamespace];
        return (electronCommonIPCSpace != null);
    }
    catch (err) {
    }
    return false;
}

// for backward
export const PreloadElectronCommonIpcCAutomatic = PreloadElectronCommonIPCAutomatic;
export const PreloadElectronCommonIpc = PreloadElectronCommonIPC;
export const IsElectronCommonIpcAvailable = IsElectronCommonIPCAvailable;
