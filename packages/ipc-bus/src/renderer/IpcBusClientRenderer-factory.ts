import type * as Client from '../client/IpcBusClient';
import { GetSingleton, RegisterSingleton } from '../utils';

import { IpcBusConnectorRenderer  } from './IpcBusConnectorRenderer';
import type { IpcWindow } from './IpcBusConnectorRenderer';
import { IpcBusClientImpl} from '../client/IpcBusClientImpl';
import type { IpcBusTransport } from '../client/IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../client/IpcBusTransportMultiImpl';
import type { IpcBusConnector } from '../client/IpcBusConnector';

function CreateConnector(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusConnector {
    const connector = new IpcBusConnectorRenderer(contextType, isMainFrame, ipcWindow);
    return connector;
}

const g_transport_symbol_name = 'IpcBusTransportRenderer';
function CreateTransport(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusTransport {
    let g_transport = GetSingleton<IpcBusTransport>(g_transport_symbol_name);
    if (g_transport == null) {
        const connector = CreateConnector(contextType, isMainFrame, ipcWindow);
        g_transport = new IpcBusTransportMultiImpl(connector);
        RegisterSingleton(g_transport_symbol_name, g_transport);
    }
    return g_transport;
}

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = CreateTransport(contextType, isMainFrame, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
