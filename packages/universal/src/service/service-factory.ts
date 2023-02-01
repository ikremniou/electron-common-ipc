import { IpcBusServiceImpl } from './bus-service-impl';
import { IpcBusServiceProxyImpl } from './bus-service-proxy-impl';

import type { IpcBusService, ServiceEventEmitter } from './bus-service';
import type { IpcBusServiceProxy, ServiceProxyCreateOptions } from './bus-service-proxy';
import type { IpcBusClient } from '../client/bus-client';
import type { Logger } from '../log/logger';

export function createIpcBusService(
    client: IpcBusClient,
    serviceName: string,
    instance: unknown,
    emitterProto?: ServiceEventEmitter,
    logger?: Logger
): IpcBusService {
    return new IpcBusServiceImpl(client, serviceName, instance, emitterProto, logger);
}

export function createIpcBusServiceProxy(
    client: IpcBusClient,
    serviceName: string,
    emitter?: ServiceEventEmitter,
    options?: ServiceProxyCreateOptions,
    logger?: Logger
): IpcBusServiceProxy {
    return new IpcBusServiceProxyImpl(client, serviceName, emitter, options, logger);
}
