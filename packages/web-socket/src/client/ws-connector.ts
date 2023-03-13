import {
    CheckConnectOptions,
    executeInTimeout,
    IpcBusConnectorImpl,
    CheckTimeoutOptions,
} from '@electron-common-ipc/universal';
import { IpcPacketBufferList, BufferListReader, IpcPacketBuffer } from 'socket-serializer-ik';
import { BufferListWriterBase } from 'socket-serializer-ik/lib/buffer/bufferListWriter';
import { WebSocket } from 'ws';

import type {
    IpcBusProcessType,
    ClientConnectOptions,
    IpcBusConnectorClient,
    IpcBusMessage,
    ConnectorHandshake,
    IpcBusCommand,
    ClientCloseOptions,
    Logger,
    IpcBusCommandBase,
    UuidProvider,
    JsonLike,
} from '@electron-common-ipc/universal';
import type { RawData } from 'ws';

export class WsWriter extends BufferListWriterBase {
    buffer: Buffer;
    buffers: Buffer[];

    constructor(private readonly _socket: WebSocket) {
        super();
    }

    protected _appendBuffer(buffer: Buffer, _length: number): number {
        this._socket.send(buffer);
        return 0;
    }

    protected _appendBuffers(buffers: Buffer[], _totalLength: number): number {
        for (let i = 0; i < buffers.length; i++) {
            this._socket.send(buffers[i]);
        }
        return 0;
    }
}

export class WsConnector extends IpcBusConnectorImpl {
    private _socket?: WebSocket;
    private _writer?: WsWriter;
    private readonly _bufferListReader: BufferListReader;
    private readonly _packetIn: IpcPacketBufferList;
    private readonly _packetOut: IpcPacketBuffer;

    constructor(uuid: UuidProvider, json: JsonLike, contextType: IpcBusProcessType, private readonly _logger?: Logger) {
        super(uuid, contextType, 'connector-ws');

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = json;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = this._packetIn.JSON;

        this._onSocketData = this._onSocketData.bind(this);
        this._onSocketError = this._onSocketError.bind(this);
        this._onSocketClose = this._onSocketClose.bind(this);
    }

    public isTarget(ipcMessage: IpcBusMessage): boolean {
        return ipcMessage.target?.id === this._peer.id;
    }

    public handshake(client: IpcBusConnectorClient, options: ClientConnectOptions): Promise<ConnectorHandshake> {
        return this._connectCloseState.connect(() => {
            options = CheckConnectOptions(options);
            if (!options.port && !options.path) {
                throw new Error(`Connection options must include 'path' or 'port'`);
            }

            let onSocketError: (err: Error) => void;
            let onSocketClose: () => void;
            let onSocketOpen: () => void;

            const removeTempListeners = () => {
                this._socket.off('error', onSocketError);
                this._socket.off('close', onSocketClose);
                this._socket.off('open', onSocketOpen);
            };

            const fallbackReject = (message: string, reject: (err: Error) => void) => {
                removeTempListeners();
                this._detachSocket();
                this._logger?.error(message);
                reject(new Error(message));
            };

            return executeInTimeout(
                options.timeoutDelay,
                (resolve, reject) => {
                    options.host = options.host || '127.0.0.1';
                    const socketUrl = new URL(`ws://${options.host}:${options.port}`);
                    this._socket = new WebSocket(socketUrl);

                    onSocketError = (error: Error) => {
                        fallbackReject(`[WsConnector] Socket error on handshake: ${error}`, reject);
                    };

                    onSocketClose = () => {
                        fallbackReject(`[WsConnector] Socket was close on handshake`, reject);
                    };

                    onSocketOpen = () => {
                        this.addClient(client);
                        this._writer = new WsWriter(this._socket);
                        removeTempListeners();

                        this._socket.on('error', this._onSocketError);
                        this._socket.on('close', this._onSocketClose);
                        this._socket.on('message', this._onSocketData);

                        this.onConnectorHandshake();
                        resolve({ peer: this._peer });
                    };

                    this._socket.on('error', onSocketError);
                    this._socket.on('close', onSocketClose);
                    this._socket.on('open', onSocketOpen);
                },
                (reject) => {
                    const msg = `[WsConnector] error = timeout \
                        (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                    fallbackReject(msg, reject);
                }
            );
        });
    }

    public shutdown(options?: ClientCloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = CheckTimeoutOptions(options);
            if (!this._socket) {
                return Promise.resolve();
            }

            this._socket.off('close', this._onSocketClose);
            this._socket.off('error', this._onSocketError);
            this._socket.off('message', this._onSocketData);

            return executeInTimeout(
                options.timeoutDelay,
                (resolve) => {
                    const closeHandler = () => {
                        this._socket.off('close', closeHandler);
                        this.onConnectorShutdown();
                        resolve();
                    };

                    this._socket.on('close', closeHandler);
                    this.onConnectorBeforeShutdown();
                    this._socket.close();
                },
                (reject) => {
                    const message = `[WsConnector] stop, error = timeout \
                        (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                    this._logger?.error(message);
                    this.onConnectorShutdown();
                    reject(new Error(message));
                }
            );
        });
    }

    public postMessage(ipcMessage: IpcBusMessage, args?: unknown[]): void {
        ipcMessage.isRawData = true;
        this._packetOut.write(this._writer, [ipcMessage, args]);
    }

    public postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peer;
        this._packetOut.write(this._writer, [ipcCommand]);
    }

    protected override onConnectorShutdown(): void {
        this._socket.removeAllListeners();
        this._detachSocket();
        super.onConnectorShutdown();
    }

    private _onSocketData(rawData: RawData, _isBinary: boolean): void {
        this._bufferListReader.appendBuffer(rawData as Buffer);
        if (this._packetIn.decodeFromReader(this._bufferListReader)) {
            do {
                const ipcCommandBase: IpcBusCommandBase = this._packetIn.parseArrayAt(0);
                this._client.onConnectorCommandBase(ipcCommandBase, this._packetIn);
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            this._bufferListReader.reduce();
        }
    }

    private _onSocketClose(): void {
        this._logger?.info(`[WsConnector ${this._peer.id}] socket close`);
        this.onConnectorShutdown();
    }

    private _onSocketError(error: Error): void {
        this._logger?.error(`[WsConnector ${this._peer.id}] socket error ${error}`);
        this.onConnectorShutdown();
    }

    private _detachSocket(): void {
        this._socket = undefined;
        this._writer = undefined;
    }
}
