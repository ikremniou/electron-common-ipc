import { IpcBusConnectorImpl } from '@electron-common-ipc/universal';
import { IpcPacketBufferList } from 'socket-serializer';

import type {
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusCommand,
    IpcBusConnectorClient,
    IpcBusMessage,
    IpcBusProcessType,
    BrokerClient,
    UuidProvider,
    JsonLike,
    IpcBusPeer,
} from '@electron-common-ipc/universal';

export class WsConnectorLocal extends IpcBusConnectorImpl implements BrokerClient {
    private _passDataToBroker: (socket: BrokerClient, command: IpcBusCommand, list: IpcPacketBufferList) => void;
    private _passCloseToBroker: (socket: BrokerClient) => void;

    private readonly _packetPass: IpcPacketBufferList;

    constructor(uuidProvider: UuidProvider, private readonly _json: JsonLike, contextType: IpcBusProcessType) {
        super(uuidProvider, contextType, 'connector-ws-local');

        this._packetPass = new IpcPacketBufferList();
        this._packetPass.JSON = this._json;
    }

    send(bufferList: IpcPacketBufferList): void {
        const ipcCommand = bufferList.parseArrayAt(0);
        this._client.onConnectorCommandBase(ipcCommand, bufferList);
    }

    subscribe(
        onSocketData: (socket: BrokerClient, ipcCommand: IpcBusCommand, ipcBusBufferList: IpcPacketBufferList) => void,
        _onSocketError: (socket: BrokerClient, error: Error) => void,
        onSocketClose: (socket: BrokerClient) => void
    ): void {
        this._passDataToBroker = onSocketData;
        this._passCloseToBroker = onSocketClose;
    }

    release(): void {
        this._passDataToBroker = undefined;
        this._passCloseToBroker = undefined;
        this.onConnectorShutdown();
    }

    [Symbol.toPrimitive](): string {
        return `LOCAL: ${JSON.stringify(this.id)}`;
    }

    public postMessage(ipcMessage: IpcBusMessage, args?: unknown[]): void {
        ipcMessage.isRawData = true;
        this._json.install?.();
        this._packetPass.serialize([ipcMessage, args]);
        this._json.uninstall?.();
        this._passDataToBroker(this, ipcMessage, this._packetPass);
    }

    public postCommand(ipcCommand: IpcBusCommand): void {
        this._packetPass.serialize([ipcCommand]);
        this._passDataToBroker(this, ipcCommand, this._packetPass);
    }

    protected override handshakeInternal(
        client: IpcBusConnectorClient,
        peer: IpcBusPeer,
        _options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        if (!this._passDataToBroker) {
            throw new Error('Cannot handle handshake for local connector. Broker is not connected.');
        }

        this.addClient(client);
        return Promise.resolve({ peer });
    }

    protected override shutdownInternal(_options?: ClientCloseOptions): Promise<void> {
        if (this._passCloseToBroker) {
            this._passCloseToBroker(this);
            return Promise.resolve();
        }
        this.onConnectorShutdown();
        return Promise.resolve();
    }
}
