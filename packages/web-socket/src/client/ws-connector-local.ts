import { IpcBusConnectorImpl } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { IpcPacketBufferList } from 'socket-serializer';

import type {
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusCommand,
    IpcBusConnectorClient,
    IpcBusMessage,
    IpcBusProcessType,
    SocketClient,
    UuidProvider,
} from '@electron-common-ipc/universal';

export class WsConnectorLocal extends IpcBusConnectorImpl implements SocketClient {
    private _passDataToBroker: (socket: SocketClient, command: IpcBusCommand, list: IpcPacketBufferList) => void;
    private _passCloseToBroker: (socket: SocketClient) => void;

    private readonly _packetPass: IpcPacketBufferList;

    constructor(uuidProvider: UuidProvider, contextType: IpcBusProcessType) {
        super(uuidProvider, contextType, 'connector-ws-local');

        this._packetPass = new IpcPacketBufferList();
        this._packetPass.JSON = JSONParserV1;
    }

    send(bufferList: IpcPacketBufferList): void {
        const ipcCommand = bufferList.parseArrayAt(0);
        this._client.onConnectorCommandBase(ipcCommand, bufferList);
    }

    subscribe(
        onSocketData: (socket: SocketClient, ipcCommand: IpcBusCommand, ipcBusBufferList: IpcPacketBufferList) => void,
        _onSocketError: (socket: SocketClient, error: Error) => void,
        onSocketClose: (socket: SocketClient) => void
    ): void {
        this._passDataToBroker = onSocketData;
        this._passCloseToBroker = onSocketClose;
    }

    release(): void {
        this._passDataToBroker = undefined;
        this._passCloseToBroker = undefined;
    }

    [Symbol.toPrimitive](): string {
        return `LOCAL: ${JSON.stringify(this.peer)}`;
    }

    public isTarget(ipcMessage: IpcBusMessage): boolean {
        return this.peer.id === ipcMessage.peer?.id;
    }

    public handshake(client: IpcBusConnectorClient, _options: ClientConnectOptions): Promise<ConnectorHandshake> {
        if (!this._passDataToBroker) {
            throw new Error('Cannot handle handshake for local connector. Broker is not connected.');
        }

        this.addClient(client);
        return Promise.resolve({ peer: this.peer });
    }

    public shutdown(_options?: ClientCloseOptions): Promise<void> {
        this._passCloseToBroker?.(this);
        return Promise.resolve();
    }

    public postMessage(ipcMessage: IpcBusMessage, args?: unknown[]): void {
        ipcMessage.isRawData = true;
        JSONParserV1.install();
        this._packetPass.serialize([ipcMessage, args]);
        JSONParserV1.uninstall();
        this._passDataToBroker(this, ipcMessage, this._packetPass);
    }

    public postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peer;
        this._packetPass.serialize([ipcCommand]);
        this._passDataToBroker(this, ipcCommand, this._packetPass);
    }
}
