import { createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../../browser/echo-client/echo-contract-impl';
import { wsLocalBrokerFactory } from '../../utilities/broker/ws-local-broker-factory';
import { perfEchoSuite } from '../../utilities/perf/perf-echo';

describe('ws-browser echo performance tests', () => {
    perfEchoSuite({
        name: 'ws-browser',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberOfEchos: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost,
    });
});
