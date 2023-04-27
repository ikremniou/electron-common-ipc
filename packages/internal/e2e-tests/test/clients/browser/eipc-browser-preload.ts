import { ipcRenderer, contextBridge } from 'electron';
import { ActivateIpcBusTrace } from 'electron-common-ipc';
import { PreloadElectronCommonIpc } from 'electron-common-ipc/lib/index-preload';

const shouldLog = true; // process.argv.find((arg) => arg.startsWith('--log'))?.split('=')[1] === 'true';
const isIsolated = process.argv.find((arg) => arg.startsWith('--e2e-isolate'))?.split('=')[1] === 'true';
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);

if (!isIsolated) {
    shouldLog && console.log(`ContextIsolation is "false". Setting Window object`);
    window.e2eIpc = {
        shouldLog,
        port: clientPort,
        rendererOn: (channel, listener) => ipcRenderer.on(channel, listener),
        rendererSend: (channel, ...args) => ipcRenderer.send(channel, ...args),
        electronProcess: process,
    };
} else {
    shouldLog && console.log('ContextIsolation is "true". Exposing api via ContextBridge');
    contextBridge.exposeInMainWorld('e2eIpc', {
        shouldLog,
        port: clientPort,
        rendererOn: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.on(channel, listener),
        rendererSend: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
        electronProcess: process,
    });
}

ActivateIpcBusTrace(shouldLog);
PreloadElectronCommonIpc(isIsolated);
