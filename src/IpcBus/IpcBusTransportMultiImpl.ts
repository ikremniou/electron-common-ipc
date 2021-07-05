import type * as Client from './IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import type { IpcBusTransport } from './IpcBusTransport';
import type { IpcBusConnector } from './IpcBusConnector';
import { ChannelConnectionMap } from './IpcBusChannelMap';

/** @internal */
export class IpcBusTransportMultiImpl extends IpcBusTransportImpl {
    protected _subscriptions: ChannelConnectionMap<IpcBusTransport.Client, string>;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscriptions && this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return super.isTarget(ipcMessage);
    }

    getChannels(): string[] {
        return this._subscriptions ? this._subscriptions.getChannels() : [];
    }

    protected _onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args: any[]): boolean {
        const channelConns = this._subscriptions.getChannelConns(ipcMessage.channel);
        if (channelConns) {
            for (const entry of channelConns) {
                if (this._onClientMessageReceived(entry[1].data, local, ipcMessage, args)) {
                    return true;
                }
            }
        }
        return false;
    }

    onConnectorBeforeShutdown() {
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

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
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

    close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void> {
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
}
