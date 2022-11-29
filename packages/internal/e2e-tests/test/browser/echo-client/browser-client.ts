import { createIpcBusService, createWebSocketClient } from '@electron-common-ipc/web-socket-browser';

import { bootstrapEchoClient } from '../../utilities/client/echo-client';

declare global {
    interface Window {
        electronProcess: NodeJS.Process;
        ipcRenderer: Electron.IpcRenderer;
    }
}

const process = window.electronProcess;
const ipcRenderer = window.ipcRenderer;
const clientId = String(process.pid);
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);
const shouldLog = Boolean(process.argv.find((argv: string) => argv.startsWith('--log'))?.split('=')[1]);
const sendBack = (message: unknown) => {
    ipcRenderer.send('ack', message);
};
const onMessage = (handler: Function) => {
    ipcRenderer.on('message', (_event, ...args: any[]) => {
        handler(...args);
    });
};

bootstrapEchoClient({
    clientId,
    shouldLog,
    clientPort,
    onMessage,
    sendBack,
    createBusClient: createWebSocketClient,
    createIpcBusService,
});
