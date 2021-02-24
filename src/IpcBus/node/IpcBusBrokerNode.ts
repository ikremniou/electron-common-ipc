import type * as net from 'net';

import { IpcPacketWriter, IpcPacketBufferList, SocketWriter } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { CreateUniqId } from '../IpcBusUtils';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _socketWriter: SocketWriter;
    private _packetOut: IpcPacketWriter;

    private _peer: Client.IpcBusPeer;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._peer = {
            id: `${contextType}.${CreateUniqId()}`,
            process: {
                type: contextType,
                pid: process ? process.pid : -1
            },
            name: ''
        }
       
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
        const socket = socketClient.socket;
        this._socketWriter = new SocketWriter(socket);

        if (Array.isArray(ipcBusCommand.channels)) {
            this._subscriptions.addRefs(ipcBusCommand.channels, (socket as any)[this._socketIdProperty], socket, ipcBusCommand.peer);
        }

        const channels = this._subscriptions.getChannels();
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.broadcastToBridgeAddChannel(channels[i]);
        }
    }

    protected onBridgeClosed(socket?: net.Socket) {
        if (this._socketWriter && ((socket == null) || (socket === this._socketWriter.socket))) {
            this._socketWriter = null;
            this._subscriptions.clear();
        }
    }

    protected broadcastToBridgeAddChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel,
                peer: this._peer
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected broadcastToBridgeRemoveChannel(channel: string) {
        if (this._socketWriter) {
            const ipcBusCommand: IpcBusCommand = {
                kind: IpcBusCommand.Kind.RemoveChannelListener,
                channel,
                peer: this._peer
            };
            this._packetOut.write(this._socketWriter, [ipcBusCommand]);
        }
    }

    protected broadcastToBridgeMessage(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
    }

    protected broadcastToBridge(socket: net.Socket, ipcBusCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList) {
    }
}
