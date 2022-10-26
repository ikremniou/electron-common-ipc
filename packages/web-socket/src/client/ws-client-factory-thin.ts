import { IpcBusTransportMulti, IpcBusClientImpl, IpcBusProcessType } from '@electron-common-ipc/universal';

import { WsConnector } from './ws-connector';

import type {
    IpcBusClient,
    EventEmitterLike,
    IpcBusListener,
    UuidProvider,
    BusContainer,
    IpcBusTransport,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    emitter: EventEmitterLike<IpcBusListener>;
    uuidProvider: UuidProvider;
    container?: BusContainer;
}

const TransportSymbolName = 'WsTransportThin';
export function createWebSocketClient(ctx: ThinContext): IpcBusClient {
    let realTransport: IpcBusTransport = ctx.container?.getSingleton(TransportSymbolName);
    if (!realTransport) {
        const connector = new WsConnector(ctx.uuidProvider, IpcBusProcessType.Node);
        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider);
        ctx.container?.registerSingleton(TransportSymbolName, realTransport);
    }

    return new IpcBusClientImpl(ctx.emitter, realTransport);
}
