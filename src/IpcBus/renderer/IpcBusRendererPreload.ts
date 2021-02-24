import { Create as CreateIpcBusClientWindow } from './IpcBusClientRenderer-factory';

// let useContextBridge = process.argv.includes('--context-isolation');
	// if (useContextBridge) {
	// 	try {
	// 		contextBridge.exposeInMainWorld('ElectronCommonIpc', globals);
	// 	} catch (error) {
	// 		console.error(error);

	// 		useContextBridge = false;
	// 	}
	// }

	// if (!useContextBridge) {
	// 	// @ts-ignore
	// 	window.ElectronCommonIpc = globals;
	// }

// const globals = {
//         CreateIpcBusClient: () => {
//             // Will work in a preload or with nodeIntegration=true
//             const electron = require('electron');
//             if (electron && electron.ipcRenderer) {
//                 const ipcBusClient = CreateIpcBusClientWindow('renderer', electron.ipcRenderer as any);
//                 return ipcBusClient;
//             }
//         }
// }

const trace = false; // true;

// This function could be called in advance in the preload file of the BrowserWindow
// Then ipcbus is supported in sandbox or nodeIntegration=false process

// By default this function is always trigerred in index-browser in order to offer an access to ipcBus

export function PreloadElectronCommonIpcAutomatic(): boolean {
    return _PreloadElectronCommonIpc('Implicit');
}

export function PreloadElectronCommonIpc(): boolean {
    return _PreloadElectronCommonIpc('Explicit');
}

function _PreloadElectronCommonIpc(context: string): boolean {
    const windowLocal = window as any;
    try {
        // Will work in a preload or with nodeIntegration=true
        const electron = require('electron');
        if (electron && electron.ipcRenderer) {
            windowLocal.ElectronCommonIpc = windowLocal.ElectronCommonIpc || {};
            windowLocal.ElectronCommonIpc.Process = process || {};
            if (windowLocal.ElectronCommonIpc.CreateIpcBusClient == null) {
                trace && console.log(`inject - ${context} - ElectronCommonIpc.CreateIpcBusClient`);
                windowLocal.ElectronCommonIpc.CreateIpcBusClient = () => {
                    // try {
                    //     console.warn(`electron-common-ipc:process:${JSON.stringify(windowLocal.ElectronCommonIpc.Process)}`);
                    //     console.warn(`electron-common-ipc:process.isMainFrame:${JSON.stringify(windowLocal.ElectronCommonIpc.Process.isMainFrame)}`);
                    // }
                    // catch(err){};
                    // try {
                    //     console.warn(`electron-common-ipc:electron.webFrame:${JSON.stringify(electron.webFrame)}`);
                    // }
                    // catch(err){};
                    trace && console.log(`${context} - ElectronCommonIpc.CreateIpcBusClient`);
                    // 'ipcRenderer as any', ipcRenderer does not cover all EventListener interface !
                    const ipcBusClient = CreateIpcBusClientWindow('renderer', (windowLocal.self === windowLocal.top), electron.ipcRenderer as any);
                    return ipcBusClient;
                };
            }
        }
    }
    catch (_) {
    }
    return IsElectronCommonIpcAvailable();
}

export function IsElectronCommonIpcAvailable(): boolean {
    try {
        const windowLocal = window as any;
        return (windowLocal.ElectronCommonIpc && windowLocal.ElectronCommonIpc.CreateIpcBusClient) != null;
    }
    catch (_) {
    }
    return false;
}