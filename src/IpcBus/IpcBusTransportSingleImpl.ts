import type { IpcPacketBufferCore } from 'socket-serializer';

import type * as Client from './IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type { IpcBusTransport } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import type { IpcBusConnector } from './IpcBusConnector';
import type { QueryStateTransport, QueryStateChannels, QueryStatePeers } from './IpcBusQueryState';

/** @internal */
export  class IpcBusTransportSingleImpl extends IpcBusTransportImpl {
    private _client: IpcBusTransport.Client;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    override isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._client && (this._client.listenerCount(ipcMessage.channel) > 0)) {
            return true;
        }
        return super.isTarget(ipcMessage);
    }

    getChannels(): string[] {
        if (this._client) {
            return this._client.eventNames() as string[];
        }
        return [];
    }

    onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args?: any[], ipcPacketBufferCore?: IpcPacketBufferCore, messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean {
        args = args || ipcPacketBufferCore.parseArrayAt(1);
        return this._onClientMessageReceived(this._client, local, ipcMessage, args, messagePorts);
    }

    override onConnectorShutdown() {
        super.onConnectorShutdown();
        this._client = null;
    }

    override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._client) {
            this._postCommand({
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
            this._client = null;
        }
    }

    override connect(client: IpcBusTransport.Client, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        if (client && (this._client == null)) {
            this._client = client;
            return super.connect(client, options)
            .then((peer) => {
                return peer;
            })
            .catch((err) => {
                this._client = null;
                throw err;
            });
        }
        return Promise.reject();
    }

    override close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        if (client && (this._client === client)) {
            this._client = null;
            this.cancelRequest(client);
            this.removeChannel(client);
            return super.close(client, options);
        }
        return Promise.reject();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number) {
        let refCount = (count == null) ? 1 : count;
        while (refCount-- > 0) {
            this._postCommand({
                kind: IpcBusCommand.Kind.AddChannelListener,
                channel
            });
        }
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean) {
        if (channel) {
            if (all) {
                this._postCommand({
                    kind: IpcBusCommand.Kind.RemoveChannelAllListeners,
                    channel
                });
            }
            else {
                this._postCommand({
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                });
            }
        }
        else {
            this._postCommand({
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
        }
    }

    queryState(): QueryStateTransport {
        const peersJSON: QueryStatePeers = {};
        const processChannelsJSON: QueryStateChannels = {};

        const channels = this._client.eventNames();
        for (let i = 0; i < channels.length; ++i) {
            const channel = channels[i] as string;
            const processChannelJSON = processChannelsJSON[channel] = {
                name: channel,
                refCount: 0
            }
            const channelCount = this._client.listenerCount(channel);
            processChannelJSON.refCount += channelCount;
            const peer = this._client.peer;
            const peerJSON = peersJSON[peer.id] = peersJSON[peer.id] || {
                peer,
                channels: {}
            };
            const peerChannelJSON = peerJSON.channels[channel] = peerJSON.channels[channel] || {
                name: channel,
                refCount: 0
            };
            peerChannelJSON.refCount += channelCount;
        }

        const results: QueryStateTransport = {
            channels: processChannelsJSON,
            peers: peersJSON
        }
        return results;
    }

}
