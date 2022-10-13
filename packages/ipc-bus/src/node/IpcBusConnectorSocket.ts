import * as net from 'net';

import { IpcPacketBufferList, Writer, SocketWriter, BufferedSocketWriter, DelayedSocketWriter, BufferListReader } from 'socket-serializer';

import * as IpcBusUtils from '../utils';
import * as IpcBusCommandHelpers from '../utils/IpcBusCommand-helpers';
import type * as Client from '../client/IpcBusClient';

import { IpcBusCommand, IpcBusCommandBase } from '../utils/IpcBusCommand';
import type { IpcBusMessage } from '../utils/IpcBusCommand';
import type { IpcBusConnector } from '../client/IpcBusConnector';
import { IpcBusConnectorImpl } from '../client/IpcBusConnectorImpl';
import { JSONParserV1 } from 'json-helpers';
import type { QueryStateConnector } from '../utils/IpcBusQueryState';

// Implementation for Node process
/** @internal */
export class IpcBusConnectorSocket extends IpcBusConnectorImpl {
    private _socket: net.Socket;
    private _netBinds: { [key: string]: (...args: any[]) => void };

    private _socketBuffer: number;
    private _socketWriter: Writer;

    private _packetIn: IpcPacketBufferList;

    private _serializeMessage: IpcBusCommandHelpers.SerializeMessage;
    private _bufferListReader: BufferListReader;

    constructor(contextType: Client.IpcBusProcessType) {
        // assert((contextType === 'main') || (contextType === 'node'), `IpcBusTransportNet: contextType must not be a ${contextType}`);
        super(contextType);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = JSONParserV1;
        this._serializeMessage = new IpcBusCommandHelpers.SerializeMessage();

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
    protected _onSocketError(err: any) {
        const msg = `[IPCBusTransport:Net ${this._peerProcess}] socket error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        // this._socket.destroy();
        this.onConnectorShutdown();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_close_1
    protected _onSocketClose() {
        const msg = `[IPCBusTransport:Net ${this._peerProcess}] socket close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this.onConnectorShutdown();
        this._reset(false);
    }

    // https://nodejs.org/api/net.html#net_event_end
    protected _onSocketEnd() {
        const msg = `[IPCBusTransport:Net ${this._peerProcess}] socket end`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
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
                    case IpcBusCommand.Kind.SendMessage:
                        this._client.onMessageReceived(false, ipcCommandBase as IpcBusMessage, undefined, this._packetIn);
                        break;
                    case IpcBusCommand.Kind.RequestResponse:
                        this._client.onRequestResponseReceived(false, ipcCommandBase as IpcBusMessage, undefined, this._packetIn);
                        break;
                    case IpcBusCommand.Kind.LogRoundtrip:
                        this._client.onLogReceived(ipcCommandBase as IpcBusMessage, undefined, this._packetIn);
                        break;
                    default: 
                        this.onCommandReceived(ipcCommandBase as IpcBusCommand);
                        break;
                }
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    override onCommandReceived(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.QueryState: {
                const queryState: QueryStateConnector = {
                    type: 'connector-socket',
                    process: this._peerProcess.process,
                    peerProcess: this._peerProcess,
                }
                this.postCommand({
                    kind: IpcBusCommand.Kind.QueryStateResponse,
                    data: {
                        id: ipcCommand.channel,
                        queryState
                    }
                } as any);
                break;
            }
        }
        super.onCommandReceived(ipcCommand);
    }

    protected _reset(endSocket: boolean) {
        this._socketWriter = null;
        if (this._socket) {
            const socket = this._socket;
            this._socket = null;
            for (let key in this._netBinds) {
                socket.removeListener(key, this._netBinds[key]);
            }
            if (endSocket) {
                socket.end();
            }
        }
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        const target = IpcBusCommandHelpers.GetTargetProcess(ipcMessage);
        return (target
                && (target.process.pid == this._peerProcess.process.pid));
    }

    /// IpcBusTransportImpl API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            return new Promise((resolve, reject) => {
                options = IpcBusUtils.CheckConnectOptions(options);
                if ((options.port == null) && (options.path == null)) {
                    return reject('Connection options not provided');
                }

                this._socketBuffer = options.socketBuffer;

                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;
                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        const msg = `[IPCBusTransport:Net ${this._peerProcess}] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                const catchError = (err: any) => {
                    const msg = `[IPCBusTransport:Net ${this._peerProcess}] socket error = ${err} on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchClose = () => {
                    const msg = `[IPCBusTransport:Net ${this._peerProcess}] socket close`;
                    fctReject(msg);
                };

                const socket = new net.Socket();
                socket.unref();
                let socketLocalBinds: { [key: string]: (...args: any[]) => void } = {};
                const catchConnect = () => {
                    clearTimeout(timer);

                    this.addClient(client);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    this._socket = socket;
                    for (let key in this._netBinds) {
                        this._socket.addListener(key, this._netBinds[key]);
                    }

                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Net ${this._peerProcess}] connected on ${JSON.stringify(options)}`);
                    if ((this._socketBuffer == null) || (this._socketBuffer === 0)) {
                        this._socketWriter = new SocketWriter(this._socket);
                    }
                    else if (this._socketBuffer < 0) {
                        this._socketWriter = new DelayedSocketWriter(this._socket);
                    }
                    else if (this._socketBuffer > 0) {
                        this._socketWriter = new BufferedSocketWriter(this._socket, this._socketBuffer);
                    }

                    this.onConnectorHandshake();

                    const handshake: IpcBusConnector.Handshake = {
                        process: this._peerProcess.process,
                        logLevel: this._log.level
                    }
                    resolve(handshake);
                };

                fctReject = (msg: string) => {
                    clearTimeout(timer);
                    for (let key in socketLocalBinds) {
                        socket.removeListener(key, socketLocalBinds[key]);
                    }
                    this._reset(false);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                socketLocalBinds['error'] = catchError.bind(this);
                socketLocalBinds['close'] = catchClose.bind(this);
                socketLocalBinds['connect'] = catchConnect.bind(this);
                for (let key in socketLocalBinds) {
                    socket.addListener(key, socketLocalBinds[key]);
                }
                if (options.path) {
                    socket.connect(options.path);
                }
                else if (options.port && options.host) {
                    socket.connect(options.port, options.host);
                }
                else  {
                    socket.connect(options.port);
                }
            });
        });
    }

    shutdown(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            return new Promise<void>((resolve, reject) => {
                if (this._socket) {
                    let timer: NodeJS.Timer;
                    const socket = this._socket;
                    let socketLocalBinds: { [key: string]: (...args: any[]) => void } = {};
                    const catchClose = () => {
                        clearTimeout(timer);
                        for (let key in socketLocalBinds) {
                            socket.removeListener(key, socketLocalBinds[key]);
                        }
                        this.onConnectorShutdown();
                        resolve();
                    };
                    // Below zero = infinite
                    if (options.timeoutDelay >= 0) {
                        timer = setTimeout(() => {
                            for (let key in socketLocalBinds) {
                                socket.removeListener(key, socketLocalBinds[key]);
                            }
                            const msg = `[IPCBusTransport:Net ${this._peerProcess}] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                            this.onConnectorShutdown();
                            reject(msg);
                        }, options.timeoutDelay);
                    }
                    socketLocalBinds['close'] = catchClose.bind(this);
                    for (let key in socketLocalBinds) {
                        socket.addListener(key, socketLocalBinds[key]);
                    }
                    this.onConnectorBeforeShutdown();
                    this._reset(true);
                }
                else {
                    resolve();
                }
            });
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: any[], epcPorts?: Client.IpcBusMessagePort[]): void {
        if (this._socketWriter) {
            // ipcMessage.process = this._process;
            this._serializeMessage.writeMessage(this._socketWriter, ipcMessage, args);
        }
    }

    postCommand(ipcCommand: IpcBusCommand): void {
        if (this._socketWriter) {
            ipcCommand.peer = ipcCommand.peer || this._peerProcess;
            this._serializeMessage.writeCommand(this._socketWriter, ipcCommand);
        }
    }

    postLogRoundtrip(ipcMessage: IpcBusMessage, args?: any[]) {
        if (this._socketWriter) {
            // ipcMessage.process = this._process;
            this._serializeMessage.writeMessage(this._socketWriter, ipcMessage, args);
        }
    }
}
