import { IpcBusClientImpl, IpcBusProcessType, IpcBusTransportMulti } from '@electron-common-ipc/universal';

import { WsBrowserConnector } from './ws-browser-connector';

import type {
    BusContainer,
    EventEmitterLike,
    IpcBusListener,
    IpcBusTransport,
    UuidProvider,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    container?: BusContainer;
    uuidProvider: UuidProvider;
    emitter: EventEmitterLike<IpcBusListener>;
}

const BrowserTransportToken = 'WsBrowserTransportToken';
export function createWebSocketClient(ctx: ThinContext) {
    let realTransport = ctx.container?.getSingleton<IpcBusTransport>(BrowserTransportToken);
    if (!realTransport) {
        const connector = new WsBrowserConnector(ctx.uuidProvider, IpcBusProcessType.Browser);
        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider);
        ctx.container?.registerSingleton(BrowserTransportToken, realTransport);
    }

    return new IpcBusClientImpl(ctx.emitter, realTransport);
}
