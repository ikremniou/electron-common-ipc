import { createWebSocketClient, createWebSocketBroker } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../node/echo-client/echo-contract-impl';
import { perfRequestSuite } from '../suites/perf/perf-request';

describe('ws-node request performance tests', () => {
    perfRequestSuite({
        name: 'ws-node-request',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberRequests: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
