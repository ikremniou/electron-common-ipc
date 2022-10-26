import { createWebSocketClient, createWebSocketBroker } from '@electron-common-ipc/web-socket';

import { shouldPerformBasicTests } from '../suites/smoke';
import { startClientHost } from './echo-client/echo-contract-impl';

describe('ws-node local, ws-browser on host e2e tests', () => {
    shouldPerformBasicTests('ws-browser', {
        createWebSocketBroker,
        createWebSocketClient,
        startClientHost,
    });
});
