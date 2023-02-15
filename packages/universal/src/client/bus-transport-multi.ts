import { IpcBusTransportImpl } from './bus-transport-impl';
import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { ChannelConnectionMap } from '../utils/channel-map';

import type { ClientCloseOptions, ClientConnectOptions } from './bus-client';
import type { IpcBusConnector } from './bus-connector';
import type { IpcBusTransportClient } from './bus-transport';
import type { BusMessagePort } from './message-ports';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { QueryStateChannels, QueryStatePeers, QueryStateTransport } from '../contract/query-state';
import type { Logger } from '../log/logger';
import type { MessageStamp } from '../log/message-stamp';
import type { UuidProvider } from '../utils/uuid';
import type { IpcPacketBufferCore } from 'socket-serializer-ik';

export class IpcBusTransportMulti extends IpcBusTransportImpl {
    protected _subscriptions: ChannelConnectionMap<IpcBusTransportClient, string>;

    constructor(
        connector: IpcBusConnector,
        uuid: UuidProvider,
        messageStamp?: MessageStamp,
        logger?: Logger
    ) {
        super(connector, uuid, messageStamp, logger);
    }

    override isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscriptions && this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return super.isTarget(ipcMessage);
    }

    getChannels(): string[] {
        return this._subscriptions ? this._subscriptions.getChannels() : [];
    }

    onMessageReceived(
        local: boolean,
        ipcMessage: IpcBusMessage,
        args?: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore,
        messagePorts?: BusMessagePort[]
    ): boolean {
        const channelConns = this._subscriptions.getChannelConns(ipcMessage.channel);
        if (channelConns) {
            args = args || ipcPacketBufferCore.parseArrayAt(1);
            let bHandled = false;
            channelConns.forEach((entry) => {
                if (!bHandled && this._onClientMessageReceived(entry.data, local, ipcMessage, args, messagePorts)) {
                    bHandled = true;
                }
            });
            return bHandled;
            // for (const entry of channelConns) {
            //     if (this._onClientMessageReceived(entry[1].data, local, ipcMessage, args, messagePorts)) {
            //         return true;
            //     }
            // }
        }
        return false;
    }

    override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._subscriptions) {
            this._subscriptions.client = undefined;
            this._subscriptions = undefined;
            this._postCommand({
                kind: IpcBusCommandKind.RemoveListeners,
                channel: '',
            });
        }
    }

    override connect(client: IpcBusTransportClient | undefined, options: ClientConnectOptions): Promise<IpcBusPeer> {
        return super.connect(client, options).then((peer) => {
            if (this._subscriptions === undefined) {
                this._subscriptions = new ChannelConnectionMap<IpcBusTransportClient, string>('');

                this._subscriptions.client = {
                    channelAdded: (channel) => {
                        this._postCommand({
                            kind: IpcBusCommandKind.AddChannelListener,
                            channel,
                        });
                    },
                    channelRemoved: (channel) => {
                        this._postCommand({
                            kind: IpcBusCommandKind.RemoveChannelListener,
                            channel,
                        });
                    },
                };
            } else {
                // TODO send all existing channels
            }
            return peer;
        });
    }

    override close(client: IpcBusTransportClient, options?: ClientCloseOptions): Promise<void> {
        if (this._subscriptions) {
            this.cancelRequest(client);
            this.removeChannel(client);
            if (this._subscriptions.getChannelsCount() === 0) {
                this._subscriptions.client = undefined;
                this._subscriptions = undefined;
                return super.close(client, options);
            }
        }
        return Promise.resolve();
    }

    addChannel(client: IpcBusTransportClient, channel: string, count?: number) {
        if (this._subscriptions === undefined || client.peer === undefined) {
            return;
        }
        this._subscriptions.addRef(channel, client.peer.id, client, count);
    }

    removeChannel(client: IpcBusTransportClient, channel?: string, all?: boolean) {
        if (this._subscriptions === undefined || client.peer === undefined) {
            return;
        }
        if (channel) {
            if (all) {
                this._subscriptions.releaseAll(channel, client.peer.id);
            } else {
                this._subscriptions.release(channel, client.peer.id);
            }
        } else {
            this._subscriptions.remove(client.peer.id);
        }
    }

    queryState(): QueryStateTransport {
        const peersJSON: QueryStatePeers = {};
        const processChannelsJSON: QueryStateChannels = {};

        const channels = this._subscriptions.getChannels();
        for (let i = 0; i < channels.length; ++i) {
            const channel = channels[i];
            const processChannelJSON = (processChannelsJSON[channel] = {
                name: channel,
                refCount: 0,
            });
            const channelConns = this._subscriptions.getChannelConns(channel);
            channelConns.forEach((clientRef) => {
                processChannelJSON.refCount += clientRef.refCount;
                const peer = clientRef.data.peer;
                const peerJSON = (peersJSON[peer.id] = peersJSON[peer.id] || {
                    peer,
                    channels: {},
                });
                const peerChannelJSON = (peerJSON.channels[channel] = peerJSON.channels[channel] || {
                    name: channel,
                    refCount: 0,
                });
                peerChannelJSON.refCount += clientRef.refCount;
            });
        }

        const results: QueryStateTransport = {
            type: 'transport',
            channels: processChannelsJSON,
            peers: peersJSON,
        };
        return results;
    }
}
