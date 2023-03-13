import {
    createIpcBusService,
    createIpcBusServiceProxy,
    createWebSocketClient,
    createWebSocketClientThin,
    DefaultContainer,
    defaultUuidProvider,
} from '@electron-common-ipc/web-socket';
import { EventEmitter } from 'events';

import { bootstrapEchoClient } from '../echo-client';

import type { IpcType } from '../../compare/ipc-type';
import type { ClientHost, ToClientProcessMessage, ToHostProcessMessage } from '../echo-contract';
import type { IpcBusClient } from '@electron-common-ipc/web-socket';
import type { ChildProcess } from 'child_process';

export class LocalClientHost extends EventEmitter implements ClientHost {
    public client?: IpcBusClient;

    constructor() {
        super();
    }

    sendCommand(message: ToClientProcessMessage): void {
        setTimeout(() => {
            this.emit('to-message', message);
        });
    }

    waitForMessage(predicate: ToHostProcessMessage | ((mes: ToHostProcessMessage) => boolean)): Promise<void> {
        return new Promise((resolve) => {
            const messageCallback = (message: ToHostProcessMessage | string) => {
                if (typeof message === 'string' && predicate === message) {
                    this.off('from-message', messageCallback);
                    resolve();
                } else if ((predicate as Function)(message)) {
                    this.off('from-message', messageCallback);
                    resolve();
                }
            };
            this.on('from-message', messageCallback);
        });
    }

    close(): void {
        this.client.close();
        this.client = undefined;
        this.removeAllListeners();
    }
}

export function sendCommand(message: ToClientProcessMessage, child: ChildProcess): void {
    child.send(message);
}

export async function startClientHost(mode: IpcType, clientPort: number): Promise<ClientHost> {
    const clientId = String(process.pid);
    const shouldLog = Boolean(process.env.LOG);
    const clientHost = new LocalClientHost();
    const sendBack: (mes: ToHostProcessMessage) => void = (mes) => {
        clientHost.emit('from-message', mes);
    };
    const onMessage: (handler: (mes: ToClientProcessMessage) => void) => void = (handler) => {
        clientHost.on('to-message', handler);
    };

    switch (mode) {
        case 'ws':
            clientHost.client = await bootstrapEchoClient({
                clientId,
                shouldLog,
                clientPort,
                sendBack,
                onMessage,
                createBusClient: createWebSocketClient,
                createIpcBusService: (client, channel, instance) =>
                    createIpcBusService(client, channel, instance, EventEmitter.prototype),
                createIpcBusServiceProxy: (client, channel) =>
                    createIpcBusServiceProxy(client, channel, new EventEmitter()),
            });
            break;
        case 'wsi':
            clientHost.client = await bootstrapEchoClient({
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
                createIpcBusService: (client, channel, instance) =>
                    createIpcBusService(client, channel, instance, EventEmitter.prototype),
                createIpcBusServiceProxy: (client, channel) =>
                    createIpcBusServiceProxy(client, channel, new EventEmitter()),
            });
            break;
        default:
            break;
    }

    return clientHost;
}
