import { createWebSocketClient } from '@electron-common-ipc/web-socket';
import * as path from 'path';

import { startClientHost } from '../../node/echo-client/echo-contract-impl';
import { wsLocalBrokerFactory } from '../../utilities/broker/ws-local-broker-factory';
import { perfEchoSuite } from '../../utilities/perf/perf-echo';

describe('ws-node echo performance tests', () => {
    perfEchoSuite({
        name: 'ws-node',
        times: 100,
        writeTo: path.join(__dirname, '..', '..', 'notes', 'perf-results'),
        numberOfEchos: 100,
        objectTypes: [JSON.stringify([1, 2, 3, 4, 5, 6, '7'])],
        createBroker: wsLocalBrokerFactory,
        createBusClient: createWebSocketClient,
        startClientHost,
    });
});
