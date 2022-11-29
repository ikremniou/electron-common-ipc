import { IpcBusClientImpl, IpcBusProcessType, IpcBusTransportMulti } from '@electron-common-ipc/universal';

import { WsBrowserConnector } from './ws-browser-connector';

import type {
    BusContainer,
    IpcBusTransport,
    UuidProvider,
    Logger,
    IpcBusClient,
    MessageStamp,
    IpcBusClientEmitter,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    uuidProvider: UuidProvider;
    emitter: IpcBusClientEmitter;
    logger?: Logger;
    messageStamp?: MessageStamp;
    container?: {
        instance: BusContainer;
        transportSymbol: string | symbol;
    };
}

export function createWebSocketClient(ctx: ThinContext): IpcBusClient {
    let realTransport = ctx.container?.instance.getSingleton<IpcBusTransport>(ctx.container?.transportSymbol);
    if (!realTransport) {
        const connector = new WsBrowserConnector(ctx.uuidProvider, IpcBusProcessType.Browser);
        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider);
        ctx.container?.instance.registerSingleton(ctx.container?.transportSymbol, realTransport);
    }

    return new IpcBusClientImpl(ctx.emitter, realTransport);
}
