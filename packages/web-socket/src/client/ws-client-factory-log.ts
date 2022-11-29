import { MessageStampImpl, GlobalContainer, IpcBusLogConfigImpl, ConsoleLogger } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

import { BrokerToken, TransportToken } from '../constants';
import { createWebSocketClient as createThin } from './ws-client-factory-thin';

import type { IpcBusClient, Logger } from '@electron-common-ipc/universal';

export function createWebSocketClient(logger?: Logger): IpcBusClient {
    const uuidProvider = nanoid;
    const emitter = new EventEmitter();
    const iocContainer = new GlobalContainer();
    const logConfig = new IpcBusLogConfigImpl();
    const messageStamp = new MessageStampImpl(logConfig);
    const realLogger = logger ?? new ConsoleLogger();

    return createThin({
        emitter,
        uuidProvider,
        messageStamp,
        logger: realLogger,
        container: {
            instance: iocContainer,
            transportToken: TransportToken,
            brokerToken: BrokerToken,
        },
    });
}
