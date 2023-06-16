import { IpcBusClientImpl } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { newIpcBusBridge } from './IpcBusBridge-factory';
import { uuidProvider } from '../utils/uuid';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import type { IpcBusClient, IpcBusTransport, IpcBusPeer } from '@electron-common-ipc/universal';

function createTransport(): IpcBusTransport {
    const bridge = newIpcBusBridge() as IpcBusBridgeImpl;
    const transport = bridge.mainTransport;
    return transport;
}

// Implementation for Electron Main process
export function createIpcBusClient(): IpcBusClient {
    const transport = createTransport();
    const ipcClient = new IpcBusClientImpl(uuidProvider, new EventEmitter(), transport);
    return ipcClient;
}

export function getWindowTarget(window: unknown, frameId?: number): IpcBusPeer | undefined {
    const bridge = newIpcBusBridge() as IpcBusBridgeImpl;
    return bridge.getWindowTarget(window as Electron.BrowserWindow, frameId);
}
