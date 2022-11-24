import type { EventEmitterLike } from '../client/event-emitter-like';
import type { IpcTimeoutOptions } from '../client/ipc-connect-options';
import type { ServiceStatus } from './bus-service';

export interface ServiceProxyConnectOptions extends IpcTimeoutOptions {}
export interface ServiceProxyCreateOptions extends IpcTimeoutOptions {}

// (client: IpcBusClient, serviceName: string, options?: CreateOptions): IpcBusServiceProxy | null ;
// 

export interface IpcBusServiceProxy extends EventEmitterLike<Function> {
    readonly isStarted: boolean;
    readonly wrapper: Object;

    connect<R>(options?: ServiceProxyConnectOptions): Promise<R>;
    close(): Promise<void>;

    getStatus(): Promise<ServiceStatus>;
    getWrapper<R>(): R;

    // Kept for backward
    call<R>(name: string, ...args: any[]): Promise<R>;
    apply<R>(name: string, args?: unknown[]): Promise<R>;

    // Do wait for the stub response, equivalent to call/apply.
    requestCall<R>(name: string, ...args: any[]): Promise<R>;
    requestApply<R>(name: string, args?: unknown[]): Promise<R>;

    // Do not wait for the stub response, more efficient.
    sendCall(name: string, ...args: any[]): void;
    sendApply(name: string, args?: unknown[]): void;

    // onServiceStart(handler: () => void);
    // onServiceStop(handler: () => void);
}
