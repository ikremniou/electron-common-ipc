import { bootstrapEchoClient } from '../echo-client';

import type { IpcBusClient, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/web-socket-browser';

declare global {
    interface Window {
        __electronProcess: NodeJS.Process;
        __ipcRenderer: Electron.IpcRenderer;
    }
}

export function bootstrap(
    createBusClient: () => IpcBusClient,
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService,
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy
) {
    const process = window.__electronProcess;
    const ipcRenderer = window.__ipcRenderer;
    const clientId = String(process.pid);
    const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);
    const shouldLog = process.argv.find((argv: string) => argv.startsWith('--log'))?.split('=')[1] === 'true';
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
        createBusClient,
        createIpcBusService,
        createIpcBusServiceProxy,
    });
}
