import {
    CreateIpcBusBridge,
    CreateIpcBusClient,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
} from 'electron-common-ipc';

import { remoteNodeBrokerFactory } from '../internal/clients/broker/node-broker-factory';
import { startClientHost as startClientHostRenderer } from '../internal/clients/browser/echo-contract-browser';
import { startClientHost as startClientHostNode } from '../internal/clients/node/echo-contract-node';
import { shouldRunEipcSpecificTests } from '../internal/suites/eipc-suite';
import { shouldPerformBasicTests } from '../internal/suites/smoke-suite';

import type { IpcBusBrokerProxy } from '../internal/clients/broker/broker-proxy';
import type { BridgeConnectOptions } from 'electron-common-ipc';

async function createBridgeAsBroker(options?: BridgeConnectOptions): Promise<IpcBusBrokerProxy> {
    let broker: IpcBusBrokerProxy;
    if (options?.port) {
        broker = await remoteNodeBrokerFactory('eipc', options.port);
    }
    const bridge = CreateIpcBusBridge();
    await bridge.connect(options);
    return {
        close: async () => {
            await bridge.close();
            await broker?.close();
        },
    };
}

xdescribe('eipc-main local, bridge as broker, eipc-browser on host e2e tests', () => {
    shouldPerformBasicTests('eipc-electron', {
        createBroker: () => createBridgeAsBroker(undefined),
        createBusClient: CreateIpcBusClient,
        startClientHost: () => startClientHostRenderer('eipc', undefined, false),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
        createIpcBusService: (client, name, impl) => CreateIpcBusService(client, name, impl),
    });
});

xdescribe('eipc-main local, bridge with remote broker, eipc-browser on host e2e tests', () => {
    shouldPerformBasicTests('eipc-electron', {
        createBroker: (port) => createBridgeAsBroker({ port }),
        createBusClient: CreateIpcBusClient,
        startClientHost: () => startClientHostRenderer('eipc', undefined, false),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
        createIpcBusService: (client, name, impl) => CreateIpcBusService(client, name, impl),
    });
});

describe('eipc-main local, bridge with remote broker, eipc-browser on host e2e tests', () => {
    shouldRunEipcSpecificTests('eipc-electron', {
        createBroker: (port) => createBridgeAsBroker({ port }),
        createBusClient: CreateIpcBusClient,
        startClientHost: () => startClientHostRenderer('eipc', undefined, false),
        createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
        createIpcBusService: (client, name, impl) => CreateIpcBusService(client, name, impl),
        startClientHostNode: (port) => startClientHostNode('eipc', port, true),
    });
});

// describe('eipc-main local, bridge-server as broker, contextIsolation=true on host e2e tests', () => {
//     shouldPerformBasicTests('eipc-electron', {
//         createBroker: (port) => createBridgeAsBroker(undefined),
//         createBusClient: CreateIpcBusClient,
//         startClientHost: () => startClientHostRenderer('eipc', undefined, true),
//         createIpcBusServiceProxy: (client, name) => CreateIpcBusServiceProxy(client, name),
//     });
// });
