import { CreateIpcBusClient, CreateIpcBusService, CreateIpcBusServiceProxy } from 'electron-common-ipc';

import { eipcLocalBrokerFactory } from '../internal/clients/broker/eipc-local-broker-factory';
import { remoteNodeBrokerFactory } from '../internal/clients/broker/node-broker-factory';
import { startClientHost as startClientHostNode } from '../internal/clients/node/echo-contract-node';
import { shouldPerformBasicTests } from '../internal/suites/smoke-suite';

describe('eipc-node local, local(unaware) node broker, eipc-node on host e2e tests', () => {
    shouldPerformBasicTests('eipc-node', {
        createBroker: eipcLocalBrokerFactory,
        createBusClient: CreateIpcBusClient,
        startClientHost: (port) => startClientHostNode('eipc', port),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
        createIpcBusService: (client, name, impl) => CreateIpcBusService(client, name, impl)
    });
});

describe('eipc-node local, remote node broker, eipc-node on host e2e tests', () => {
    shouldPerformBasicTests('ws-node', {
        createBroker: (port) => remoteNodeBrokerFactory('eipc', port),
        createBusClient: CreateIpcBusClient,
        startClientHost: (port) => startClientHostNode('eipc', port),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
        createIpcBusService: (client, name, impl) => CreateIpcBusService(client, name, impl)
    });
});
