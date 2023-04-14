import {
    GlobalContainer,
    IpcBusClientImpl,
    IpcBusTransportMulti,
    IpcBusProcessType,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { IpcBusConnectorSocket } from './IpcBusConnectorSocket';
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
        // TODO_IK_2: add logger and stamps from globals as it was before.
        transport = new IpcBusTransportMulti(connector, uuidProvider);
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
