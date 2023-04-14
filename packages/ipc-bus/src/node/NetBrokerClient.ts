import { JSONParserV1 } from 'json-helpers';
import { IpcPacketBufferList, BufferListReader, WriteBuffersToSocket } from 'socket-serializer';

import type { IpcBusCommand, Logger, BrokerClient } from '@electron-common-ipc/universal';
import type * as net from 'net';

export class NetBrokerClient implements BrokerClient {
    private _onSocketClientData?: (socket: BrokerClient, command: IpcBusCommand, buffers: IpcPacketBufferList) => void;
    private _onSocketClientError?: (socket: BrokerClient, error: Error) => void;
    private _onSocketClientClose?: (socket: BrokerClient) => void;

    protected _socketBinds: { [key: string]: (...args: any[]) => void };

    private readonly _packetIn: IpcPacketBufferList;
    private readonly _bufferListReader: BufferListReader;

    constructor(public readonly socket: net.Socket, private readonly _logger?: Logger) {

        this._logger?.info(`[IPCBus:BrokerSocket] Connect: ${this.socket.remotePort}`);

        this._bufferListReader = new BufferListReader();
        this._packetIn = new IpcPacketBufferList();
        this._packetIn.JSON = JSONParserV1;

        this._socketBinds = {};
        this._socketBinds['error'] = this.onSocketError.bind(this);
        this._socketBinds['close'] = this.onSocketClose.bind(this);
        this._socketBinds['data'] = this.onSocketData.bind(this);
        this._socketBinds['end'] = this.onSocketEnd.bind(this);

        for (const key in this._socketBinds) {
            this.socket.addListener(key, this._socketBinds[key]);
        }
    }

    send(bufferList: IpcPacketBufferList): void {
        if (this.socket) {
            WriteBuffersToSocket(this.socket, bufferList.buffers);
        }
    }

    [Symbol.toPrimitive]?(): string {
        return `NetSocket: ${this.socket.remoteAddress}:${this.socket.localPort}`;
    }

    subscribe(
        onSocketData: (socket: BrokerClient, ipcCommand: IpcBusCommand, ipcBusBufferList: IpcPacketBufferList) => void,
        onSocketError: (socket: BrokerClient, error: Error) => void,
        onSocketClose: (socket: BrokerClient) => void
    ): void {
        this._onSocketClientData = onSocketData;
        this._onSocketClientError = onSocketError;
        this._onSocketClientClose = onSocketClose;
    }

    release() {
        this._logger?.info(`[IPCBus:BrokerSocket] Release: ${this.socket.remotePort}`);
        if (this._onSocketClientData) {
            for (const key in this._socketBinds) {
                this.socket.removeListener(key, this._socketBinds[key]);
            }
            this.socket.on('error', (err) => {
                console.log(`!!!!! ${err}`);
            });
            this.socket.end();
            this.socket.unref();
            this._onSocketClientData = undefined;
            this._onSocketClientClose = undefined;
            this._onSocketClientError = undefined;
            // this._socket.destroy();
        }
    }

    private onSocketData(buffer: Buffer) {
        this._bufferListReader.appendBuffer(buffer);
        if (this._packetIn.decodeFromReader(this._bufferListReader)) {
            do {
                const ipcCommand: IpcBusCommand = this._packetIn.parseArrayAt(0);
                this._onSocketClientData(this, ipcCommand, this._packetIn);
            } while (this._packetIn.decodeFromReader(this._bufferListReader));
            // Remove read buffer
            this._bufferListReader.reduce();
        }
    }

    private onSocketError(error: Error) {
        this._logger?.info(`[IPCBus:Broker] Error on connection: ${this.socket.remotePort} - ${error}`);
        this._onSocketClientError?.(this, error);
        // this.release();
    }

    private onSocketClose() {
        this._logger?.info(`[IPCBus:Broker] Close on connection: ${this.socket.remotePort}`);
        this._onSocketClientClose?.(this);
        this.release();
    }

    private onSocketEnd() {
        this._logger?.info(`[IPCBus:Broker] End on connection: ${this.socket.remotePort}`);
        this._onSocketClientClose?.(this);
        // this.release();
    }
}
