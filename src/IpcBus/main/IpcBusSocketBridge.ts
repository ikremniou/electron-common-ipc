/// <reference types='electron' />

import { IpcPacketBuffer, IpcPacketBufferCore, WriteBuffersToSocket } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelsRefCount } from '../IpcBusChannelMap';
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
        this._connector.postCommand(ipcCommand);
    }

    // Come from the main bridge: main or renderer
    broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): void {
        const connector = this._connector as IpcBusConnectorSocket;
        if (connector.socket) {
            WriteBuffersToSocket(connector.socket, buffers);
        }
    }

    broadcastArgs(ipcMessage: IpcBusMessage, args: any[]): void {
        this._connector.postMessage(ipcMessage, args);
    }

    broadcastRawData(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData): void {
        if (rawData.buffer) {
            this.broadcastBuffers(ipcMessage, [rawData.buffer]);
        }
        else {
            this.broadcastBuffers(ipcMessage, rawData.buffers);
        }
    }

    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): void {
        this.broadcastBuffers(ipcMessage, ipcPacketBufferCore.buffers);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscribedChannels.has(ipcMessage.channel)) {
            return true;
        }
        return IpcBusUtils.GetTargetProcess(ipcMessage) != null;
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

    protected _onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args: any[]): boolean {
        throw 'not implemented';
    }

    onConnectorPacketReceived(ipcCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.BrokerAddChannelListener:
                this._subscribedChannels.addRef(ipcCommand.channel);
                break;
            case IpcBusCommand.Kind.BrokerRemoveChannelListener:
                this._subscribedChannels.release(ipcCommand.channel);
                break;

            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestResponse:
            case IpcBusCommand.Kind.RequestClose: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferCore);
                break;
            }
            default:
                break;
        }
        return true;
    }

    onConnectorRawDataReceived(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData): boolean {
        throw 'not implemented';
    }

    onConnectorArgsReceived(ipcMessage: IpcBusMessage, args: any[]): boolean {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        super.onConnectorShutdown();
        this._subscribedChannels.clear();
        this._bridge._onSocketClosed();
    }
}

