import { CheckConnectOptions, IpcBusCommandKind, IpcBusConnectorImpl } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import * as net from 'net';
import {
    IpcPacketBufferList,
    SocketWriter,
    BufferedSocketWriter,
    DelayedSocketWriter,
    BufferListReader,
} from 'socket-serializer';

import { IPC_BUS_TIMEOUT } from '../utils';
import { SerializeMessage } from '../utils/IpcBusCommand-helpers';

import type {
    IpcBusProcessType,
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusCommand,
    IpcBusCommandBase,
    IpcBusConnectorClient,
    IpcBusMessage,
    Logger,
    UuidProvider,
    IpcBusPeer,
} from '@electron-common-ipc/universal';
import type { Writer } from 'socket-serializer';

// Implementation for Node process
/** @internal */
export class IpcBusConnectorSocket extends IpcBusConnectorImpl {
    private _socket: net.Socket;
    private readonly _netBinds: { [key: string]: (...args: any[]) => void };
    private _localBinds: typeof this._netBinds = {};

    private _socketBuffer: number;
    private _socketWriter: Writer;

    private readonly _packetIn: IpcPacketBufferList;

    private readonly _serializeMessage: SerializeMessage;
    private readonly _bufferListReader: BufferListReader;

    constructor(uuid: UuidProvider, contextType: IpcBusProcessType, logger?: Logger) {
        // assert((contextType === 'main') || (contextType === 'node'),
        // `IpcBusTransportNet: contextType must not be a ${contextType}`);
        super(uuid, contextType, 'connector-socket', logger);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = JSONParserV1;
        this._serializeMessage = new SerializeMessage();

        this._netBinds = {};
        this._netBinds['error'] = this._onSocketError.bind(this);
        this._netBinds['close'] = this._onSocketClose.bind(this);
        this._netBinds['data'] = this._onSocketData.bind(this);
        this._netBinds['end'] = this._onSocketEnd.bind(this);
    }

    get socket(): net.Socket {
        return this._socket;
    }

    // https://nodejs.org/api/net.html#net_event_error_1
    protected _onSocketError(err: Error) {
        const msg = `[IPCBusTransport:Net ${this.id}] socket error ${err}`;
        this._logger?.error(msg);
        // this._socket.destroy();
        this.onConnectorShutdown();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_close_1
    protected _onSocketClose() {
        const msg = `[IPCBusTransport:Net ${this.id}] socket close`;
        this._logger?.info(msg);
        this.onConnectorShutdown();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_end
    protected _onSocketEnd() {
        const msg = `[IPCBusTransport:Net ${this.id}] socket end`;
        this._logger?.info(msg);
        this.onConnectorShutdown();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_data
    protected _onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        if (this._packetIn.decodeFromReader(this._bufferListReader)) {
            do {
                const ipcCommandBase: IpcBusCommandBase = this._packetIn.parseArrayAt(0);
                switch (ipcCommandBase.kind) {
                    case IpcBusCommandKind.SendMessage:
                        this._client.onMessageReceived(
                            false,
                            ipcCommandBase as IpcBusMessage,
                            undefined,
                            this._packetIn
                        );
                        break;
                    case IpcBusCommandKind.RequestResponse:
                        this._client.onRequestResponseReceived(
                            false,
                            ipcCommandBase as IpcBusMessage,
                            undefined,
                            this._packetIn
                        );
                        break;
                    case IpcBusCommandKind.LogRoundtrip:
                        this._client.onLogReceived(ipcCommandBase as IpcBusMessage, undefined, this._packetIn);
                        break;
                    default:
                        this._client.onConnectorCommandBase(ipcCommandBase as IpcBusCommand);
                        break;
                }
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _reset(endSocket: boolean) {
        this._socketWriter = undefined;
        if (this._socket) {
            const socket = this._socket;
            this._socket = undefined;
            for (const key in this._netBinds) {
                socket.removeListener(key, this._netBinds[key]);
            }
            if (endSocket) {
                socket.end();
            }
        }
    }

    /// IpcBusTransportImpl API
    protected override handshakeInternal(
        client: IpcBusConnectorClient,
        peer: IpcBusPeer,
        options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        return new Promise((resolve, reject) => {
            options = CheckConnectOptions(options);
            if (!options.port && !options.path) {
                reject('Connection options not provided');
                return;
            }

            this._socketBuffer = options.socketBuffer;

            let timer: NodeJS.Timer = undefined;
            let fctReject: (msg: string) => void = () => {};
            // Below zero = infinite
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    timer = undefined;
                    const msg = `[IPCBusTransport:Net ${this.id}] error = timeout (${
                        options.timeoutDelay
                    } ms) on ${JSON.stringify(options)}`;
                    fctReject(msg);
                }, options.timeoutDelay);
            }

            const catchError = (err: unknown) => {
                const msg = `[IPCBusTransport:Net ${this.id}] socket error = ${err} on ${JSON.stringify(options)}`;
                fctReject(msg);
            };

            const catchClose = () => {
                const msg = `[IPCBusTransport:Net ${this.id}] socket close`;
                fctReject(msg);
            };

            const socket = new net.Socket();
            socket.unref();
            const catchConnect = () => {
                clearTimeout(timer);

                this.addClient(client);
                this._removeLocalBinds();
                this._socket = socket;
                for (const key in this._netBinds) {
                    this._socket.addListener(key, this._netBinds[key]);
                }

                this._logger?.info(`[IPCBusTransport:Net ${this.id}] connected on ${JSON.stringify(options)}`);
                if (!this._socketBuffer) {
                    this._socketWriter = new SocketWriter(this._socket);
                } else if (this._socketBuffer < 0) {
                    this._socketWriter = new DelayedSocketWriter(this._socket);
                } else if (this._socketBuffer > 0) {
                    this._socketWriter = new BufferedSocketWriter(this._socket, this._socketBuffer);
                }

                const handshake: ConnectorHandshake = {
                    peer,
                };
                resolve(handshake);
            };

            fctReject = (msg: string) => {
                clearTimeout(timer);
                this._removeLocalBinds();
                this._reset(false);
                this._logger?.error(msg);
                reject(msg);
            };
            this._localBinds['error'] = catchError.bind(this);
            this._localBinds['close'] = catchClose.bind(this);
            this._localBinds['connect'] = catchConnect.bind(this);
            for (const key in this._localBinds) {
                socket.addListener(key, this._localBinds[key]);
            }
            if (options.path) {
                socket.connect(options.path);
            } else if (options.port && options.host) {
                socket.connect(options.port, options.host);
            } else {
                socket.connect(options.port);
            }
        });
    }

    protected override shutdownInternal(options?: ClientCloseOptions): Promise<void> {
        options = options || {};
        if (options.timeoutDelay === undefined) {
            options.timeoutDelay = IPC_BUS_TIMEOUT;
        }

        this._removeLocalBinds();
        return new Promise<void>((resolve) => {
            if (this._socket) {
                let timer: NodeJS.Timer;
                const socket = this._socket;
                const catchClose = () => {
                    clearTimeout(timer);
                    for (const key in this._localBinds) {
                        socket.removeListener(key, this._localBinds[key]);
                    }
                    this.onConnectorShutdown();
                    socket.destroy();
                    resolve();
                };

                this._localBinds['close'] = catchClose.bind(this);
                for (const key in this._localBinds) {
                    socket.addListener(key, this._localBinds[key]);
                }
                this._reset(true);
            } else {
                resolve();
            }
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: unknown[]): void {
        if (this._socketWriter) {
            // ipcMessage.process = this._process;
            this._serializeMessage.writeMessage(this._socketWriter, ipcMessage, args);
        }
    }

    postCommand(ipcCommand: IpcBusCommand): void {
        if (this._socketWriter) {
            this._serializeMessage.writeCommand(this._socketWriter, ipcCommand);
        }
    }

    private _removeLocalBinds(): void {
        for (const key in this._localBinds) {
            this._socket?.removeListener(key, this._localBinds[key]);
        }
        this._localBinds = {};
    }
}
