import { GlobalContainer } from '@electron-common-ipc/universal';

import { BrokerToken, TransportToken } from '../constants';
import { createWebSocketBroker as createThin } from './broker-factory-thin';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(): IpcBusBroker {
    return createThin({
        container: {
            instance: new GlobalContainer(),
            brokerToken: BrokerToken,
            transportToken: TransportToken,
        }
    });
}
