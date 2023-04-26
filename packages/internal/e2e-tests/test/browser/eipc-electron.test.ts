import { CreateIpcBusBridge, CreateIpcBusClient, CreateIpcBusServiceProxy } from 'electron-common-ipc';

import { startClientHost as startClientHostRenderer } from '../clients/browser/echo-contract-browser';
import { shouldPerformBasicTests } from '../suites/smoke-suite';

import type { IpcBusBrokerProxy } from '../clients/broker/broker-proxy';
import type { BridgeConnectOptions } from 'electron-common-ipc';

async function createBridgeAsBroker(options?: BridgeConnectOptions): Promise<IpcBusBrokerProxy> {
    const bridge = CreateIpcBusBridge();
    await bridge.connect(options);
    return {
        close: () => bridge.close(),
    };
}

xdescribe('eipc-main local, bridge as broker, eipc-browser on host e2e tests', () => {
    shouldPerformBasicTests('eipc-electron', {
        createBroker: () => createBridgeAsBroker(undefined),
        createBusClient: CreateIpcBusClient,
        startClientHost: () => startClientHostRenderer('eipc', undefined, false),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
    });
});

describe('eipc-main local, bridge-server as broker, eipc-browser on host(contextIsolation=true) e2e tests', () => {
    shouldPerformBasicTests('eipc-electron', {
        createBroker: (port) => createBridgeAsBroker({ server: true, port }),
        createBusClient: CreateIpcBusClient,
        startClientHost: () => startClientHostRenderer('eipc', undefined, true),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
    });
});
