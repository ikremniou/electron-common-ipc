import { createWebSocketClient, createWebSocketBroker } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../node/echo-client/echo-contract-impl';
import { perfEchoSuite } from '../suites/perf/perf-echo';

describe('ws-node echo performance tests', () => {
    perfEchoSuite({
        name: 'ws-node',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberOfEchos: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
