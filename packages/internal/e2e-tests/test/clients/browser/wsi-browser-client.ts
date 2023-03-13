import {
    createIpcBusService,
    createIpcBusServiceProxy,
    createWebSocketClientThin,
    DefaultContainer,
    defaultUuidProvider,
} from '@electron-common-ipc/web-socket-browser';
import { EventEmitter } from 'events';

import { bootstrap } from './browser-client-base';

bootstrap(
    () =>
        createWebSocketClientThin({
            json: JSON,
            emitter: new EventEmitter(),
            uuidProvider: defaultUuidProvider,
            container: new DefaultContainer(),
        }),
    (client, channel, instance) => createIpcBusService(client, channel, instance, EventEmitter.prototype),
    (client, channel) => createIpcBusServiceProxy(client, channel, new EventEmitter())
);
