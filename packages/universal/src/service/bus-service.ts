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

// interface CreateOptions {
//    depth?: number;
// }

 //  (client: IpcBusClient, serviceName: string, serviceImpl: any, options?: CreateOptions): IpcBusService | null ;

export interface IpcBusService {
    start(): void;
    stop(): void;
    registerCallHandler(name: string, handler: Function): void;
    sendEvent(eventName: string, ...args: any[]): void;
}
