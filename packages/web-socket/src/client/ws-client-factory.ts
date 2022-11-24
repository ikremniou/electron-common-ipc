import {
    IpcBusTransportMulti,
    IpcBusClientImpl,
    GlobalContainer,
    IpcBusProcessType,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { customAlphabet } from 'nanoid';

import { WsConnector } from './ws-connector';

import type { IpcBusClient } from '@electron-common-ipc/universal';
import type { IpcBusTransport } from '@electron-common-ipc/universal/lib/client/bus-transport';

const TransportSymbolName = 'WsTransport';
export function createWebSocketClient(): IpcBusClient {
    const uuidProvider = customAlphabet(
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&(){}[]<>~',
        10
    );
    const emitter = new EventEmitter();
    const iocContainer = new GlobalContainer();

    let realTransport: IpcBusTransport = iocContainer.getSingleton(TransportSymbolName);
    if (!realTransport) {
        const connector = new WsConnector(uuidProvider, IpcBusProcessType.Node);
        realTransport = new IpcBusTransportMulti(connector, uuidProvider);
        iocContainer.registerSingleton(TransportSymbolName, realTransport);
    }

    return new IpcBusClientImpl(emitter, realTransport);
}
