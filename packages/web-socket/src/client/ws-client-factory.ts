import { GlobalContainer } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketClient as createThin } from './ws-client-factory-thin';
import { uuidProvider } from '../uuid';

import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(): IpcBusClient {
    const emitter = new EventEmitter();
    const container = new GlobalContainer();

    return createThin({
        emitter,
        uuidProvider,
        json: JSONParserV1,
        container,
    });
}
