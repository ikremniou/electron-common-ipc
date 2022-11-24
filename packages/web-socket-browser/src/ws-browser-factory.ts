import {
    GlobalContainer,
    IpcBusClientImpl,
    IpcBusProcessType,
    IpcBusTransportMulti,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

import { WsBrowserConnector } from './ws-browser-connector';

import type { IpcBusTransport } from '@electron-common-ipc/universal';

const BrowserTransportToken = 'WsBrowserTransportToken';
export function createWebSocketClient() {
    const container = new GlobalContainer();
    const uuidProvider = () => nanoid();

    let realTransport = container.getSingleton<IpcBusTransport>(BrowserTransportToken);
    if (!realTransport) {
        const connector = new WsBrowserConnector(uuidProvider, IpcBusProcessType.Browser);
        realTransport = new IpcBusTransportMulti(connector, uuidProvider);
        container.registerSingleton(BrowserTransportToken, realTransport);
    }

    return new IpcBusClientImpl(new EventEmitter(), realTransport);
}
