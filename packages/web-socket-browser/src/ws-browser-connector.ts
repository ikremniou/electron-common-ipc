import {
    CheckConnectOptions,
    CheckTimeoutOptions,
    executeInTimeout,
    IpcBusConnectorImpl,
} from '@electron-common-ipc/universal';
import { Buffer } from 'buffer';
import { BufferListReader, IpcPacketBuffer, IpcPacketBufferList } from 'socket-serializer-ik';

import type {
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusCommand,
    IpcBusConnectorClient,
    IpcBusMessage,
    IpcBusProcessType,
    Logger,
    IpcBusCommandBase,
    UuidProvider,
    JsonLike,
} from '@electron-common-ipc/universal';

class WsBrowserWriter {
    private readonly _packetOut: IpcPacketBuffer;

    constructor(private readonly _socket: WebSocket, private readonly _json: JsonLike) {
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = this._json;
    }

    public writeMessage(message: IpcBusMessage, args: unknown[]): void {
        message.isRawData = true;
        this._json.install?.();
        this._packetOut.serialize([message, args]);
        this._json.uninstall?.();
        this.write(this._packetOut.buffers);
    }

    public writeCommand(command: IpcBusCommand): void {
        this._packetOut.serialize([command]);
        this.write(this._packetOut.buffers);
    }

    private write(buffers: Buffer[]): void {
        for (const buffer of buffers) {
            this._socket.send(buffer);
        }
    }
}

export class WsBrowserConnector extends IpcBusConnectorImpl {
    private _socket?: WebSocket;

    private _writer?: WsBrowserWriter;
    private readonly _bufferListReader: BufferListReader;
    private readonly _packetIn: IpcPacketBufferList;

    constructor(
        uuid: UuidProvider,
        private readonly _json: JsonLike,
        contextType: IpcBusProcessType,
        private readonly _logger?: Logger
    ) {
        super(uuid, contextType, 'connector-browser-ws');

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = JSON;

        this.onSocketError = this.onSocketError.bind(this);
        this.onSocketClose = this.onSocketClose.bind(this);
        this.onSocketMessage = this.onSocketMessage.bind(this);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return ipcMessage.target?.id === this._peer.id;
    }

    handshake(client: IpcBusConnectorClient, options: ClientConnectOptions): Promise<ConnectorHandshake> {
        return this._connectCloseState.connect(() => {
            options = CheckConnectOptions(options);
            if (!options.port && !options.path) {
                throw new Error(`Connection options must include 'path' or 'port'`);
            }

            let onSocketClose: (event: CloseEvent) => void;
            let onSocketError: (event: Event) => void;
            let onSocketOpen: (event: Event) => void;
            const removeTempListeners = () => {
                this._socket.removeEventListener('error', onSocketError);
                this._socket.removeEventListener('close', onSocketClose);
                this._socket.removeEventListener('open', onSocketOpen);
            };
            const fallbackReject = (message: string, reject: (e: Error) => void) => {
                removeTempListeners();
                this._detachSocket();
                this._logger?.error(message);
                reject(new Error(message));
            };

            return executeInTimeout(
                options.timeoutDelay,
                (resolve, reject) => {
                    const socketUrl = new URL(options.path || 'ws://127.0.0.1');
                    socketUrl.port = socketUrl.port || String(options.port);
                    this._socket = new WebSocket(socketUrl);
                    this._socket.binaryType = 'arraybuffer';

                    onSocketError = (event: Event) => {
                        fallbackReject(`[WsBrowserConnector] Socket error on handshake: ${event}`, reject);
                    };

                    onSocketClose = (event: CloseEvent) => {
                        fallbackReject(`[WsBrowserConnector] Socket close on handshake: ${event}`, reject);
                    };

                    onSocketOpen = (_event: Event) => {
                        this.addClient(client);
                        this._writer = new WsBrowserWriter(this._socket, this._json);
                        removeTempListeners();

                        this._socket.addEventListener('error', this.onSocketError);
                        this._socket.addEventListener('close', this.onSocketClose);
                        this._socket.addEventListener('message', this.onSocketMessage);

                        this.onConnectorHandshake();
                        resolve({ peer: this._peer });
                    };

                    this._socket.addEventListener('error', onSocketError);
                    this._socket.addEventListener('close', onSocketClose);
                    this._socket.addEventListener('open', onSocketOpen);
                },
                (reject) => {
                    const message =
                        `[WsBrowserConnector] Timeout(${options.timeoutDelay}ms) for handshake.` +
                        `Options: ${JSON.stringify(options)}`;
                    fallbackReject(message, reject);
                }
            );
        });
    }

    shutdown(options?: ClientCloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = CheckTimeoutOptions(options);
            if (!this._socket) {
                return Promise.resolve();
            }

            this._unsubscribeSocket();
            let closeListener: () => void;
            return executeInTimeout(
                options.timeoutDelay,
                (resolve) => {
                    closeListener = () => {
                        this._socket.removeEventListener('close', closeListener);
                        this.onConnectorShutdown();
                        resolve();
                    };

                    this._socket.addEventListener('close', closeListener);
                    this.onConnectorBeforeShutdown();
                    this._socket.close();
                },
                (reject) => {
                    const message =
                        `[WsBrowserConnector] Timeout(${options.timeoutDelay}).` +
                        `Options: ${JSON.stringify(options)}`;
                    this._logger?.error(message);
                    this._socket.removeEventListener('close', closeListener);
                    this.onConnectorShutdown();
                    reject(new Error(message));
                }
            );
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: unknown[]): void {
        this._writer.writeMessage(ipcMessage, args);
    }

    postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peer;
        this._writer.writeCommand(ipcCommand);
    }

    protected override onConnectorShutdown(): void {
        this._detachSocket();
        super.onConnectorShutdown();
    }

    private onSocketMessage(messageEvent: MessageEvent<ArrayBuffer>): void {
        const rawData = Buffer.from(messageEvent.data);
        this._bufferListReader.appendBuffer(rawData as Buffer);
        if (this._packetIn.decodeFromReader(this._bufferListReader)) {
            do {
                const ipcCommandBase: IpcBusCommandBase = this._packetIn.parseArrayAt(0);
                this._client.onConnectorCommandBase(ipcCommandBase, this._packetIn);
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            this._bufferListReader.reduce();
        }
    }

    private onSocketError(event: Event): void {
        this._logger?.error(`[WsConnector ${this._peer.id}] socket error ${event}`);
        this._unsubscribeSocket();
        this.onConnectorShutdown();
    }

    private onSocketClose(closeEvent: CloseEvent): void {
        this._logger?.info(`[WsConnector ${this._peer.id}] socket close. Code: ${closeEvent.code}`);
        this._unsubscribeSocket();
        this.onConnectorShutdown();
    }

    private _unsubscribeSocket(): void {
        if (this._socket) {
            this._socket.removeEventListener('error', this.onSocketError);
            this._socket.removeEventListener('close', this.onSocketClose);
            this._socket.removeEventListener('message', this.onSocketMessage);
        }
    }

    private _detachSocket(): void {
        this._socket = undefined;
        this._writer = undefined;
    }
}
