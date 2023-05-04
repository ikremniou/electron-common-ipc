import { BrokerImpl, ChannelsRefCount, IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { IpcPacketWriter, WriteBuffersToSocket, SocketWriter } from 'socket-serializer';

import type { NetBrokerClient } from './NetBrokerClient';
import type {
    BrokerServerFactory,
    IpcBusMessage,
    Logger,
    IpcBusCommand,
    BrokerClient,
} from '@electron-common-ipc/universal';
import type { IpcPacketBufferList } from 'socket-serializer';

/** @internal */
export class IpcBusBrokerNode extends BrokerImpl {
    private _socketWriter: SocketWriter;
    private _brokerClient: BrokerClient;
    private readonly _packetOut: IpcPacketWriter;

    private readonly _subscribedChannels: ChannelsRefCount;

    constructor(serverFactory: BrokerServerFactory, logger?: Logger) {
        super(serverFactory, IpcBusProcessType.Node, logger);

        this._packetOut = new IpcPacketWriter();
        this._packetOut.JSON = JSONParserV1;
        this._subscribedChannels = new ChannelsRefCount();
    }

    protected override _reset() {
        this.onBridgeClosed();
        super._reset();
    }


    protected override onBridgeConnected(socketClient: BrokerClient, ipcCommand: IpcBusCommand) {
        if (!this._socketWriter) {
            this._brokerClient = socketClient;
            const realClient = socketClient as NetBrokerClient;
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

    protected override onBridgeClosed(client?: BrokerClient) {
        if (this._socketWriter && (client === undefined || client === this._brokerClient)) {
            this._subscriptions.client = undefined;
            this._socketWriter = undefined;
            this._subscribedChannels.clear();
        }
    }

    protected override onBridgeAddChannel(ipcCommand: IpcBusCommand) {
        this._subscribedChannels.addRef(ipcCommand.channel);
    }

    protected override onBridgeRemoveChannel(ipcCommand: IpcBusCommand) {
        this._subscribedChannels.release(ipcCommand.channel);
    }

    protected override broadcastCommandToBridge(ipcCommand: IpcBusCommand) {
        this._packetOut.write(this._socketWriter, [ipcCommand]);
    }

    protected override broadcastToBridge(
        client: BrokerClient,
        _ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ) {
        // if we have channels, it would mean we have a socketBridge, so do not test it
        if (this._socketWriter && client !== this._brokerClient) {
            WriteBuffersToSocket(this._socketWriter.socket, ipcPacketBufferList.buffers);
        }
    }
}
