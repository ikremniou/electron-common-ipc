import {
    createIpcBusService,
    createIpcBusServiceProxy,
    createWebSocketClient,
} from '@electron-common-ipc/web-socket-browser';
import { EventEmitter } from 'events';

import { bootstrap } from './browser-client-base';

bootstrap(
    createWebSocketClient,
    (client, channel, instance, options) =>
        createIpcBusService(client, channel, instance, EventEmitter.prototype, undefined, options),
    (client, channel) => createIpcBusServiceProxy(client, channel, new EventEmitter())
);
