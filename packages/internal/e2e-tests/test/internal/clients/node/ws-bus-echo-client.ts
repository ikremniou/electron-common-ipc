import { createIpcBusService, createIpcBusServiceProxy, createWebSocketClient } from '@electron-common-ipc/web-socket';
import { EventEmitter } from 'events';

import { bootstrap } from './bus-echo-client-base';

bootstrap(
    createWebSocketClient,
    (client, channel, instance, options) =>
        createIpcBusService(client, channel, instance, EventEmitter.prototype, undefined, options),
    (client, channel) => createIpcBusServiceProxy(client, channel, new EventEmitter())
);
