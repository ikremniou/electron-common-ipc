import { bootstrapEchoClient } from '../echo-client';

import type { IpcBusClient, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/web-socket';

export function bootstrap(
    createBusClient: () => IpcBusClient,
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService,
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy
) {
    const clientId = String(process.pid);
    const clientPort = Number(process.env['PORT']);
    const shouldLog = Boolean(process.env['LOG']);
    const sendBack = (message: unknown) => {
        process.send(message);
    };
    const onMessage = (handler: (...args: any[]) => void) => {
        process.on('message', handler);
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
