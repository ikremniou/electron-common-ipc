import {
    ConsoleLogger,
    GlobalContainer,
    IpcBusClientImpl,
    IpcBusLogConfigImpl,
    IpcBusProcessType,
    IpcBusTransportMulti,
    MessageStampImpl,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

import { WsBrowserConnector } from './ws-browser-connector';

import type { IpcBusTransport } from '@electron-common-ipc/universal';

const BrowserTransportToken = 'WsBrowserTransportToken';
export function createWebSocketClient() {
    const container = new GlobalContainer();
    const uuidProvider = () => nanoid();
    const logger = new ConsoleLogger();
    const logConfig = new IpcBusLogConfigImpl();
    const messageStamp = new MessageStampImpl(logConfig);

    let realTransport = container.getSingleton<IpcBusTransport>(BrowserTransportToken);
    if (!realTransport) {
        const connector = new WsBrowserConnector(uuidProvider, IpcBusProcessType.Browser, logger);
        realTransport = new IpcBusTransportMulti(connector, uuidProvider, messageStamp, logger);
        container.registerSingleton(BrowserTransportToken, realTransport);
    }

    return new IpcBusClientImpl(new EventEmitter(), realTransport);
}
