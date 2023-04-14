import {
    createIpcBusService as createServiceUniversal,
    createIpcBusServiceProxy as createServiceProxyUniversal,
} from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import type {
    IpcBusClient,
    IpcBusService,
    IpcBusServiceProxy,
    ServiceProxyConnectOptions,
} from '@electron-common-ipc/universal';

export function createIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: unknown): IpcBusService {
    return createServiceUniversal(client, serviceName, serviceImpl, EventEmitter.prototype);
}

export function createIpcBusServiceProxy(
    client: IpcBusClient,
    serviceName: string,
    options?: ServiceProxyConnectOptions
): IpcBusServiceProxy {
    return createServiceProxyUniversal(client, serviceName, new EventEmitter(), options);
}
