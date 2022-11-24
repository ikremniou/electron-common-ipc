import { BrokerImpl } from '@electron-common-ipc/universal';

import { WebSocketBrokerServerFactory } from './ws-broker-server-factory';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(): IpcBusBroker {
    const serverFactory = new WebSocketBrokerServerFactory();
    const webSocketBroker = new BrokerImpl(serverFactory);
    return webSocketBroker;
}
