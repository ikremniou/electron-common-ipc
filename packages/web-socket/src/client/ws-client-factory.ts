import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { customAlphabet } from 'nanoid';

import { BrokerToken, TransportToken, UuidAlphabet } from '../constants';
import { createWebSocketClient as createThin } from './ws-client-factory-thin';

import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(): IpcBusClient {
    const uuidProvider = customAlphabet(UuidAlphabet, 10);
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
