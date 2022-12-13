import { MessageStampImpl, GlobalContainer, IpcBusLogConfigImpl, ConsoleLogger } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { BrokerToken, TransportToken } from '../constants';
import { uuidProvider } from '../uuid';
import { createWebSocketClient as createThin } from './ws-client-factory-thin';

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
        logger: realLogger,
        container: {
            instance: iocContainer,
            transportToken: TransportToken,
            brokerToken: BrokerToken,
        },
    });
}
