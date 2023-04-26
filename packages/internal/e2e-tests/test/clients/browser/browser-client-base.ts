import { bootstrapEchoClient } from '../echo-client';

import type { IpcBusClient, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/web-socket-browser';

declare global {
    interface Window {
        e2eIpc: {
            port: number;
            shouldLog: boolean;
            electronProcess: NodeJS.Process;
            ipcRenderer: Electron.IpcRenderer;
        };
    }
}

export function bootstrap(
    createBusClient: () => IpcBusClient,
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService,
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy
) {
    const process = window.e2eIpc.electronProcess;
    const ipcRenderer = window.e2eIpc.ipcRenderer;
    const clientId = String(process.pid);
    const shouldLog = window.e2eIpc.shouldLog;
    const clientPort = window.e2eIpc.port;
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
