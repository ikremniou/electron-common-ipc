import { createIpcBusService, createIpcBusServiceProxy } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import type {
    IpcBusClient,
    IpcBusService,
    IpcBusServiceProxy,
    ServiceProxyConnectOptions,
} from '@electron-common-ipc/universal';

export function newIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: unknown): IpcBusService {
    return createIpcBusService(client, serviceName, serviceImpl, EventEmitter.prototype);
}

export function newIpcBusServiceProxy(
    client: IpcBusClient,
    serviceName: string,
    options?: ServiceProxyConnectOptions
): IpcBusServiceProxy {
    return createIpcBusServiceProxy(client, serviceName, new EventEmitter(), options);
}
