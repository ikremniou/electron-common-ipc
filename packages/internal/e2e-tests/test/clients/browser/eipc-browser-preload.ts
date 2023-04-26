import { ipcRenderer, contextBridge } from 'electron';
import { PreloadElectronCommonIpc } from 'electron-common-ipc/lib/index-preload';

const shouldLog = process.argv.find((arg) => arg.startsWith('--log'))?.split('=')[1] === 'true';
const isIsolated = process.argv.find((arg) => arg.startsWith('--e2e-isolate'))?.split('=')[1] === 'true';
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);

if (!isIsolated) {
    true && console.log(`ContextIsolation is "false". Setting Window object`);
    window.e2eIpc = {
        shouldLog,
        port: clientPort,
        ipcRenderer: ipcRenderer,
        electronProcess: process,
    };
} else {
    true && console.log('ContextIsolation is "true". Exposing api via ContextBridge');
    contextBridge.exposeInMainWorld('e2eIpc', {
        shouldLog,
        port: clientPort,
        ipcRenderer: ipcRenderer,
        electronProcess: process,
    });
}

PreloadElectronCommonIpc(isIsolated);
