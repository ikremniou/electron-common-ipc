import { CreateIpcBusClient, CreateIpcBusServiceProxy } from 'electron-common-ipc';

import { eipcLocalBrokerFactory } from '../clients/broker/eipc-local-broker-factory';
import { startClientHost } from '../clients/node/echo-contract-node';
import { shouldPerformBasicTests } from '../suites/smoke-suite';

describe('eipc-node local, local node broker, ws-node on host e2e tests', () => {
    shouldPerformBasicTests('eipc-node', {
        createBroker: eipcLocalBrokerFactory,
        createBusClient: CreateIpcBusClient,
        startClientHost: (port) => startClientHost('eipc', port),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name)
    });
});
