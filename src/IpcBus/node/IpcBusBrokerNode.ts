import type * as net from 'net';

import { IpcPacketWriter, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketWriter: SocketWriter;
    private _packetOut: IpcPacketWriter;

    private _peerBridge: Client.IpcBusPeer;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);
       
        this._packetOut = new IpcPacketWriter();
       
        this._subscriptions.client = {
            channelAdded: (channel) => {
                this.broadcastToBridgeAddChannel(channel);
            },
            channelRemoved: (channel) => {
                this.broadcastToBridgeRemoveChannel(channel);
            }
        };
    }

    protected _reset(closeServer: boolean) {
        this.onBridgeClosed();
        super._reset(closeServer);
    }

    protected onBridgeConnected(socketClient: IpcBusBrokerSocket, ipcBusCommand: IpcBusCommand) {
        this._peerBridge = ipcBusCommand.peer;
        const socket = socketClient.socket;
        this._socketWriter = new SocketWriter(socket);

        const channels = this._subscriptions.getChannels();
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.broadcastToBridgeAddChannel(channels[i]);
        }

        // Add channels after sending the current ones, else we will have a circular refs
        if (Array.isArray(ipcBusCommand.channels)) {
            this._subscriptions.addRefs(ipcBusCommand.channels, (socket as any)[this._socketIdProperty], socket, this._peerBridge);
        }
    }

    protected onBridgeClosed(socket?: net.Socket) {
        if (this._socketWriter && ((socket == null) || (socket === this._socketWriter.socket))) {
            this._subscriptions.removeConnection(this._socketWriter.socket);

            const channels = this._subscriptions.getChannels();
            for (let i = 0, l = channels.length; i < l; ++i) {
                this.broadcastToBridgeRemoveChannel(channels[i]);
            }

            this._socketWriter = null;
            this._peerBridge = null;
        }
    }

    protected broadcastToBridgeAddChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel,
                peer: this._peerBridge
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected broadcastToBridgeRemoveChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.RemoveChannelListener,
                channel,
                peer: this._peerBridge
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }
}
