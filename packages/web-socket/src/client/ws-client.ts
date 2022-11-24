import { JSONParserV1 } from 'json-helpers';
import { BufferListReader, IpcPacketBufferList } from 'socket-serializer';

import type { IpcBusCommand, Logger, SocketClient } from '@electron-common-ipc/universal';
import type { RawData, WebSocket } from 'ws';

export class WsClient implements SocketClient {
    private _onSocketDataHandler?: (socket: SocketClient, command: IpcBusCommand, buffer: IpcPacketBufferList) => void;
    private _onSocketErrorHandler?: (socket: SocketClient, error: Error) => void;
    private _onSocketCloseHandler?: (socket: SocketClient) => void;

    private readonly _packetIn: IpcPacketBufferList;
    private readonly _bufferListReader: BufferListReader;

    constructor(private _socket: WebSocket, private readonly _logger?: Logger) {
        // TODO_IK: review logging
        this._logger?.info(`[IPCBus:BrokerSocket] Connect: ${this._socket.url}`);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = JSONParserV1;

        this._onSocketData = this._onSocketData.bind(this);
        this._onSocketError = this._onSocketError.bind(this);
        this._onSocketClose = this._onSocketClose.bind(this);
    }

    public subscribe(
        onSocketData: (socket: SocketClient, ipcCommand: IpcBusCommand, ipcBusBufferList: IpcPacketBufferList) => void,
        onSocketError: (socket: SocketClient, error: Error) => void,
        onSocketClose: (socket: SocketClient) => void
    ): void {
        this._onSocketDataHandler = onSocketData;
        this._onSocketErrorHandler = onSocketError;
        this._onSocketCloseHandler = onSocketClose;

        this._socket.on('message', this._onSocketData);
        this._socket.on('close', this._onSocketClose);
        this._socket.on('error', this._onSocketError);
    }

    public release(): void {
        // TODO_IK: review logging
        this._logger?.info(`[IPCBus:BrokerSocket] Release: ${this._socket.url}`);
        if (this._socket) {
            // TODO_IK: review close
            this._socket.off('message', this._onSocketData);
            this._socket.off('close', this._onSocketClose);
            this._socket.off('error', this._onSocketError);

            this._socket.close();
            this._onSocketCloseHandler = undefined;
            this._onSocketErrorHandler = undefined;
            this._onSocketDataHandler = undefined;
            this._socket = undefined;
        }
    }

    public send(bufferList: IpcPacketBufferList): void {
        for (let i = 0; i < bufferList.buffers.length; i++) {
            this._socket.send(bufferList.buffers[i]);
        }
    }

    protected _onSocketData(rawData: RawData) {
        // TODO_IK: review serialization
        // console.log(`[onSocketData] isBinary: ${isBinary}`);
        this._bufferListReader.appendBuffer(rawData as Buffer);
        if (this._packetIn.decodeFromReader(this._bufferListReader)) {
            do {
                const ipcCommand: IpcBusCommand = this._packetIn.parseArrayAt(0);
                this._onSocketDataHandler(this, ipcCommand, this._packetIn);
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    protected _onSocketError(err: Error) {
        this._logger?.info(`[IPCBus:Broker] Error on connection: ${this._socket.url} - ${err}`);
        this._onSocketErrorHandler(this, err);
    }

    protected _onSocketClose() {
        this._logger?.info(`[IPCBus:Broker] Close on connection: ${this._socket.url}`);
        this._onSocketCloseHandler(this);
        this.release();
    }
}
