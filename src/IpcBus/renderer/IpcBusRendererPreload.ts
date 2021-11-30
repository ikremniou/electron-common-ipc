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
export const ElectronCommonIpcNamespace = 'ElectronCommonIpc';

function CreateGlobals(windowLocal: any, ipcWindow: IpcWindow) {
    return {
        CreateIpcBusClient: () => {
            trace && console.log(`${ElectronCommonIpcNamespace}.CreateIpcBusClient`);
            const ipcBusClient = CreateIpcBusClientWindow('renderer', (windowLocal.self === windowLocal.top), ipcWindow);
            // This instance may be proxyfied and then loose property members
            return ipcBusClient;
        }
    }
}

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function PreloadElectronCommonIpcAutomatic(): boolean {
    return _PreloadElectronCommonIpc();
}

export function PreloadElectronCommonIpc(contextIsolation?: boolean): boolean {
    return _PreloadElectronCommonIpc(contextIsolation);
}

const ContextIsolationDefaultValue = false;

let _PreloadElectronCommonIpcDone = false;
function _PreloadElectronCommonIpc(contextIsolation?: boolean): boolean {
    // trace && console.log(`process.argv:${window.process?.argv}`);
    // trace && console.log(`process.env:${window.process?.env}`);
    // trace && console.log(`contextIsolation:${contextIsolation}`);
    if (contextIsolation == null) {
        contextIsolation = window.process?.argv?.includes('--context-isolation') ?? ContextIsolationDefaultValue;
    }
    if (!_PreloadElectronCommonIpcDone) {
        _PreloadElectronCommonIpcDone = true;
        if (electron && electron.ipcRenderer) {
            const ipcRenderer = electron.ipcRenderer;
            const windowLocal = window as any;
            if (contextIsolation) {
                try {
                    electron.contextBridge.exposeInMainWorld(ElectronCommonIpcNamespace, CreateGlobals(windowLocal, ipcRenderer));
                }
                catch (error) {
                    console.error(error);
                    contextIsolation = false;
                }
            }

            if (!contextIsolation) {
                windowLocal[ElectronCommonIpcNamespace] = CreateGlobals(windowLocal, ipcRenderer);
            }
        }
    }
    return IsElectronCommonIpcAvailable();
}

export function IsElectronCommonIpcAvailable(): boolean {
    try {
        const windowLocal = window as any;
        const electronCommonIpcSpace = windowLocal[ElectronCommonIpcNamespace];
        return (electronCommonIpcSpace != null);
    }
    catch (err) {
    }
    return false;
}


