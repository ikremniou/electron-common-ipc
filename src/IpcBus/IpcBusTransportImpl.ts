import { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';

import type * as Client from './IpcBusClient';
import * as IpcBusUtils from './IpcBusUtils';
import { IpcBusCommand as IpcBusCommand, IpcBusMessage } from './IpcBusCommand';

import type { IpcBusTransport } from './IpcBusTransport';
import type { IpcBusConnector, PostCommandFunction, PostMessageFunction } from './IpcBusConnector';
import { JSONParserV1 } from 'json-helpers';

/** @internal */
class DeferredRequestPromise {
    public promise: Promise<Client.IpcBusRequestResponse>;

    public resolve: (value: Client.IpcBusRequestResponse) => void;
    public reject: (err: Client.IpcBusRequestResponse) => void;

    client: IpcBusTransport.Client;
    request: IpcBusCommand.Request;

    private _settled: boolean;

    constructor(client: IpcBusTransport.Client, request: IpcBusCommand.Request) {
        this.client = client;
        this.request = request;
        this.promise = new Promise<Client.IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        })
        // Prevent unhandled rejected promise
        this.promise.catch(() => { });
        this._settled = false;
    }

    isSettled(): boolean {
        return this._settled;
    }

    settled(ipcResponse: IpcBusMessage, args: any[]) {
        if (this._settled === false) {
            const ipcBusEvent: Client.IpcBusEvent = { channel: ipcResponse.request.channel, sender: ipcResponse.peer };
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcResponse.request.id}`);
            try {
                if (ipcResponse.request.resolve === true) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    this.resolve(response);
                }
                else {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${args[0]}`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: args[0] };
                    this.reject(response);
                }
            }
            catch (err) {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${err}`);
                const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err };
                this.reject(response);
            }
            this._settled = true;
        }
    }

    timeout(): void {
        const response: Client.IpcBusRequestResponse = {
            event: {
                channel: this.request.channel,
                sender: this.client.peer
            },
            err: 'timeout'
        };
        this.reject(response);
    }
}

/** @internal */
export abstract class IpcBusTransportImpl implements IpcBusTransport, IpcBusConnector.Client {
    private static s_clientNumber: number = 0;

    protected _connector: IpcBusConnector;

    protected _logActivate: boolean;

    protected _requestFunctions: Map<string, DeferredRequestPromise>;
    protected _postCommand: PostCommandFunction;
    protected _postMessage: PostMessageFunction;

    constructor(connector: IpcBusConnector) {
        this._connector = connector;

        this._requestFunctions = new Map();
        this._postMessage = this._postCommand = this._deadMessageHandler as any;
    }

    private _deadMessageHandler(ipcCommand: IpcBusCommand, args?: any[]): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(`IPCBUS: not managed ${JSON.stringify(ipcCommand, null, 4)}`);
    }

    protected createPeer(process: Client.IpcBusProcess, name?: string): Client.IpcBusPeer {
        const peer: Client.IpcBusPeer = {
            id: `${process.type}.${IpcBusUtils.CreateUniqId()}`,
            process,
            name: ''
        }
        peer.name = this.generateName(peer, name);
        return peer;
    }

    protected generateName(peer: Client.IpcBusPeer, name?: string): string {
        if (name == null) {
            // static part
            name = `${peer.process.type}`;
            if (peer.process.wcid) {
                name += `-${peer.process.wcid}`;
            }
            if (peer.process.frameid) {
                name += `-f${peer.process.frameid}`;
            }
            if (peer.process.rid && (peer.process.rid !== peer.process.wcid)) {
                name += `-r${peer.process.rid}`;
            }
            if (peer.process.pid) {
                name += `-p${peer.process.pid}`;
            }
            // dynamic part
            ++IpcBusTransportImpl.s_clientNumber;
            name += `.${IpcBusTransportImpl.s_clientNumber}`;
        }
        return name;
    }

    // We assume prior to call this function client is not empty and have listeners for this channel !!
    protected _onClientMessageReceived(client: IpcBusTransport.Client, local: boolean, ipcMessage: IpcBusMessage, args?: any[], messagePorts?: Client.IpcBusMessagePort[]): boolean {
        const listeners = client.listeners(ipcMessage.channel);
        if (listeners.length === 0) {
            return false;
        }
        let messageHandled = false;
        if (ipcMessage.target && ipcMessage.target.peerid) {
            if (ipcMessage.target.peerid !== client.peer.id) {
                return false;
            }
            messageHandled = true;
        }
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit message received on channel '${ipcCommand.channel}' from peer #${ipcCommand.peer.name}`);
        // let logGetMessage: IpcBusCommand.Log;
        // if (this._logActivate) {
        //     logGetMessage = this._connector.logMessageGet(client.peer, local, ipcCommand, args);
        // }
        const ipcBusEvent: Client.IpcBusEvent = { channel: ipcMessage.channel, sender: ipcMessage.peer, ports: messagePorts };
        if (ipcMessage.request) {
            const settled = (resolve: boolean, argsResponse: any[]) => {
                // Reset functions as only one response per request is accepted
                ipcBusEvent.request.resolve = () => { };
                ipcBusEvent.request.reject = () => { };
                const ipcResponse: IpcBusMessage = {
                    kind: IpcBusCommand.Kind.RequestResponse,
                    channel: ipcMessage.request.id,
                    peer: client.peer,
                    target: IpcBusUtils.CreateMessageTarget(ipcMessage.peer),
                    request: ipcMessage.request
                };
                ipcMessage.request.resolve = resolve;
                // Is it a local request ?
                // if (this._logActivate) {
                //    this._connector.logMessageSend(logGetMessage, ipcResponse);
                // } 
                messageHandled = true;
                if (local) {
                    this._onResponseReceived(true, ipcResponse, argsResponse);
                    // if (this._onResponseReceived(true, ipcResponse, argsResponse) && logGetMessage) {
                    //     this._connector.logLocalMessage(client.peer, ipcResponse, argsResponse);
                    // }
                }
                else {
                    this._postMessage(ipcResponse, argsResponse);
                }
            }
            ipcBusEvent.request = {
                resolve: (payload: Object | string) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Resolve request received on channel '${ipcMessage.channel}' from peer #${ipcMessage.peer.name} - payload: ${JSON.stringify(payload)}`);
                    settled(true, [payload]);
                },
                reject: (err: string) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Reject request received on channel '${ipcMessage.channel}' from peer #${ipcMessage.peer.name} - err: ${JSON.stringify(err)}`);
                    settled(false, [err]);
                }
            };
        }
        for (let i = 0, l = listeners.length; i < l; ++i) {
            listeners[i].call(client, ipcBusEvent, ...args);
        }
        return messageHandled;
    }

    protected _onResponseReceived(local: boolean, ipcResponse: IpcBusMessage, args: any[], ipcPacketBufferCore?: IpcPacketBufferCore): boolean {
        const deferredRequest = this._requestFunctions.get(ipcResponse.channel);
        if (deferredRequest) {
            args = args || ipcPacketBufferCore.parseArrayAt(1);
            // if (this._logActivate) {
            //     this._connector.logMessageGet(deferredRequest.client.peer, local, ipcResponse, args);
            // }
            // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Emit request response received on channel '${ipcCommand.channel}' from peer #${ipcCommand.peer.name} (replyChannel '${ipcCommand.request.replyChannel}')`);
            this._requestFunctions.delete(ipcResponse.request.id);
            deferredRequest.settled(ipcResponse, args);
            return true;
        }
        return false;
    }

    // IpcConnectorClient~getArgs
    onConnectorArgsReceived(ipcMessage: IpcBusMessage, args: any[], messagePorts?: Client.IpcBusMessagePort[]): boolean {
        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage:
                return this._onMessageReceived(false, ipcMessage, args, messagePorts);
            case IpcBusCommand.Kind.RequestResponse:
                return this._onResponseReceived(false, ipcMessage, args);
        }
        return false;
    }

    // IpcConnectorClient
    onConnectorPacketReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore, messagePorts?: Client.IpcBusMessagePort[]): boolean {
        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const args = ipcPacketBufferCore.parseArrayAt(1);
                return this._onMessageReceived(false, ipcMessage, args, messagePorts);
            }
            case IpcBusCommand.Kind.RequestResponse:
                return this._onResponseReceived(false, ipcMessage, undefined, ipcPacketBufferCore);
        }
        return false;
    }

    // IpcConnectorClient
    onConnectorRawDataReceived(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData, messagePorts?: Client.IpcBusMessagePort[]): boolean {
        // Prevent to create a huge buffer if not needed, keep working with a set of buffers
        const ipcPacketBufferCore = rawData.buffer ? new IpcPacketBuffer(rawData) : new IpcPacketBufferList(rawData);
        ipcPacketBufferCore.JSON = JSONParserV1;
        return this.onConnectorPacketReceived(ipcMessage, ipcPacketBufferCore, messagePorts);
    }

    // IpcConnectorClient
    onConnectorShutdown() {
        // Cut connection
        this._postMessage = this._postCommand = this._deadMessageHandler as any;
        // no messages to send, it is too late
    }

    // IpcConnectorClient
    onConnectorBeforeShutdown() {
        this.cancelRequest();
    }

    postMessage(client: IpcBusTransport.Client, target: Client.IpcBusPeer | Client.IpcBusPeerProcess | undefined, channel: string, args: any[], ipcPorts?: Client.IpcBusMessagePort[]): void {
        const ipcMessage: IpcBusMessage = {
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            target: IpcBusUtils.CreateMessageTarget(target)
        }
        // if (this._logActivate) {
        //     this._connector.logMessageSend(null, ipcMessage);
        // }
        // Broadcast locally
        if (this._onMessageReceived(true, ipcMessage, args, ipcPorts)) {
            // this._connector.logLocalMessage(client.peer, ipcMessage, args);
        }
        // If not resolved by local clients
        else {
            this._postMessage(ipcMessage, args, ipcPorts);
        }
    }

    protected cancelRequest(client?: IpcBusTransport.Client): void {
        this._requestFunctions.forEach((request, key) => {
            if ((client == null) || (client === request.client)) {
                request.timeout();
                this._requestFunctions.delete(key);
                // if (this._logActivate) {
                //     this._connector.logMessageSend(null, );
                // }
            }
        });
    }

    requestMessage(client: IpcBusTransport.Client, target: Client.IpcBusPeer | Client.IpcBusPeerProcess | undefined, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse> {
        timeoutDelay = IpcBusUtils.checkTimeout(timeoutDelay);
        const ipcBusMessageRequest: IpcBusCommand.Request = {
            channel,
            id: IpcBusUtils.CreateUniqId()
        };
        const deferredRequest = new DeferredRequestPromise(client, ipcBusMessageRequest);
        // Register locally
        this._requestFunctions.set(ipcBusMessageRequest.id, deferredRequest);
        const ipcRequest: IpcBusMessage = {
            kind: IpcBusCommand.Kind.SendMessage,
            channel,
            peer: client.peer,
            target: IpcBusUtils.CreateMessageTarget(target),
            request: ipcBusMessageRequest
        }
        // let logSendMessage: IpcBusCommand.Log;
        // if (this._logActivate) {
        //     logSendMessage = this._connector.logMessageSend(null, ipcMessage);
        // }
        // Broadcast locally
        if (this._onMessageReceived(true, ipcRequest, args)) {
            // this._connector.logLocalMessage(client.peer, ipcMessage, args);
        }
        // If not resolved by local clients
        else {
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusMessageRequest.id)) {
                        deferredRequest.timeout();
                        // if (logSendMessage) {
                        //     this._connector.logMessageSend(logSendMessage, );
                        // }
                    }
                }, timeoutDelay);
            }
            this._postMessage(ipcRequest, args);
        }
        return deferredRequest.promise;
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return this._connector.handshake(this, options)
            .then((handshake) => {
                this._logActivate = handshake.logLevel > 0;
                // Connect to ... connector
                this._postCommand = this._connector.postCommand.bind(this._connector);
                this._postMessage = this._connector.postMessage.bind(this._connector);
                return handshake;
            })
            .then((handshake) => {
                const peer = this.createPeer(handshake.process, options.peerName);
                return peer;
            });
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._connector.shutdown(options);
    }

    createDirectChannel(client: IpcBusTransport.Client): string {
        return IpcBusUtils.CreateTargetChannel(client.peer);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return this._connector.isTarget(ipcMessage);
    }

    abstract getChannels(): string[];

    abstract addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void;
    abstract removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void;

    protected abstract _onMessageReceived(local: boolean, ipcBusMessage: IpcBusMessage, args: any[], messagePorts?: Client.IpcBusMessagePort[]): boolean;
}
