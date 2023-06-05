import {
    createIpcBusService,
    createIpcBusServiceProxy,
    createWebSocketClient,
    createWebSocketClientThin,
    DefaultContainer,
    defaultUuidProvider,
} from '@electron-common-ipc/web-socket';
import { EventEmitter } from 'events';

import { bootstrapEchoHost } from '../echo-client';
import { isLogEnabled } from '../utils';

import type { IpcType } from '../../ipc-type';
import type { ClientHost, ToClientProcessMessage, ToMainProcessMessage } from '../echo-contract';
import type { ChildProcess } from 'child_process';

export class LocalClientHost extends EventEmitter implements ClientHost {
    public cleanUp?: CallableFunction;

    constructor() {
        super();
    }

    sendCommand(message: ToClientProcessMessage): void {
        setTimeout(() => {
            this.emit('to-message', message);
        });
    }

    waitForMessage(
        predicate: ToMainProcessMessage | ((mes: ToMainProcessMessage) => boolean)
    ): Promise<ToMainProcessMessage> {
        return new Promise((resolve) => {
            let isResolved = false;
            const messageCallback = (message: ToMainProcessMessage) => {
                if (isResolved) {
                    return;
                }

                if (typeof predicate === 'string') {
                    if (predicate === message || (typeof message === 'object' && message.type === predicate)) {
                        this.off('from-message', messageCallback);
                        resolve(message);
                        isResolved = true;
                    }
                } else if ((predicate as Function)(message)) {
                    this.off('from-message', messageCallback);
                    resolve(message);
                    isResolved = true;
                }
            };
            this.on('from-message', messageCallback);
        });
    }

    close(): void {
        this.cleanUp?.();
        this.cleanUp = undefined;
        this.removeAllListeners();
    }
}

export function sendCommand(message: ToClientProcessMessage, child: ChildProcess): void {
    child.send(message);
}

export async function startClientHost(mode: IpcType, clientPort: number): Promise<ClientHost> {
    const clientId = String(process.pid);
    const shouldLog = isLogEnabled();
    const clientHost = new LocalClientHost();
    const sendBack: (mes: ToMainProcessMessage) => void = (mes) => {
        clientHost.emit('from-message', mes);
    };
    const onMessage: (handler: (mes: ToClientProcessMessage) => void) => void = (handler) => {
        clientHost.on('to-message', handler);
    };

    switch (mode) {
        case 'ws':
            clientHost.cleanUp = await bootstrapEchoHost({
                clientId,
                shouldLog,
                clientPort,
                sendBack,
                onMessage,
                createBusClient: createWebSocketClient,
                createIpcBusService: (client, channel, instance, options) =>
                    createIpcBusService(client, channel, instance, EventEmitter.prototype, undefined, options),
                createIpcBusServiceProxy: (client, channel) =>
                    createIpcBusServiceProxy(client, channel, new EventEmitter()),
            });
            break;
        case 'wsi':
            clientHost.cleanUp = await bootstrapEchoHost({
                clientId,
                shouldLog,
                clientPort,
                sendBack,
                onMessage,
                createBusClient: () =>
                    createWebSocketClientThin({
                        json: JSON,
                        emitter: new EventEmitter(),
                        uuidProvider: defaultUuidProvider,
                        container: new DefaultContainer(),
                    }),
                createIpcBusService: (client, channel, instance, options) =>
                    createIpcBusService(client, channel, instance, EventEmitter.prototype, undefined, options),
                createIpcBusServiceProxy: (client, channel) =>
                    createIpcBusServiceProxy(client, channel, new EventEmitter()),
            });
            break;
        default:
            break;
    }

    return clientHost;
}
