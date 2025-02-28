import { createWebSocketClient, createIpcBusServiceProxy, createIpcBusService } from '@electron-common-ipc/web-socket';
import { EventEmitter } from 'events';

import { remoteNodeBrokerFactory } from '../internal/clients/broker/node-broker-factory';
import { wsLocalBrokerFactory } from '../internal/clients/broker/ws-local-broker-factory';
import { startClientHost } from '../internal/clients/browser/echo-contract-browser';
import { shouldPerformBasicTests } from '../internal/suites/smoke-suite';

describe('ws-node local, local node broker, ws-browser on host e2e tests', () => {
    shouldPerformBasicTests('ws-browser', {
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port, false),
        createIpcBusServiceProxy: (client, name) => createIpcBusServiceProxy(client, name, new EventEmitter()),
        createIpcBusService: (client, name, impl, options) =>
            createIpcBusService(client, name, impl, EventEmitter.prototype, undefined, options),
    });
});

describe('ws-node local, remote node broker, ws-browser on host e2e tests', () => {
    shouldPerformBasicTests('ws-browser', {
        createBroker: (port) => remoteNodeBrokerFactory('ws', port),
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port, false),
        createIpcBusServiceProxy: (client, name) => createIpcBusServiceProxy(client, name, new EventEmitter()),
        createIpcBusService: (client, name, impl, options) =>
            createIpcBusService(client, name, impl, EventEmitter.prototype, undefined, options),
    });
});
