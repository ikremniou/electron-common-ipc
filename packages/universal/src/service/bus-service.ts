import type { EventEmitterLike } from '../client/event-emitter-like';

export interface IpcBusServiceCall {
    handlerName: string;
    args: unknown[];
}

export interface IpcBusServiceEvent {
    eventName: string;
    args: unknown[];
}

export interface IpcBusServiceEventHandler {
    (event: IpcBusServiceEvent): void;
}

export interface BusServiceOptions {
    /**
     * The 'direct' enforces the proxy to send requests, calls, events
     * using sendTo and requestTo directly to the node that hosts the
     * service. If this flag is used then it must be only one service
     * defined with the same name in the IPC environment.
     */
    direct?: boolean;
}

export interface ServiceStatus extends Pick<BusServiceOptions, 'direct'> {
    started: boolean;
    callHandlers: string[];
    supportEventEmitter: boolean;
}

export type ServiceCallback = (...args: any[]) => void;
export type ServiceEventEmitter = EventEmitterLike<ServiceCallback>;

export interface IpcBusService {
    start(): void;
    stop(): void;
    registerCallHandler(name: string, handler: ServiceCallback): void;
    unregisterCallHandler(name: string): void;
    sendEvent(eventName: string, ...args: any[]): void;
}
