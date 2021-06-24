/// <reference types='electron' />

import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelsRefCount } from '../IpcBusChannelMap';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

const PeerName = 'IPCBus:NetBridge';

export class IpcBusTransportSocketBridge extends IpcBusTransportImpl {
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
            this._peer = peer;
            const channels = this._bridge.getChannels();
            this._postCommand({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: undefined,
                channels
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`${PeerName} Installed`);
        });
    }

    broadcastClose(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        this._postCommand({
            peer: this._peer,
            kind: IpcBusCommand.Kind.BridgeClose,
            channel: ''
        });
        return super.close(null, options);
    }


    // Come from the main bridge: main or renderer
    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BridgeAddChannelListener:
            case IpcBusCommand.Kind.BridgeRemoveChannelListener:
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestClose:
                this._connector.postBuffers(buffers);
                break;

            case IpcBusCommand.Kind.RequestResponse:
                if (IpcBusUtils.IsProcessTarget(ipcBusCommand.channel)) {
                    this._connector.postBuffers(buffers);
                }
                break;
        }
    }

    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
        throw 'not implemented';
        // if (this.hasChannel(ipcBusCommand.channel)) {
        //     ipcBusCommand.bridge = true;
        //     this._packet.serialize([ipcBusCommand, args]);
        //     this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
        // }
    }

    broadcastRawData(ipcBusCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): void {
        if (rawData.buffer) {
            this.broadcastBuffers(ipcBusCommand, [rawData.buffer]);
        }
        else {
            this.broadcastBuffers(ipcBusCommand, rawData.buffers);
        }
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        this.broadcastBuffers(ipcBusCommand, ipcPacketBufferCore.buffers);
    }

    hasChannel(channel: string): boolean {
        return this._subscribedChannels.has(channel) || IpcBusUtils.IsProcessTarget(channel);
    }

    getChannels(): string[] {
        return this._subscribedChannels.getChannels();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
        throw 'not implemented';
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
        // call when closing the transport
    }

    protected _onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): boolean {
        throw 'not implemented';
    }

    // protected sendMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
    //     throw 'not implemented';
    // }

    protected _postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        throw 'not implemented';
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.BrokerAddChannelListener:
                this._subscribedChannels.addRef(ipcBusCommand.channel);
                break;
            case IpcBusCommand.Kind.BrokerRemoveChannelListener:
                this._subscribedChannels.release(ipcBusCommand.channel);
                break;

            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestClose:
            default:
                this._bridge._onSocketMessageReceived(ipcBusCommand, ipcPacketBufferCore);
                break;
        }
        return true;
    }

    onConnectorRawDataReceived(ipcBusCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): boolean {
        throw 'not implemented';
    }

    onConnectorArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]): boolean {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        super.onConnectorShutdown();
        this._subscribedChannels.clear();
        this._bridge._onSocketClosed();
    }
}

