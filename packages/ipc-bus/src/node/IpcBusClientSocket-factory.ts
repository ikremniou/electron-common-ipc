import {
    GlobalContainer,
    IpcBusClientImpl,
    IpcBusTransportMulti,
    IpcBusProcessType,
    ConsoleLogger,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { IpcBusConnectorSocket } from './IpcBusConnectorSocket';
import { Logger } from '../utils/log';
import { uuidProvider } from '../utils/uuid';

import type { IpcBusClient, IpcBusConnector, IpcBusTransport, UuidProvider } from '@electron-common-ipc/universal';

function createConnector(uuid: UuidProvider, contextType: IpcBusProcessType): IpcBusConnector {
    const connector = new IpcBusConnectorSocket(uuid, contextType);
    return connector;
}

const gTransportSymbolName = 'IpcBusTransportSocket';
function createTransport(contextType: IpcBusProcessType): IpcBusTransport {
    const container = new GlobalContainer();
    let transport = container.getSingleton<IpcBusTransport>(gTransportSymbolName);
    if (!transport) {
        const connector = createConnector(uuidProvider, contextType);
        // TODO: add stamps from globals as it was before.
        const logger = Logger.enable ? new ConsoleLogger() : undefined;
        transport = new IpcBusTransportMulti(connector, uuidProvider, undefined, logger);
        container.registerSingleton(gTransportSymbolName, transport);
    }
    return transport;
}

// Implementation for Node process
export function createIpcBusClient(): IpcBusClient {
    const transport = createTransport(IpcBusProcessType.Node);
    const ipcClient = new IpcBusClientImpl(new EventEmitter(), transport);
    return ipcClient;
}
