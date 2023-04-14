import { BrokerImpl, ChannelsRefCount, IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { IpcPacketWriter, WriteBuffersToSocket , SocketWriter } from 'socket-serializer';

import { CreateIpcBusLog } from '../log/IpcBusLog-factory-node';

import type { NetBrokerClient } from './NetBrokerClient';
import type {
    BrokerServerFactory,
    IpcBusMessage,
    Logger,
    IpcBusCommand,
    IpcBusLogConfig,
    BrokerClient,
} from '@electron-common-ipc/universal';
import type * as net from 'net';
import type { IpcPacketBufferList} from 'socket-serializer';

/** @internal */
export class IpcBusBrokerNode extends BrokerImpl {
    private _socketWriter: SocketWriter;
    private readonly _packetOut: IpcPacketWriter;

    private readonly _subscribedChannels: ChannelsRefCount;
    private readonly _contractLogger: IpcBusLogConfig;

    constructor(serverFactory: BrokerServerFactory, logger?: Logger) {
        super(serverFactory, IpcBusProcessType.Node, logger);

        this._packetOut = new IpcPacketWriter();
        this._packetOut.JSON = JSONParserV1;
        this._subscribedChannels = new ChannelsRefCount();

        this._contractLogger = CreateIpcBusLog();
    }

    protected override _reset() {
        this.onBridgeClosed();
        super._reset();
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return this._subscribedChannels.has(ipcMessage.channel);
        // if (this._subscribedChannels.has(ipcMessage.channel)) {
        //     return true;
        // }
        // return (IpcBusCommandHelpers.GetTargetMain(ipcMessage) != null)
        //        || (IpcBusCommandHelpers.GetTargetRenderer(ipcMessage) != null);
    }

    protected override onBridgeConnected(_socketClient: BrokerClient, ipcCommand: IpcBusCommand) {
        if (!this._socketWriter) {
            const realClient = _socketClient as NetBrokerClient;
            this._socketWriter = new SocketWriter(realClient.socket);

            if (Array.isArray(ipcCommand.channels)) {
                this._subscribedChannels.addRefs(ipcCommand.channels);
            }

            const channels = this._subscriptions.getChannels();
            for (let i = 0, l = channels.length; i < l; ++i) {
                this.broadcastCommandToBridge({
                    kind: IpcBusCommandKind.AddChannelListener,
                    channel: channels[i],
                });
            }
            this._subscriptions.client = {
                channelAdded: (channel) => {
                    this.broadcastCommandToBridge({
                        kind: IpcBusCommandKind.AddChannelListener,
                        channel,
                    });
                },
                channelRemoved: (channel) => {
                    this.broadcastCommandToBridge({
                        kind: IpcBusCommandKind.RemoveChannelListener,
                        channel,
                    });
                },
            };
        }
    }

    protected override onBridgeClosed(socket?: net.Socket) {
        if (this._socketWriter && (socket === undefined || socket === this._socketWriter.socket)) {
            this._subscriptions.client = undefined;
            this._socketWriter = undefined;
            this._subscribedChannels.clear();
        }
    }

    protected override onBridgeAddChannel(_socket: net.Socket, ipcCommand: IpcBusCommand) {
        this._subscribedChannels.addRef(ipcCommand.channel);
    }

    protected override onBridgeRemoveChannel(_socket: net.Socket, ipcCommand: IpcBusCommand) {
        this._subscribedChannels.release(ipcCommand.channel);
    }

    protected override broadcastCommandToBridge(ipcCommand: IpcBusCommand) {
        this._packetOut.write(this._socketWriter, [ipcCommand]);
    }

    protected override broadcastToBridgeMessage(
        socket: net.Socket,
        ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ) {
        // if we have channels, it would mean we have a socketBridge, so do not test it
        if (this._socketWriter) {
            if (socket !== this._socketWriter.socket) {
                if (this.isTarget(ipcMessage) || this._contractLogger.level > 0) {
                    WriteBuffersToSocket(this._socketWriter.socket, ipcPacketBufferList.buffers);
                }
            }
        }
    }

    protected override broadcastToBridgeRequestResponse(
        _socket: net.Socket,
        _ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ) {
        if (this._socketWriter) {
            WriteBuffersToSocket(this._socketWriter.socket, ipcPacketBufferList.buffers);
        }
    }
}
