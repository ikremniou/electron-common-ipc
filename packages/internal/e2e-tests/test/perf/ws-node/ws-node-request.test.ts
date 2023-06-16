import { createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { wsLocalBrokerFactory } from '../../internal/clients/broker/ws-local-broker-factory';
import { startClientHost } from '../../internal/clients/node/echo-contract-node';
import { perfRequestSuite } from '../../internal/perf/perf-request';

describe('ws-node request performance tests', () => {
    perfRequestSuite({
        name: 'ws-node-request',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberRequests: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost: startClientHost.bind(undefined, 'ws'),
    });
});
