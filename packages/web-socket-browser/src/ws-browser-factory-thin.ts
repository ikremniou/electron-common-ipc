import { IpcBusClientImpl, IpcBusProcessType, IpcBusTransportMulti } from '@electron-common-ipc/universal';

import { BrowserTransportToken } from './constants';
import { WsBrowserBusClient } from './ws-browser-bus-client';
import { WsBrowserConnector } from './ws-browser-connector';

import type { ReconnectOptions } from './ws-browser-bus-client';
import type {
    BusContainer,
    IpcBusTransport,
    UuidProvider,
    Logger,
    IpcBusClient,
    MessageStamp,
    IpcBusClientEmitter,
    JsonLike,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    uuidProvider: UuidProvider;
    emitter: IpcBusClientEmitter;
    json: JsonLike;
    logger?: Logger;
    messageStamp?: MessageStamp;
    container?: BusContainer;
    reconnect?: ReconnectOptions;
}

export function createWebSocketClient(ctx: ThinContext): IpcBusClient {
    let realTransport = ctx.container?.getSingleton<IpcBusTransport>(BrowserTransportToken);
    if (!realTransport) {
        const connector = new WsBrowserConnector(ctx.uuidProvider, ctx.json, IpcBusProcessType.Browser, ctx.logger);
        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider);
        ctx.container?.registerSingleton(BrowserTransportToken, realTransport);
    }

    if (ctx.reconnect) {
        return new WsBrowserBusClient(ctx.emitter, realTransport, ctx.logger, ctx.reconnect);
    }

    return new IpcBusClientImpl(ctx.emitter, realTransport);
}
