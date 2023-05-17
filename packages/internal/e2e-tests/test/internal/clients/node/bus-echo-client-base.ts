import { bootstrapEchoHost } from '../echo-client';
import { isLogEnabled } from '../utils';

import type { IpcBusClient, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/web-socket';

export function bootstrap(
    createBusClient: () => IpcBusClient,
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService,
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy
) {
    const clientId = String(process.pid);
    const clientPort = Number(process.env['PORT']);
    const shouldLog = isLogEnabled();
    const sendBack = (message: unknown) => {
        process.send(message);
    };
    const onMessage = (handler: (...args: any[]) => void) => {
        process.on('message', handler);
    };

    bootstrapEchoHost({
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
