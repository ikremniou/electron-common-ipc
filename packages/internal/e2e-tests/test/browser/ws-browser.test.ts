import { createWebSocketClient, createIpcBusServiceProxy } from '@electron-common-ipc/web-socket';

import { wsLocalBrokerFactory } from '../utilities/broker/ws-local-broker-factory';
import { wsNodeBrokerFactory } from '../utilities/broker/ws-node-broker-factory';
import { shouldPerformBasicTests } from '../utilities/smoke-suite';
import { startClientHost } from './echo-client/echo-contract-impl';

describe('ws-node local, local node broker, ws-browser on host e2e tests', () => {
    shouldPerformBasicTests('ws-browser', {
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost,
        createIpcBusServiceProxy,
    });
});

describe('ws-node local, remote node broker, ws-browser on host e2e tests', () => {
    shouldPerformBasicTests('ws-browser', {
        createBroker: wsNodeBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost,
        createIpcBusServiceProxy,
    });
});
