import { GlobalContainer, IpcBusClientImpl, IpcBusTransportMulti } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { IpcBusConnectorRenderer } from './IpcBusConnectorRenderer';
import { uuidProvider } from '../utils/uuid';

import type { IpcWindow } from './IpcBusConnectorRenderer';
import type { IpcBusConnector, IpcBusProcessType, IpcBusTransport, IpcBusClient } from '@electron-common-ipc/universal';

function createConnector(contextType: IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusConnector {
    const connector = new IpcBusConnectorRenderer(uuidProvider, contextType, isMainFrame, ipcWindow);
    return connector;
}

const gTransportSymbolName = 'IpcBusTransportRenderer';
function createTransport(contextType: IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow): IpcBusTransport {
    const container = new GlobalContainer();

    let gTransport = container.getSingleton<IpcBusTransport>(gTransportSymbolName);
    if (!gTransport) {
        const connector = createConnector(contextType, isMainFrame, ipcWindow);
        gTransport = new IpcBusTransportMulti(connector, uuidProvider);
        container.registerSingleton(gTransportSymbolName, gTransport);
    }
    return gTransport;
}

// Implementation for Renderer process
export function createIpcBusClient(
    contextType: IpcBusProcessType,
    isMainFrame: boolean,
    ipcWindow: IpcWindow
): IpcBusClient {
    const transport = createTransport(contextType, isMainFrame, ipcWindow);
    const ipcClient = new IpcBusClientImpl(new EventEmitter(), transport);
    return ipcClient;
}
