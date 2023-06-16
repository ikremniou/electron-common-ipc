/// <reference types='electron' />

import {
    ChannelsRefCount,
    IpcBusCommandKind,
    IpcBusTransportImpl,
    createContextId,
} from '@electron-common-ipc/universal';
import { WriteBuffersToSocket } from 'socket-serializer';

import { GetTargetProcess } from '../utils/IpcBusCommand-helpers';

import type { IpcBusBridgeClient, IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import type { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';
import type { QueryStateSocketBridge } from '../utils/IpcBusQueryState';
import type {
    BusMessagePort,
    ClientConnectOptions,
    IpcBusCommand,
    IpcBusConnector,
    IpcBusMessage,
    Logger,
    MessageStamp,
    QueryStateChannels,
    QueryStatePeers,
    QueryStateTransport,
    UuidProvider,
    IpcBusPeer,
    IpcBusTransportClient,
} from '@electron-common-ipc/universal';
import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

const PeerName = 'IPCBus:NetBridge';

export class IpcBusTransportSocketBridge extends IpcBusTransportImpl implements IpcBusBridgeClient {
    private readonly _mockPeer: IpcBusPeer = { id: 'transport-socket', type: this.connector.type };
    private readonly _mockClient: IpcBusTransportClient = { peer: this._mockPeer, listeners: () => [] };
    protected _bridge: IpcBusBridgeImpl;
    protected _subscribedChannels: ChannelsRefCount;

    constructor(
        connector: IpcBusConnector,
        bridge: IpcBusBridgeImpl,
        uuid: UuidProvider,
        stamp?: MessageStamp,
        logger?: Logger
    ) {
        super(connector, uuid, stamp, logger);
        this._bridge = bridge;

        this._subscribedChannels = new ChannelsRefCount();
    }

    broadcastConnect(options: ClientConnectOptions): Promise<void> {
        return super.connect(this._mockClient, { ...options, peerName: PeerName }).then(() => {
            const channels = this._bridge.getChannels();
            this._postCommand({
                kind: IpcBusCommandKind.BridgeConnect,
                peer: this._mockPeer,
                channel: undefined,
                channels,
            });
            this._logger?.info(`${PeerName} Installed`);
        });
    }

    broadcastClose(options?: ClientConnectOptions): Promise<void> {
        this._postCommand({
            kind: IpcBusCommandKind.BridgeClose,
            peer: this._mockPeer,
            channel: '',
        });
        return super.close(this._mockClient, options);
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        this._postCommand(ipcCommand);
    }

    broadcastData(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBuffer.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ): boolean {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBuffer.RawData;
            if (rawData.buffer) {
                return this._broadcastBuffers(ipcMessage, [rawData.buffer]);
            }

            return this._broadcastBuffers(ipcMessage, rawData.buffers);
        }

        const args = data as unknown[];
        this._postMessage(ipcMessage, args, messagePorts);
        return false;
    }

    // Come from the main bridge: main or renderer
    protected _broadcastBuffers(_ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        const connector = this.connector as IpcBusConnectorSocket;
        if (connector.socket) {
            WriteBuffersToSocket(connector.socket, buffers);
        }
        return false;
    }

    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        return this._broadcastBuffers(ipcMessage, ipcPacketBufferCore.buffers);
    }

    override isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscribedChannels.has(ipcMessage.channel)) {
            return true;
        }
        return GetTargetProcess(ipcMessage) !== undefined;
    }

    override getChannels(): string[] {
        return this._subscribedChannels.getChannels();
    }

    override addChannel(): void {
        throw 'not implemented';
    }

    override removeChannel(): void {
        // call when closing the transport
    }

    override onLogReceived(ipcMessage: IpcBusMessage, args: unknown[], buffers?: IpcPacketBufferCore): void {
        this._bridge._onSocketLogReceived(ipcMessage, buffers);
    }

    override onMessageReceived(
        _local: boolean,
        ipcMessage: IpcBusMessage,
        _args: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore,
        _messagePorts?: ReadonlyArray<BusMessagePort>
    ): boolean {
        return this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferCore);
    }

    override onRequestResponseReceived(
        _local: boolean,
        ipcResponse: IpcBusMessage,
        _args: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore
    ): boolean {
        return this._bridge._onSocketRequestResponseReceived(ipcResponse, ipcPacketBufferCore);
    }

    override onConnectorCommandBase(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.AddChannelListener:
                this._subscribedChannels.addRef(ipcCommand.channel);
                break;
            case IpcBusCommandKind.RemoveChannelListener:
                this._subscribedChannels.release(ipcCommand.channel);
                break;

            case IpcBusCommandKind.QueryState:
            case IpcBusCommandKind.QueryStateResponse:
                this._bridge._onSocketCommandReceived(ipcCommand);
                break;
        }
    }

    override onConnectorShutdown(): void {
        super.onConnectorShutdown();
        this._subscribedChannels.clear();
        this._bridge._onSocketClosed();
    }

    override queryState(): QueryStateTransport {
        const peersJSON: QueryStatePeers = {};
        const processChannelsJSON: QueryStateChannels = {};

        const channels = this._subscribedChannels.getChannels();
        for (let i = 0; i < channels.length; ++i) {
            const channel = channels[i];
            const processChannelJSON = (processChannelsJSON[channel] = {
                name: channel,
                refCount: 0,
            });
            const refCount = this._subscribedChannels.get(channel);
            processChannelJSON.refCount += refCount;
        }

        const results: QueryStateSocketBridge = {
            type: 'transport-socket-bridge',
            contextId: createContextId(this.connector.type),
            process: { pid: process.pid },
            channels: processChannelsJSON,
            peers: peersJSON,
        };
        return results;
    }
}
