import { createWebSocketBroker, createWebSocketClient } from '@electron-common-ipc/web-socket';

import { shouldPerformBasicTests } from '../suites/smoke';
import { startClientHost } from './echo-client/echo-contract-impl';

describe('ws-node local, ws-node on host e2e tests', () => {
    shouldPerformBasicTests('ws-node', {
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
