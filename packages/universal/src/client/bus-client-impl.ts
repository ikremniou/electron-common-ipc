import { CheckChannel, CheckConnectOptions } from '../utils';
import { ConnectionState } from '../utils/connection-state';

import type {
    ClientCloseOptions,
    ClientConnectOptions,
    IpcBusClient,
    IpcBusListener,
    IpcBusRequestResponse,
} from './bus-client';
import type { IpcBusTransport, IpcBusTransportClient } from './bus-transport';
import type { EventEmitterLike } from './event-emitter-like';
import type { BusMessagePort } from './message-ports';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';

export class IpcBusClientImpl implements IpcBusClient, IpcBusTransportClient {
    private _peer: IpcBusPeer | undefined;
    private readonly _connectCloseState: ConnectionState;

    get peer(): IpcBusPeer | undefined {
        return this._peer;
    }

    constructor(
        private readonly _emitter: EventEmitterLike<IpcBusListener>,
        private readonly _transport: IpcBusTransport
    ) {
        this._emitter.setMaxListeners?.(0);
        this._connectCloseState = new ConnectionState();
    }

    createDirectChannel(): string {
        return this._transport.createDirectChannel(this);
    }

    createResponseChannel(): string {
        return this._transport.createDirectChannel(this);
    }

    connect(
        arg1?: ClientConnectOptions | string | number,
        arg2?: ClientConnectOptions | string,
        arg3?: ClientConnectOptions
    ): Promise<void> {
        return this._connectCloseState.connect(() => {
            const options = CheckConnectOptions(arg1, arg2, arg3);
            return this._transport.connect(this, options).then((peer: IpcBusPeer) => {
                this._peer = peer;
                const eventNames = this._emitter.eventNames();
                for (let i = 0, l = eventNames.length; i < l; ++i) {
                    const eventName = eventNames[i] as string;
                    this._transport.addChannel(this, eventName, this._emitter.listenerCount(eventName));
                }
            });
        });
    }

    close(options?: ClientCloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            return this._transport.close(this, options).then(() => {
                this._peer = undefined;
            });
        });
    }

    send(channel: string, ...args: any[]): boolean {
        // in nodejs eventEmitter, undefined is converted to 'undefined'
        channel = CheckChannel(channel);
        this._transport.postMessage(this, undefined, channel, args);
        return this._connectCloseState.connected;
    }

    sendTo(target: IpcBusPeer, channel: string, ...args: any[]): boolean {
        channel = CheckChannel(channel);
        this._transport.postMessage(this, target, channel, args);
        return this._connectCloseState.connected;
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusRequestResponse> {
        channel = CheckChannel(channel);
        return this._transport.postRequestMessage(this, undefined, channel, timeoutDelay, args);
    }

    requestTo(
        target: IpcBusPeer,
        channel: string,
        timeoutDelay: number,
        ...args: any[]
    ): Promise<IpcBusRequestResponse> {
        channel = CheckChannel(channel);
        return this._transport.postRequestMessage(this, target, channel, timeoutDelay, args);
    }

    postMessage(channel: string, message: unknown, messagePorts?: BusMessagePort[]): void {
        channel = CheckChannel(channel);
        return this._transport.postMessage(this, undefined, channel, [message], messagePorts);
    }

    postMessageTo(target: IpcBusPeer, channel: string, message: unknown, messagePorts?: BusMessagePort[]): void {
        channel = CheckChannel(channel);
        return this._transport.postMessage(this, target, channel, [message], messagePorts);
    }

    onClosed(handler: () => void): void {
        this._transport.onClosed(handler);
    }

    setMaxListeners?(maxListeners: number): void {
        this._emitter.setMaxListeners?.(maxListeners);
    }

    listeners(eventName: string): Function[] {
        return this._emitter.listeners(eventName);
    }

    eventNames(): (symbol | string)[] {
        return this._emitter.eventNames();
    }

    listenerCount(eventName: string): number {
        return this._emitter.listenerCount(eventName);
    }

    emit(event: string, ...args: any[]): boolean {
        event = CheckChannel(event);
        this._transport.postMessage(this, undefined, event, args);
        return this._connectCloseState.connected;
    }

    on(channel: string, listener: IpcBusListener): EventEmitterLike<IpcBusListener> {
        return this.addListener(channel, listener);
    }

    off(channel: string, listener: IpcBusListener): EventEmitterLike<IpcBusListener> {
        return this.removeListener(channel, listener);
    }

    addListener(channel: string, listener: IpcBusListener): EventEmitterLike<IpcBusListener> {
        channel = CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return this._emitter.addListener(channel, listener);
    }

    removeListener(channel: string, listener: IpcBusListener): EventEmitterLike<IpcBusListener> {
        channel = CheckChannel(channel);
        this._transport.removeChannel(this, channel);
        return this._emitter.removeListener(channel, listener);
    }

    once(channel: string, listener: IpcBusListener): EventEmitterLike<IpcBusListener> {
        channel = CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return this._emitter.once(channel, (event, ...args) => {
            this._transport.removeChannel(this, channel);
            listener(event, ...args);
        });
    }

    removeAllListeners(channel?: string): EventEmitterLike<IpcBusListener> {
        if (arguments.length === 1) {
            channel = CheckChannel(channel);
        }
        this._transport.removeChannel(this, channel, true);
        return this._emitter.removeAllListeners(channel);
    }
}
