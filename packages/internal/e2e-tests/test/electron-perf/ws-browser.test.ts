import { createWebSocketBroker, createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../electron/echo-client/echo-contract-impl';
import { perfEchoSuite } from '../suites/perf/perf-echo';

describe('ws-browser echo performance tests', () => {
    perfEchoSuite({
        name: 'ws-browser',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberOfEchos: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
