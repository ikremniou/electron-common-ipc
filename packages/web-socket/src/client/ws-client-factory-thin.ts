import { IpcBusTransportMulti, IpcBusClientImpl, IpcBusProcessType } from '@electron-common-ipc/universal';

import { WsConnector } from './ws-connector';
import { WsConnectorLocal } from './ws-connector-local';
import { BrokerToken, TransportToken } from '../constants';

import type {
    IpcBusClient,
    UuidProvider,
    BusContainer,
    IpcBusTransport,
    IpcBusConnector,
    IpcBusBrokerPrivate,
    MessageStamp,
    Logger,
    IpcBusClientEmitter,
    JsonLike,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    emitter: IpcBusClientEmitter;
    uuidProvider: UuidProvider;
    json: JsonLike;
    messageStamp?: MessageStamp;
    logger?: Logger;
    container?: BusContainer;
}

/**
 * This method creates a new client for the IPC.
 * If you pass container in the context then it is possible to create a local client for
 * the IpcBusBroker that will not push message to IPC to reach broker, but call it directly
 *
 * If this factory method is using container then the transport object will be reused to
 * manage messaging between local clients, that will improve the performance greatly
 * @param ctx The context of the factory
 * @returns The instance of the IpcBusClient
 */
export function createWebSocketClient(ctx: ThinContext): IpcBusClient {
    const maybeBusBroker: IpcBusBrokerPrivate = ctx.container?.getSingleton(BrokerToken);
    let realTransport: IpcBusTransport = ctx.container?.getSingleton(TransportToken);
    let connector: IpcBusConnector;

    if (!realTransport) {
        if (maybeBusBroker) {
            connector = new WsConnectorLocal(ctx.uuidProvider, ctx.json, IpcBusProcessType.Node);
        } else {
            connector = new WsConnector(ctx.uuidProvider, ctx.json, IpcBusProcessType.Node);
        }

        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider, ctx.messageStamp, ctx.logger);
        ctx.container?.registerSingleton(TransportToken, realTransport);
    }

    const client = new IpcBusClientImpl(ctx.uuidProvider, ctx.emitter, realTransport);
    if (maybeBusBroker && connector) {
        maybeBusBroker.addClient([client.peer], connector as WsConnectorLocal);
    }
    return client;
}
