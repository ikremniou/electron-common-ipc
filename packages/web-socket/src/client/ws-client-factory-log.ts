import { MessageStampImpl, GlobalContainer, IpcBusLogConfigImpl, ConsoleLogger } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketClient as createThin } from './ws-client-factory-thin';
import { uuidProvider } from '../uuid';

import type { IpcBusClient, Logger } from '@electron-common-ipc/universal';

export function createWebSocketClient(logger?: Logger): IpcBusClient {
    const emitter = new EventEmitter();
    const iocContainer = new GlobalContainer();
    const logConfig = new IpcBusLogConfigImpl();
    const messageStamp = new MessageStampImpl(logConfig);
    const realLogger = logger ?? new ConsoleLogger();

    return createThin({
        emitter,
        uuidProvider,
        messageStamp,
        json: JSONParserV1,
        logger: realLogger,
        container: iocContainer,
    });
}
