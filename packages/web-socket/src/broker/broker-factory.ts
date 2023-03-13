import { GlobalContainer } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketBroker as createThin } from './broker-factory-thin';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(): IpcBusBroker {
    return createThin({
        json: JSONParserV1,
        container: new GlobalContainer(),
    });
}
