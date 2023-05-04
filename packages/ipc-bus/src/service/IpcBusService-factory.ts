import { ConsoleLogger, createIpcBusService, createIpcBusServiceProxy } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { Logger } from '../utils/log';

import type {
    IpcBusClient,
    IpcBusService,
    IpcBusServiceProxy,
    ServiceProxyConnectOptions,
} from '@electron-common-ipc/universal';

export function newIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: unknown): IpcBusService {
    const logger = Logger.service ? new ConsoleLogger() : undefined;
    return createIpcBusService(client, serviceName, serviceImpl, EventEmitter.prototype, logger);
}

export function newIpcBusServiceProxy(
    client: IpcBusClient,
    serviceName: string,
    options?: ServiceProxyConnectOptions
): IpcBusServiceProxy {
    const logger = Logger.service ? new ConsoleLogger() : undefined;
    return createIpcBusServiceProxy(client, serviceName, new EventEmitter(), options, logger);
}
