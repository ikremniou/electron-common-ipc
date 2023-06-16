import { ConsoleLogger, GlobalContainer } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketBroker as createThin } from './broker-factory-thin';

import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(): IpcBusBroker {
    const logger = new ConsoleLogger();
    const globalContainer = new GlobalContainer();

    return createThin({
        json: JSONParserV1,
        container: globalContainer,
        logger,
    });
}
