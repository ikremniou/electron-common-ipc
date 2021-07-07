import { EventEmitter } from 'events';

import type * as Client from './IpcBusClient';

import type { IpcBusTransport } from './IpcBusTransport';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusClientImpl extends EventEmitter implements Client.IpcBusClient, IpcBusTransport.Client {
    protected _peer: Client.IpcBusPeer;
    protected _transport: IpcBusTransport;

    protected _connectCloseState: IpcBusUtils.ConnectCloseState<void>;

    constructor(transport: IpcBusTransport) {
        super();
        super.setMaxListeners(0);
        this._transport = transport;
        this._connectCloseState = new IpcBusUtils.ConnectCloseState<void>();
    }

    get peer(): Client.IpcBusPeer | null {
        return this._peer;
    }

    createDirectChannel(): string {
        return this._transport.createDirectChannel(this);
    }
 
    createResponseChannel(): string {
        return this._transport.createDirectChannel(this);
    }

    connect(arg1: Client.IpcBusClient.ConnectOptions | string | number, arg2?: Client.IpcBusClient.ConnectOptions | string, arg3?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._connectCloseState.connect(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            return this._transport.connect(this, options)
            .then((peer) => {
                this._peer = peer;
                const eventNames = this.eventNames();
                for (let i = 0, l = eventNames.length; i < l; ++i) {
                    const eventName = eventNames[i] as string;
                    this._transport.addChannel(this, eventName, this.listenerCount(eventName));
                }
            });
        });
    }

    close(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            return this._transport.close(this, options)
            .then(() => {
                this._peer = null;
            });
        });
    }

    send(channel: string, ...args: any[]): boolean {
        // in nodejs eventEmitter, undefined is converted to 'undefined'
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.postMessage(this, undefined, channel, args);
        return this._connectCloseState.connected;
    }

    sendTo(target: Client.IpcBusPeer | Client.IpcBusPeerProcess, channel: string, ...args: any[]): boolean {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.postMessage(this, target, channel, args);
        return this._connectCloseState.connected;
    }

    request(channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.postRequestMessage(this, undefined, channel, timeoutDelay, args);
    }

    requestTo(target: Client.IpcBusPeer | Client.IpcBusPeerProcess, channel: string, timeoutDelay: number, ...args: any[]): Promise<Client.IpcBusRequestResponse> {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.postRequestMessage(this, target, channel, timeoutDelay, args);
    }

    postMessage(channel: string, message: any, messagePorts?: Client.IpcMessagePortType[]): void {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.postMessage(this, undefined, channel, [message], messagePorts);
    }

    postMessageTo(target: Client.IpcBusPeer | Client.IpcBusPeerProcess, channel: string, message: any, messagePorts?: Client.IpcMessagePortType[]): void {
        channel = IpcBusUtils.CheckChannel(channel);
        return this._transport.postMessage(this, target, channel, [message], messagePorts);
    }

    override emit(event: string, ...args: any[]): boolean {
        event = IpcBusUtils.CheckChannel(event);
        this._transport.postMessage(this, undefined, event, args);
        return this._connectCloseState.connected;
    }
 
    override on(channel: string, listener: Client.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    override off(channel: string, listener: Client.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    override addListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.addListener(channel, listener);
    }

    override removeListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.removeChannel(this, channel);
        return super.removeListener(channel, listener);
    }

    override once(channel: string, listener: Client.IpcBusListener): this {
        // addListener will be automatically called by NodeJS
        // removeListener will be automatically called by NodeJS when callback has been triggered
        return super.once(channel, listener);
    }

    override removeAllListeners(channel?: string): this {
        if (arguments.length === 1) {
            channel = IpcBusUtils.CheckChannel(channel);
        }
        this._transport.removeChannel(this, channel, true);
        return super.removeAllListeners(channel);
    }

    override prependListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependListener(channel, listener);
    }

    override prependOnceListener(channel: string, listener: Client.IpcBusListener): this {
        channel = IpcBusUtils.CheckChannel(channel);
        this._transport.addChannel(this, channel);
        return super.prependOnceListener(channel, listener);
    }
}
