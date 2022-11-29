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

export interface ServiceStatus {
    started: boolean;
    callHandlers: string[];
    supportEventEmitter: boolean;
}

export type ServiceEventEmitter = EventEmitterLike<Function>;

export interface IpcBusService {
    start(): void;
    stop(): void;
    registerCallHandler(name: string, handler: Function): void;
    unregisterCallHandler(name: string): void;
    sendEvent(eventName: string, ...args: any[]): void;
}
