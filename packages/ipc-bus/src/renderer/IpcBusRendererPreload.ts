import { GlobalContainer, IpcBusProcessType } from '@electron-common-ipc/universal';

import { createIpcBusClient as CreateIpcBusClientWindow } from './IpcBusClientRenderer-factory';
import { ElectronCommonIpcNamespace, isElectronCommonIpcAvailable } from './IpcBusWindowNamespace';
import { requireElectron } from '../utils';

import type { IpcWindow } from './IpcBusConnectorRenderer';
import type { IpcBusClient } from '@electron-common-ipc/universal';

const trace = false; // true;
export function createIpcBusClient(window: Window, ipcWindow: IpcWindow): IpcBusClient {
    trace && console.log(`${ElectronCommonIpcNamespace}.CreateIpcBusClient`);
    const ipcBusClient = CreateIpcBusClientWindow(IpcBusProcessType.Renderer, window.self === window.top, ipcWindow);
    // This instance may be proxyfied and then loose property members
    return ipcBusClient;
}

function createGlobals(windowLocal: Window, ipcWindow: IpcWindow) {
    return {
        CreateIpcBusClient: () => createIpcBusClient(windowLocal, ipcWindow),
    };
}

const ContextIsolationDefaultValue = false;
const gPreloadDoneSymbolName = '_PreloadElectronCommonIpc';
function _preloadElectronCommonIpc(contextIsolation?: boolean): boolean {
    // trace && console.log(`process.argv:${window.process?.argv}`);
    // trace && console.log(`process.env:${window.process?.env}`);
    // trace && console.log(`contextIsolation:${contextIsolation}`);
    if (contextIsolation === undefined) {
        contextIsolation = /* window.process?.argv?.includes('--context-isolation') ?? */ ContextIsolationDefaultValue;
    }

    const globalContainer = new GlobalContainer();
    const isPreloadDone = globalContainer.getSingleton<boolean>(gPreloadDoneSymbolName);
    if (!isPreloadDone) {
        globalContainer.registerSingleton(gPreloadDoneSymbolName, true);
        const electron = requireElectron();
        const ipcRenderer = electron?.ipcRenderer;
        // console.log(`ipcRenderer = ${JSON.stringify(ipcRenderer, null, 4)}`);
        if (ipcRenderer) {
            const windowLocal = window;
            if (contextIsolation) {
                try {
                    electron.contextBridge.exposeInMainWorld(
                        ElectronCommonIpcNamespace,
                        createGlobals(windowLocal, ipcRenderer)
                    );
                } catch (error) {
                    console.error(error);
                    contextIsolation = false;
                }
            }

            if (!contextIsolation) {
                windowLocal[ElectronCommonIpcNamespace] = createGlobals(windowLocal, ipcRenderer);
            }
        }
    }
    return isElectronCommonIpcAvailable();
}

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function preloadElectronCommonIpcAutomatic(): boolean {
    return _preloadElectronCommonIpc();
}

export function preloadElectronCommonIpc(contextIsolation?: boolean): boolean {
    return _preloadElectronCommonIpc(contextIsolation);
}
