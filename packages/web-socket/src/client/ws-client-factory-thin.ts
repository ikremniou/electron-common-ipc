import { IpcBusTransportMulti, IpcBusClientImpl, IpcBusProcessType } from '@electron-common-ipc/universal';

import { WsConnector } from './ws-connector';
import { WsConnectorLocal } from './ws-connector-local';

import type {
    IpcBusClient,
    UuidProvider,
    BusContainer,
    IpcBusTransport,
    IpcBusConnector,
    IpcBusBroker,
    MessageStamp,
    Logger,
    IpcBusClientEmitter,
} from '@electron-common-ipc/universal';

export interface ThinContext {
    emitter: IpcBusClientEmitter;
    uuidProvider: UuidProvider;
    messageStamp?: MessageStamp;
    logger?: Logger;
    container?: {
        instance: BusContainer;
        brokerToken: string | symbol;
        transportToken: string | symbol;
    };
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
    const maybeBusBroker: IpcBusBroker = ctx.container?.instance.getSingleton(ctx.container?.brokerToken);
    let realTransport: IpcBusTransport = ctx.container?.instance.getSingleton(ctx.container?.transportToken);

    if (!realTransport) {
        let connector: IpcBusConnector;
        if (maybeBusBroker) {
            const localConnector = new WsConnectorLocal(ctx.uuidProvider, IpcBusProcessType.Node);
            maybeBusBroker.addClient(localConnector.peer, localConnector);
            connector = localConnector;
        } else {
            connector = new WsConnector(ctx.uuidProvider, IpcBusProcessType.Node);
        }

        realTransport = new IpcBusTransportMulti(connector, ctx.uuidProvider, ctx.messageStamp, ctx.logger);
        ctx.container?.instance.registerSingleton(ctx.container?.transportToken, realTransport);
    }

    return new IpcBusClientImpl(ctx.emitter, realTransport);
}
