import type { IpcBusProcessType, IpcBusClient, IpcBusPeerProcess } from '../client/IpcBusClient';

import { IpcBusClientImpl}  from '../client/IpcBusClientImpl';
import type { IpcBusTransport } from '../client/IpcBusTransport';
// import { IpcBusConnector } from '../IpcBusConnector';
// import { IpcBusTransportMultiImpl } from '../client/IpcBusTransportMultiImpl';
import { CreateIpcBusBridge } from './IpcBusBridge-factory';
import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// export function CreateConnector(contextType: IpcBusProcessType): IpcBusConnector {
//     const bridge = CreateIpcBusBridge() as IpcBusBridgeImpl;
//     const connector = bridge.mainConnector;
//     return connector;
// }

function CreateTransport(contextType: IpcBusProcessType): IpcBusTransport {
    const bridge = CreateIpcBusBridge() as IpcBusBridgeImpl;
    const transport = bridge.mainTransport;
    return transport;
}

// Implementation for Electron Main process
export function Create(contextType: IpcBusProcessType): IpcBusClient {
    const transport = CreateTransport(contextType);
    const ipcClient = new IpcBusClientImpl(transport);
    return ipcClient;
}

export function GetWindowTarget(window: any, frameId?: number): IpcBusPeerProcess | undefined {
    const bridge = CreateIpcBusBridge() as IpcBusBridgeImpl;
    return bridge.getWindowTarget(window as Electron.BrowserWindow, frameId);
}

// export function GetProcessTarget(pid: number): IpcBusPeerProcess | undefined {
//     return undefined;
// }