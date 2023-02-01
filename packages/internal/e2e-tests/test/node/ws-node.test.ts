import { createIpcBusServiceProxy, createWebSocketClient } from '@electron-common-ipc/web-socket';

import { remoteNodeBrokerFactory } from '../clients/broker/node-broker-factory';
import { wsLocalBrokerFactory } from '../clients/broker/ws-local-broker-factory';
import { startClientHost } from '../clients/node/echo-contract-node';
import { shouldPerformBasicTests } from '../suites/smoke-suite';

describe('ws-node local, local node broker, ws-node on host e2e tests', () => {
    shouldPerformBasicTests('ws-node', {
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port),
        createIpcBusServiceProxy,
    });
});

describe('ws-node local, remote node broker, ws-node on host e2e tests', () => {
    shouldPerformBasicTests('ws-node', {
        createBroker: (port) => remoteNodeBrokerFactory('ws', port),
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port),
        createIpcBusServiceProxy,
    });
});
