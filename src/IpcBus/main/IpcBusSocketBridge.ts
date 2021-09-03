/// <reference types='electron' />

import { IpcPacketBuffer, IpcPacketBufferCore, WriteBuffersToSocket } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelsRefCount } from '../IpcBusChannelMap';
import type { QueryStateChannels, QueryStatePeers, QueryStateSocketBridge, QueryStateTransport } from '../IpcBusQueryState';
import type { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';

import type { IpcBusBridgeClient, IpcBusBridgeImpl } from './IpcBusBridgeImpl';

const PeerName = 'IPCBus:NetBridge';

export class IpcBusTransportSocketBridge extends IpcBusTransportImpl implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscribedChannels: ChannelsRefCount;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;

        this._subscribedChannels = new ChannelsRefCount();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.connect(null, { ...options, peerName: PeerName })
        .then((peer) => {
            const channels = this._bridge.getChannels();
            this._postCommand({
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: undefined,
                channels
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`${PeerName} Installed`);
        });
    }

    broadcastClose(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        this._postCommand({
            kind: IpcBusCommand.Kind.BridgeClose,
            channel: ''
        });
        return super.close(null, options);
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        this._postCommand(ipcCommand);
    }

    broadcastData(ipcMessage: IpcBusMessage, data: IpcPacketBuffer.RawData | any[], messagePorts?: Electron.MessagePortMain[]): boolean {
        if (ipcMessage.rawData) {
            const rawData = data as IpcPacketBuffer.RawData;
            if (rawData.buffer) {
                return this._broadcastBuffers(ipcMessage, [rawData.buffer]);
            }
            else {
                return this._broadcastBuffers(ipcMessage, rawData.buffers);
            }
        }
        else {
            const args = data as any[];
            this._postMessage(ipcMessage, args, messagePorts);
            return false;
        }
    }

    // Come from the main bridge: main or renderer
    protected _broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        const connector = this._connector as IpcBusConnectorSocket;
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
        return IpcBusCommandHelpers.GetTargetProcess(ipcMessage) != null;
    }

    override getChannels(): string[] {
        return this._subscribedChannels.getChannels();
    }

    override addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
        throw 'not implemented';
    }

    override removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
        // call when closing the transport
    }

    override onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args: any[], ipcPacketBufferCore?: IpcPacketBufferCore, messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean {
        return this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferCore);
    }

    override onRequestResponseReceived(local: boolean, ipcResponse: IpcBusMessage, args: any[], ipcPacketBufferCore?: IpcPacketBufferCore): boolean {
        return this._bridge._onSocketRequestResponseReceived(ipcResponse, ipcPacketBufferCore);
    }

    override onCommandReceived(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscribedChannels.addRef(ipcCommand.channel);
                break;
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscribedChannels.release(ipcCommand.channel);
                break;

            case IpcBusCommand.Kind.QueryState:
            case IpcBusCommand.Kind.QueryStateResponse:
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
            const processChannelJSON = processChannelsJSON[channel] = {
                name: channel,
                refCount: 0
            }
            const refCount = this._subscribedChannels.get(channel);
            processChannelJSON.refCount += refCount;
        }

        const results: QueryStateSocketBridge = {
            type: 'transport-socket-bridge',
            process: this._connector.peer.process,
            channels: processChannelsJSON,
            peers: peersJSON
        };
        return results;
    }
}

