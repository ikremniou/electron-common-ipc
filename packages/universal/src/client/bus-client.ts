import type { ChannelEmitterLike } from './event-emitter-like';
import type { CloseFunction, ConnectFunction, IpcConnectOptions, IpcTimeoutOptions } from './ipc-connect-options';
import type { BusMessagePort } from './message-ports';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';

export interface IpcBusRequest {
    resolve(payload: unknown): void;
    reject(err: unknown): void;
}

export interface IpcBusEvent {
    readonly channel: string;
    readonly sender: IpcBusPeer;
    ports?: BusMessagePort[];
    request?: IpcBusRequest;
}

export interface IpcBusRequestResponse {
    readonly event: IpcBusEvent;
    readonly payload?: unknown;
    readonly err?: string;
}

export interface IpcBusListener {
    (event: IpcBusEvent, ...args: any[]): void;
}

export interface ClientConnectOptions extends IpcConnectOptions {
    peerName?: string;
    socketBuffer?: number;
}

export type IpcBusClientEmitter = ChannelEmitterLike<IpcBusListener>;

export interface IpcBusClient extends IpcBusClientEmitter {
    readonly peer: IpcBusPeer;

    connect: ConnectFunction<ClientConnectOptions>;
    close: CloseFunction<IpcTimeoutOptions>;

    createDirectChannel(): string;
    /**
     * @deprecated legacy
     */
    createResponseChannel(): string;

    send(channel: string, ...args: any[]): boolean;
    sendTo(target: IpcBusPeer, channel: string, ...args: any[]): boolean;
    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusRequestResponse>;
    requestTo(target: IpcBusPeer, channel: string, timeout: number, ...args: any[]): Promise<IpcBusRequestResponse>;

    postMessage(channel: string, message: unknown, messagePorts?: BusMessagePort[]): void;
    postMessageTo(target: IpcBusPeer, channel: string, message: unknown, messagePorts?: BusMessagePort[]): void;
    onClosed(handler: () => void): void;
}

export type { IpcTimeoutOptions as ClientCloseOptions } from './ipc-connect-options';
