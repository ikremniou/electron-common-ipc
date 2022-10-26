import { BrokerImpl, ConsoleLogger } from '@electron-common-ipc/universal';

import { WebSocketBrokerServerFactory } from './ws-broker-server-factory';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(): IpcBusBroker {
    const logger = new ConsoleLogger();
    const serverFactory = new WebSocketBrokerServerFactory();
    const webSocketBroker = new BrokerImpl(serverFactory, logger);
    return webSocketBroker;
}
