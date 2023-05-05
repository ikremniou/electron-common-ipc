import { CastToMessagePort } from './message-ports';
import { CreateMessageTarget, CreateTargetChannel } from '../contract/command-helpers';
import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { CheckTimeout } from '../utils';
import { DeferredRequestPromise } from '../utils/deferred-request';

import type { ClientConnectOptions, IpcBusEvent, IpcBusRequestResponse } from './bus-client';
import type { IpcBusConnector, IpcBusConnectorClient, PostCommandFunction, PostMessageFunction } from './bus-connector';
import type { IpcBusTransport, IpcBusTransportClient } from './bus-transport';
import type { BusMessagePort } from './message-ports';
import type { IpcBusCommand, IpcBusCommandBase } from '../contract/ipc-bus-command';
import type { IpcBusMessage, MessageRequest } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { QueryStateTransport } from '../contract/query-state';
import type { Logger } from '../log/logger';
import type { MessageStamp } from '../log/message-stamp';
import type { UuidProvider } from '../utils/uuid';
import type { IpcPacketBufferCore } from 'socket-serializer';

export abstract class IpcBusTransportImpl implements IpcBusTransport, IpcBusConnectorClient {
    protected _logActivate: boolean;

    protected _requestFunctions: Map<string, DeferredRequestPromise>;
    protected _postCommand: PostCommandFunction;
    protected _postMessage: PostMessageFunction;
    protected _postRequestMessage: Function;
    private _closeHandler: () => void;

    constructor(
        public readonly connector: IpcBusConnector,
        private readonly _uuid: UuidProvider,
        private readonly _stamp?: MessageStamp,
        protected readonly _logger?: Logger
    ) {
        this._requestFunctions = new Map();
        this._postMessage = this._postCommand = this._postRequestMessage = this._deadMessageHandler;
    }

    onLogReceived(_ipcResponse: IpcBusMessage, _args: unknown[], _ipcPacketBufferCore?: IpcPacketBufferCore): void {}

    onConnectorCommandBase(ipcCommandBase: IpcBusCommandBase, ipcPacketBufferCore?: IpcPacketBufferCore): void {
        switch (ipcCommandBase.kind) {
            case IpcBusCommandKind.SendMessage:
                this.onMessageReceived(false, ipcCommandBase as IpcBusMessage, undefined, ipcPacketBufferCore);
                break;
            case IpcBusCommandKind.RequestResponse:
                this.onRequestResponseReceived(false, ipcCommandBase as IpcBusMessage, undefined, ipcPacketBufferCore);
                break;
            case IpcBusCommandKind.LogRoundtrip:
                this.onLogReceived(ipcCommandBase as IpcBusMessage, undefined, ipcPacketBufferCore);
                break;
            case IpcBusCommandKind.QueryState: {
                this.queryConnectorState(ipcCommandBase as IpcBusCommand);
                this.queryTransportState(ipcCommandBase as IpcBusCommand);
                break;
            }
            default:
                break;
        }
    }

    onRequestResponseReceived(
        local: boolean,
        ipcResponse: IpcBusMessage,
        args: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore
    ): boolean {
        const deferredRequest = this._requestFunctions.get(ipcResponse.channel);
        if (deferredRequest) {
            this._requestFunctions.delete(ipcResponse.request.id);
            args = args || ipcPacketBufferCore.parseArrayAt(1);
            if (this._logActivate) {
                const message = this._stamp?.ackResponse(ipcResponse, local, deferredRequest.client.peer);
                this.connector.postMessage(message);
            }
            this._logger?.info(
                `[IPCBusTransport] Emit request response received on channel` +
                    ` '${ipcResponse.channel}' from peer #${ipcResponse.peer.name}-${ipcResponse.peer.id}` +
                    ` (replyChannel '${ipcResponse.request.channel}')`
            );
            deferredRequest.settled(ipcResponse, args);
            return true;
        }
        return false;
    }

    // IpcConnectorClient~getArgs
    onConnectorArgsReceived(ipcMessage: IpcBusMessage, args: unknown[], messagePorts?: BusMessagePort[]): boolean {
        switch (ipcMessage.kind) {
            case IpcBusCommandKind.SendMessage:
                return this.onMessageReceived(false, ipcMessage, args, undefined, messagePorts);
            case IpcBusCommandKind.RequestResponse:
                return this.onRequestResponseReceived(false, ipcMessage, args, undefined);
        }
        return false;
    }

    // IpcConnectorClient
    onConnectorPacketReceived(
        ipcMessage: IpcBusMessage,
        ipcPacketBufferCore: IpcPacketBufferCore,
        messagePorts?: BusMessagePort[]
    ): boolean {
        switch (ipcMessage.kind) {
            case IpcBusCommandKind.SendMessage:
                return this.onMessageReceived(false, ipcMessage, undefined, ipcPacketBufferCore, messagePorts);
            case IpcBusCommandKind.RequestResponse:
                return this.onRequestResponseReceived(false, ipcMessage, undefined, ipcPacketBufferCore);
        }
        return false;
    }

    // IpcConnectorClient
    onConnectorShutdown() {
        // Cut connection
        this._postMessage = this._postCommand = this._postRequestMessage = this._deadMessageHandler;
        // no messages to send, it is too late
        this._closeHandler?.();
        this._closeHandler = undefined;
    }

    // IpcConnectorClient
    onConnectorBeforeShutdown() {
        this.cancelRequest();
    }

    postMessage(
        client: IpcBusTransportClient,
        target: IpcBusPeer | undefined,
        channel: string,
        args: unknown[],
        messagePorts?: BusMessagePort[]
    ): void {
        const ipcMessage: IpcBusMessage = {
            kind: IpcBusCommandKind.SendMessage,
            channel,
            peer: client.peer,
            target: target && CreateMessageTarget(target),
        };

        if (this._logActivate) {
            this._stamp?.stampMessage(ipcMessage);
        }
        // Broadcast locally
        if (!this.onMessageReceived(true, ipcMessage, args, undefined, messagePorts)) {
            // Broadcast globally
            this._postMessage(ipcMessage, args, messagePorts);
        }
    }

    postRequestMessage(
        client: IpcBusTransportClient,
        target: IpcBusPeer | undefined,
        channel: string,
        timeoutDelay: number,
        args: unknown[]
    ): Promise<IpcBusRequestResponse> {
        timeoutDelay = CheckTimeout(timeoutDelay);
        const ipcBusMessageRequest: MessageRequest = {
            channel,
            id: this._uuid(),
        };
        const deferredRequest = new DeferredRequestPromise(client, ipcBusMessageRequest, this._logger);
        // Register locally
        this._requestFunctions.set(ipcBusMessageRequest.id, deferredRequest);
        const ipcRequest: IpcBusMessage = {
            kind: IpcBusCommandKind.SendMessage,
            channel,
            peer: client.peer,
            target: target && CreateMessageTarget(target),
            request: ipcBusMessageRequest,
        };

        if (this._logActivate) {
            this._stamp?.stampMessage(ipcRequest);
        }
        // Broadcast locally
        if (!this.onMessageReceived(true, ipcRequest, args, undefined)) {
            // Broadcast globally, if not resolved by local clients
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
            this._postRequestMessage(ipcRequest, args);
        }
        return deferredRequest.promise;
    }

    connect(_client: IpcBusTransportClient | undefined, options: ClientConnectOptions): Promise<IpcBusPeer> {
        return this.connector
            .handshake(this, options)
            .then((handshake) => {
                this._stamp?.markHandshake(handshake);
                this._logActivate = handshake.logLevel > 0;
                // Connect to ... connector
                this._postCommand = this.connector.postCommand.bind(this.connector);
                this._postMessage = this.connector.postMessage.bind(this.connector);
                this._postRequestMessage = this.connector.postMessage.bind(this.connector);
                return handshake;
            })
            .then((handshake) => {
                return handshake.peer;
            });
    }

    close(_client: IpcBusTransportClient | undefined, options?: ClientConnectOptions): Promise<void> {
        this._closeHandler = undefined;
        return this.connector.shutdown(options);
    }

    createDirectChannel(client: IpcBusTransportClient): string {
        return CreateTargetChannel(client.peer, this._uuid());
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return this.connector.isTarget(ipcMessage);
    }

    onClosed(handler: () => void): void {
        this._closeHandler = handler;
    }

    // We assume prior to call this function client is not empty and have listeners for this channel !!
    protected _onClientMessageReceived(
        client: IpcBusTransportClient,
        local: boolean,
        ipcMessage: IpcBusMessage,
        args?: unknown[],
        messagePorts?: BusMessagePort[]
    ): boolean {
        const listeners = client.listeners(ipcMessage.channel);
        if (listeners.length === 0) {
            return false;
        }
        // this._logger?.info(`[IPCBusTransport] Emit message received on channel \
        //    '${ipcCommand.channel}' from peer #${ipcCommand.peer.name}`);
        if (this._logActivate) {
            const message = this._stamp?.ackMessage(ipcMessage, local, client.peer);
            this.connector.postMessage(message, args);
        }
        let messageHandled = false;
        if (ipcMessage.target && ipcMessage.target.id) {
            if (ipcMessage.target.id !== client.peer.id) {
                return false;
            }
            messageHandled = true;
        }
        const ipcBusEvent: IpcBusEvent = { channel: ipcMessage.channel, sender: ipcMessage.peer };
        if (ipcMessage.request) {
            const settled = (resolve: boolean, argsResponse: unknown[]) => {
                // Reset functions as only one response per request is accepted
                ipcBusEvent.request.resolve = () => {};
                ipcBusEvent.request.reject = () => {};
                const ipcResponse: IpcBusMessage = {
                    kind: IpcBusCommandKind.RequestResponse,
                    channel: ipcMessage.request.id,
                    peer: client.peer,
                    target: CreateMessageTarget(ipcMessage.peer),
                    request: ipcMessage.request,
                };
                ipcMessage.request.resolve = resolve;
                messageHandled = true;
                if (this._logActivate) {
                    this._stamp?.stampResponse(ipcResponse, ipcMessage);
                }
                if (local) {
                    this.onRequestResponseReceived(true, ipcResponse, argsResponse);
                } else {
                    this._postRequestMessage(ipcResponse, argsResponse);
                }
            };
            ipcBusEvent.request = {
                resolve: (payload: Object | string) => {
                    this._logger?.info(
                        `[IPCBusTransport] Resolve request received on channel '${ipcMessage.channel}' from` +
                            ` peer #${ipcMessage.peer.name}-${ipcMessage.peer.id} - payload: ${JSON.stringify(payload)}`
                    );
                    settled(true, [payload]);
                },
                reject: (err: string | Error) => {
                    let errResponse: string;
                    if (typeof err === 'string') {
                        errResponse = err;
                    } else {
                        errResponse = JSON.stringify(err);
                    }
                    this._logger?.info(
                        `[IPCBusTransport] Reject request. Channel ${ipcMessage.channel}' from` +
                            ` peer #${ipcMessage.peer.name}-${ipcMessage.peer.id} - err: ${errResponse}`
                    );
                    settled(false, [err]);
                },
            };
        } else if (messagePorts && messagePorts.length) {
            ipcBusEvent.ports = messagePorts.map(CastToMessagePort);
        }
        // Seems spread operator or call function does not like args=undefined !
        if (args) {
            for (let i = 0, l = listeners.length; i < l; ++i) {
                listeners[i].call(client, ipcBusEvent, ...args);
            }
        } else {
            for (let i = 0, l = listeners.length; i < l; ++i) {
                listeners[i].call(client, ipcBusEvent);
            }
        }
        return messageHandled;
    }

    protected cancelRequest(client?: IpcBusTransportClient): void {
        this._logger?.info(`[BusTransport] Cancel requests for '${client?.peer.id ?? this.connector.peer.id}' peer`);
        this._requestFunctions.forEach((request, key) => {
            if (client === undefined || client === request.client) {
                request.timeout();
                this._requestFunctions.delete(key);
                // if (this._logActivate) {
                //     this._connector.logMessageSend(undefined, );
                // }
            }
        });
    }

    private queryTransportState(ipcCommand: IpcBusCommand) {
        const queryState = this.queryState();
        this._logger?.info(`[BusTransport] query state transport: ${JSON.stringify(queryState, undefined, 4)}`);
        this._postCommand({
            kind: IpcBusCommandKind.QueryStateResponse,
            data: {
                id: ipcCommand.channel,
                queryState,
            },
        } as IpcBusCommand);
    }

    private queryConnectorState(ipcCommand: IpcBusCommand): void {
        const queryState = this.connector.queryState();
        this._logger?.info(`[BusTransport] query state connector: ${JSON.stringify(queryState, undefined, 4)}`);
        this._postCommand({
            kind: IpcBusCommandKind.QueryStateResponse,
            data: {
                id: ipcCommand.channel,
                queryState,
            },
        } as IpcBusCommand);
    }

    private _deadMessageHandler(ipcCommand: IpcBusCommand): void {
        this._logger?.error(`[BusTransport] dead handler not managed ${JSON.stringify(ipcCommand, undefined, 4)}`);
    }

    abstract getChannels(): string[];
    abstract addChannel(client: IpcBusTransportClient, channel: string, count?: number): void;
    abstract removeChannel(client: IpcBusTransportClient, channel?: string, all?: boolean): void;
    abstract queryState(): QueryStateTransport;
    abstract onMessageReceived(
        local: boolean,
        ipcMessage: IpcBusMessage,
        args?: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore,
        messagePorts?: BusMessagePort[]
    ): boolean;
}
