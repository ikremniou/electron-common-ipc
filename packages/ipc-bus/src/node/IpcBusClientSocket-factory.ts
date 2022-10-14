import { GetElectronProcessType } from 'electron-process-type/lib/v2';

import type * as Client from '../client/IpcBusClient';
import { GetSingleton, RegisterSingleton } from '../utils';

import { IpcBusConnectorSocket } from './IpcBusConnectorSocket';
import { IpcBusClientImpl}  from '../client/IpcBusClientImpl';
import type { IpcBusTransport } from '../client/IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../client/IpcBusTransportMultiImpl';
import type { IpcBusConnector } from '../client/IpcBusConnector';
import { IpcBusClientNet, IpcBusClientSocket } from './IpcBusClientSocket';

const CreateIpcBusNet: Client.IpcBusClient.CreateFunction = (): Client.IpcBusClient => {
    const electronProcessType = GetElectronProcessType();
    return Create(electronProcessType);
}
IpcBusClientNet.Create = CreateIpcBusNet;
IpcBusClientSocket.Create = CreateIpcBusNet;

function CreateConnector(contextType: Client.IpcBusProcessType): IpcBusConnector {
    const connector = new IpcBusConnectorSocket(contextType);
    return connector;
}

const g_transport_symbol_name = 'IpcBusTransportSocket';
function CreateTransport(contextType: Client.IpcBusProcessType): IpcBusTransport {
    let g_transport = GetSingleton<IpcBusTransport>(g_transport_symbol_name);
    if (g_transport == null) {
        const connector = CreateConnector(contextType);
        g_transport = new IpcBusTransportMultiImpl(connector);
        RegisterSingleton(g_transport_symbol_name, g_transport);
    }
    return g_transport;
}

// Implementation for Node process
export function Create(contextType: Client.IpcBusProcessType): Client.IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
