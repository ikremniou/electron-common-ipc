import { ConsoleLogger, GlobalContainer, IpcBusLogConfigImpl, MessageStampImpl } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { JSONParserV1 } from 'json-helpers';

import { uuidProvider } from './uuid';
import { createWebSocketClient as createThin } from './ws-browser-factory-thin';

import type { IpcBusClient } from '@electron-common-ipc/universal';

export function createWebSocketClient(): IpcBusClient {
    const container = new GlobalContainer();
    const logger = new ConsoleLogger();
    const logConfig = new IpcBusLogConfigImpl();
    const messageStamp = new MessageStampImpl(logConfig);

    return createThin({
        uuidProvider,
        emitter: new EventEmitter(),
        logger,
        json: JSONParserV1,
        messageStamp,
        container,
    });
}
