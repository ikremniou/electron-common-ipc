import { ConsoleLogger, createIpcBusService, createIpcBusServiceProxy } from '@electron-common-ipc/universal';
import { EventEmitter } from 'events';

import { Logger } from '../utils/log';

import type {
    IpcBusClient,
    IpcBusService,
    IpcBusServiceProxy,
    ServiceProxyConnectOptions,
    BusServiceOptions,
    ServiceEventEmitter,
} from '@electron-common-ipc/universal';

export function newIpcBusService(
    client: IpcBusClient,
    serviceName: string,
    serviceImpl: unknown,
    options?: BusServiceOptions,
    proto?: ServiceEventEmitter
): IpcBusService {
    const logger = Logger.service ? new ConsoleLogger() : undefined;
    return createIpcBusService(client, serviceName, serviceImpl, proto ?? EventEmitter.prototype, logger, options);
}

export function newIpcBusServiceProxy(
    client: IpcBusClient,
    serviceName: string,
    options?: ServiceProxyConnectOptions,
    emitter?: ServiceEventEmitter
): IpcBusServiceProxy {
    const logger = Logger.service ? new ConsoleLogger() : undefined;
    return createIpcBusServiceProxy(client, serviceName, emitter ?? new EventEmitter(), options, logger);
}
