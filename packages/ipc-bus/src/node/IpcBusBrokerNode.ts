import type * as net from 'net';

import { IpcPacketWriter, IpcPacketBufferList, SocketWriter, WriteBuffersToSocket } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import type * as Client from '../client/IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../utils/IpcBusCommand';
import { ChannelsRefCount } from '../utils/IpcBusChannelMap';
import * as IpcBusCommandHelpers from '../utils/IpcBusCommand-helpers';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';
import type { IpcBusLogConfig } from '../log/IpcBusLogConfig';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import type { IpcBusBrokerSocket } from './IpcBusBrokerSocket';

/** @internal */
export class IpcBusBrokerNode extends IpcBusBrokerImpl {
    private _logger: IpcBusLogConfig;

    private _socketWriter: SocketWriter;
    private _packetOut: IpcPacketWriter;

    private _subscribedChannels: ChannelsRefCount;

    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);

        this._packetOut = new IpcPacketWriter();
        this._packetOut.JSON = JSONParserV1;
        this._subscribedChannels = new ChannelsRefCount();

        this._logger = CreateIpcBusLog();
    }

    protected override _reset(closeServer: boolean) {
        this.onBridgeClosed();
        super._reset(closeServer);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscribedChannels.has(ipcMessage.channel)) {
            return true;
        }
        return (IpcBusCommandHelpers.GetTargetMain(ipcMessage) != null) 
               || (IpcBusCommandHelpers.GetTargetRenderer(ipcMessage) != null)
    }
    
    protected override onBridgeConnected(socketClient: IpcBusBrokerSocket, ipcCommand: IpcBusCommand) {
        if (this._socketWriter == null) {
            this._socketWriter = new SocketWriter(socketClient.socket);

            if (Array.isArray(ipcCommand.channels)) {
                this._subscribedChannels.addRefs(ipcCommand.channels);
            }

            const channels = this._subscriptions.getChannels();
            for (let i = 0, l = channels.length; i < l; ++i) {
                this.broadcastCommandToBridge({
                    kind: IpcBusCommand.Kind.AddChannelListener,
                    channel: channels[i]
                });
            }
            this._subscriptions.client = {
                channelAdded: (channel) => {
                    this.broadcastCommandToBridge({
                        kind: IpcBusCommand.Kind.AddChannelListener,
                        channel
                    })
                },
                channelRemoved: (channel) => {
                    this.broadcastCommandToBridge({
                        kind: IpcBusCommand.Kind.RemoveChannelListener,
                        channel
                    })
                }
            };
        }
    }

    protected override onBridgeClosed(socket?: net.Socket) {
        if (this._socketWriter && ((socket == null) || (socket === this._socketWriter.socket))) {
            this._subscriptions.client = null;
            this._socketWriter = null;
            this._subscribedChannels.clear();
        }
    }

    protected override onBridgeAddChannel(socket: net.Socket, ipcCommand: IpcBusCommand) {
        this._subscribedChannels.addRef(ipcCommand.channel);
    }

    protected override onBridgeRemoveChannel(socket: net.Socket, ipcCommand: IpcBusCommand) {
        this._subscribedChannels.release(ipcCommand.channel);
    }

    protected override broadcastCommandToBridge(ipcCommand: IpcBusCommand) {
        this._packetOut.write(this._socketWriter, [ipcCommand]);
    }

    protected override broadcastToBridgeMessage(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        // if we have channels, it would mean we have a socketBridge, so do not test it
        if (this._socketWriter) {
            if (socket !== this._socketWriter.socket) {
                if (this.isTarget(ipcMessage) || (this._logger.level > 0)) {
                    WriteBuffersToSocket(this._socketWriter.socket, ipcPacketBufferList.buffers);
                }
            }
        }
    }

    protected override broadcastToBridgeRequestResponse(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        if (this._socketWriter) {
            WriteBuffersToSocket(this._socketWriter.socket, ipcPacketBufferList.buffers);
        }
    }
}
