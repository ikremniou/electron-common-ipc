import { createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { wsLocalBrokerFactory } from '../../internal/clients/broker/ws-local-broker-factory';
import { startClientHost } from '../../internal/clients/browser/echo-contract-browser';
import { perfRequestSuite } from '../../internal/perf/perf-request';

describe('ws-browser request performance tests', () => {
    perfRequestSuite({
        name: 'ws-browser-request',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberRequests: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port, false),
    });
});

