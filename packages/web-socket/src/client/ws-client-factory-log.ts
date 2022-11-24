import {
    MessageStampImpl,
    IpcBusTransportMulti,
    IpcBusClientImpl,
    GlobalContainer,
    IpcBusLogConfigImpl,
    ConsoleLogger,
    IpcBusProcessType,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

import { WsConnector } from './ws-connector';

import type { IpcBusClient, Logger } from '@electron-common-ipc/universal';
import type { IpcBusTransport } from '@electron-common-ipc/universal/lib/client/bus-transport';

const TransportSymbolName = 'WsTransportLog';
export function createWebSocketClient(logger?: Logger): IpcBusClient {
    const uuidProvider = nanoid;
    const emitter = new EventEmitter();
    const iocContainer = new GlobalContainer();
    const logConfig = new IpcBusLogConfigImpl();
    const messageStamp = new MessageStampImpl(logConfig);
    const realLogger = logger ?? new ConsoleLogger();

    let realTransport: IpcBusTransport = iocContainer.getSingleton(TransportSymbolName);
    if (!realTransport) {
        const connector = new WsConnector(uuidProvider, IpcBusProcessType.Node);
        realTransport = new IpcBusTransportMulti(connector, uuidProvider, messageStamp, realLogger);
        iocContainer.registerSingleton(TransportSymbolName, realTransport);
    }

    return new IpcBusClientImpl(emitter, realTransport);
}
