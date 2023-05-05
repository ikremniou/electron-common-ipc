import { GlobalContainer, IpcBusProcessType } from '@electron-common-ipc/universal';

import { newIpcBusClient } from './IpcBusClientRenderer-factory';
import { ElectronCommonIpcNamespace, isIpcAvailable } from './IpcBusWindowNamespace';
import { requireElectron } from '../utils';

import type { IpcWindow } from './IpcBusConnectorRenderer';
import type { IpcBusClient } from '@electron-common-ipc/universal';

const trace = false; // true;
export function createIpcBusClient(window: Window, ipcWindow: IpcWindow): IpcBusClient {
    trace && console.log(`${ElectronCommonIpcNamespace}.CreateIpcBusClient`);
    const ipcBusClient = newIpcBusClient(IpcBusProcessType.Renderer, window.self === window.top, ipcWindow);
    return ipcBusClient;
}

function createGlobals(windowLocal: Window, ipcWindow: IpcWindow) {
    return {
        CreateIpcBusClient: () => createIpcBusClient(windowLocal, ipcWindow),
    };
}

// work in progress on the context isolation
function exposeProxyClient(window: Window, ipcWindow: IpcWindow) {
    const client = createIpcBusClient(window, ipcWindow);

    return {
        CreateIpcBusClient: () => client,
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
        if (ipcRenderer) {
            const windowLocal = window;
            if (contextIsolation) {
                try {
                    electron.contextBridge.exposeInMainWorld(
                        ElectronCommonIpcNamespace,
                        exposeProxyClient(windowLocal, ipcRenderer)
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
    return isIpcAvailable();
}

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process
export function preloadElectronCommonIpc(contextIsolation?: boolean): boolean {
    return _preloadElectronCommonIpc(contextIsolation);
}
