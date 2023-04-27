import { bootstrapEchoClient } from '../echo-client';

import type { IpcBusClient, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/web-socket-browser';
import type { ipcRenderer } from 'electron';

declare global {
    interface Window {
        e2eIpc: {
            port: number;
            shouldLog: boolean;
            electronProcess: NodeJS.Process;
            rendererSend: typeof ipcRenderer.send;
            rendererOn: typeof ipcRenderer.on;
        };
    }
}

export function bootstrap(
    createBusClient: () => IpcBusClient,
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService,
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy
) {
    const process = window.e2eIpc.electronProcess;
    const clientId = String(process.pid);
    const shouldLog = window.e2eIpc.shouldLog;
    const clientPort = window.e2eIpc.port;
    const sendBack = (message: unknown) => {
        window.e2eIpc.rendererSend('ack', message);
    };
    const onMessage = (handler: Function) => {
        window.e2eIpc.rendererOn('message', (_event, ...args: any[]) => {
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
