import { BrokerImpl } from '@electron-common-ipc/universal';

import { WsBrokerServerFactory } from './ws-broker-server-factory';

import type { WsConnectorLocal } from '../client/ws-connector-local';
import type { BusContainer, IpcBusBroker, Logger, IpcBusTransport } from '@electron-common-ipc/universal';

export interface ThinContext {
    container?: {
        instance: BusContainer;
        brokerToken: string | symbol;
        transportToken?: string | symbol;
    };
    logger?: Logger;
}

/**
 * This function creates a new instance of IpcBusBroker.
 * If container is provided in the context, then IpcBusBroker will be  registered there and
 * if user calls the factory function for the IpcBusClient it will try to get IpcBusBroker
 * from the container in order to create a local client that will contact IpcBusBroker directly
 *
 * It also handles the case when previous broker was disconnected from the local clients and
 * tries to reconnect existing transport local connector to the new broker instance (transportToken)
 * @param ctx The context of this factory method.
 * @returns The IpcBusBroker instance
 */
export function createWebSocketBroker(ctx: ThinContext): IpcBusBroker {
    const serverFactory = new WsBrokerServerFactory();
    const broker = new BrokerImpl(serverFactory, ctx.logger);
    ctx.container?.instance.registerSingleton(ctx.container?.brokerToken, broker);

    if (ctx.container?.transportToken) {
        const maybeTransport = ctx.container.instance.getSingleton<IpcBusTransport>(ctx.container.transportToken);

        if (maybeTransport) {
            const maybeLocal = maybeTransport.connector as WsConnectorLocal;
            if (maybeLocal.subscribe && maybeLocal.release && maybeLocal.send) {
                broker.addClient(maybeLocal.peer, maybeLocal);
            }
        }
    }

    return broker;
}
