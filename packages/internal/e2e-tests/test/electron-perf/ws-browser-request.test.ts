import { createWebSocketBroker, createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../electron/echo-client/echo-contract-impl';
import { perfRequestSuite } from '../suites/perf/perf-request';

describe('ws-browser request performance tests', () => {
    perfRequestSuite({
        name: 'ws-browser-request',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberRequests: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
