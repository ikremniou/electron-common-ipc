import type * as Client from '../IpcBusClient';

import { IpcBusConnectorRenderer  } from './IpcBusConnectorRenderer';
import type { IpcWindow } from './IpcBusConnectorRenderer';
import { IpcBusClientImpl} from '../IpcBusClientImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import type { IpcBusConnector } from '../IpcBusConnector';

function CreateConnector(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusConnector {
    const connector = new IpcBusConnectorRenderer(contextType, isMainFrame, ipcWindow);
    return connector;
}

let g_transport: IpcBusTransport = null;
function CreateTransport(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusTransport {
    if (g_transport == null) {
        const connector = CreateConnector(contextType, isMainFrame, ipcWindow);
        g_transport = new IpcBusTransportMultiImpl(connector);
    }
    return g_transport;
}

// Implementation for Renderer process
export function Create(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): Client.IpcBusClient {
    const transport = CreateTransport(contextType, isMainFrame, ipcWindow);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}
