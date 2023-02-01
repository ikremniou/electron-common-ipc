import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { createWebSocketClient as createThin } from './ws-client-factory-thin';
import { BrokerToken, TransportToken } from '../constants';
import { uuidProvider } from '../uuid';

import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(): IpcBusClient {
    const emitter = new EventEmitter();
    const container = new GlobalContainer();

    return createThin({
        emitter,
        uuidProvider,
        container: {
            instance: container,
            transportToken: TransportToken,
            brokerToken: BrokerToken,
        },
    });
}
