import type { IpcPacketBufferCore } from 'socket-serializer';

import type * as Client from './IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import type { IpcBusTransport } from './IpcBusTransport';
import type { IpcBusConnector } from './IpcBusConnector';
import { ChannelConnectionMap } from './IpcBusChannelMap';
import type { QueryStateTransport, QueryStateChannels, QueryStatePeers } from './IpcBusQueryState';

/** @internal */
export class IpcBusTransportMultiImpl extends IpcBusTransportImpl {
    protected _subscriptions: ChannelConnectionMap<IpcBusTransport.Client, string>;

    constructor(connector: IpcBusConnector) {
        super(connector);
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

    onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args?: any[], ipcPacketBufferCore?: IpcPacketBufferCore, messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean {
        const channelConns = this._subscriptions.getChannelConns(ipcMessage.channel);
        if (channelConns) {
            args = args || ipcPacketBufferCore.parseArrayAt(1);
            for (const entry of channelConns) {
                if (this._onClientMessageReceived(entry[1].data, local, ipcMessage, args, messagePorts)) {
                    return true;
                }
            }
        }
        return false;
    }

    override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._subscriptions) {
            this._subscriptions.client = null;
            this._subscriptions = null;
            this._postCommand({
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
        }
    }

    override connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.connect(client, options)
            .then((peer) => {
                if (this._subscriptions == null) {
                    this._subscriptions = new ChannelConnectionMap<IpcBusTransport.Client, string>('');

                    this._subscriptions.client = {
                        channelAdded: (channel) => {
                            this._postCommand({
                                kind: IpcBusCommand.Kind.AddChannelListener,
                                channel
                            })
                        },
                        channelRemoved: (channel) => {
                            this._postCommand({
                                kind: IpcBusCommand.Kind.RemoveChannelListener,
                                channel
                            });
                        }
                    };
                }
                else {
                    // TODO send all existing channels
                }
                return peer;
            });
    }

    override close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        if (this._subscriptions) {
            this.cancelRequest(client);
            this.removeChannel(client);
            if (this._subscriptions.getChannelsCount() === 0) {
                this._subscriptions.client = null;
                this._subscriptions = null;
                return super.close(client, options);
            }
        }
        return Promise.resolve();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        if ((this._subscriptions == null) || (client.peer == null)) {
            return;
        }
        this._subscriptions.addRef(channel, client.peer.id, client, count);
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if ((this._subscriptions == null) || (client.peer == null)) {
            return;
        }
        if (channel) {
            if (all) {
                this._subscriptions.releaseAll(channel, client.peer.id);
            }
            else {
                this._subscriptions.release(channel, client.peer.id);
            }
        }
        else {
            this._subscriptions.remove(client.peer.id);
        }
    }

    queryState(): QueryStateTransport {
        const peersJSON: QueryStatePeers = {};
        const processChannelsJSON: QueryStateChannels = {};

        const channels = this._subscriptions.getChannels();
        for (let i = 0; i < channels.length; ++i) {
            const channel = channels[i];
            const processChannelJSON = processChannelsJSON[channel] = {
                name: channel,
                refCount: 0
            }
            const channelConns = this._subscriptions.getChannelConns(channel);
            channelConns.forEach((clientRef) => {
                processChannelJSON.refCount += clientRef.refCount;
                const peer = clientRef.data.peer;
                const peerJSON = peersJSON[peer.id] = peersJSON[peer.id] || {
                    peer,
                    channels: {}
                };
                const peerChannelJSON = peerJSON.channels[channel] = peerJSON.channels[channel] || {
                    name: channel,
                    refCount: 0
                };
                peerChannelJSON.refCount += clientRef.refCount;
            })
        }

        const results: QueryStateTransport = {
            type: 'transport',
            process: this._connector.peer.process,
            channels: processChannelsJSON,
            peers: peersJSON
        };
        return results;
    }
}
