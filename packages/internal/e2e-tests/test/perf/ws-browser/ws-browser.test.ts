import { createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { wsLocalBrokerFactory } from '../../internal/clients/broker/ws-local-broker-factory';
import { startClientHost } from '../../internal/clients/browser/echo-contract-browser';
import { perfEchoSuite } from '../../internal/perf/perf-echo';

describe('ws-browser echo performance tests', () => {
    perfEchoSuite({
        name: 'ws-browser',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberOfEchos: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost: (port) => startClientHost('ws', port, false),
    });
});
