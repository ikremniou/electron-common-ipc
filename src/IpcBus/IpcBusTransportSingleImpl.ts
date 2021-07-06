import type * as Client from './IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type { IpcBusTransport } from './IpcBusTransport';
import { IpcBusTransportImpl } from './IpcBusTransportImpl';
import type { IpcBusConnector } from './IpcBusConnector';

/** @internal */
export  class IpcBusTransportSingleImpl extends IpcBusTransportImpl {
    private _client: IpcBusTransport.Client;

    constructor(connector: IpcBusConnector) {
        super(connector);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
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

    protected _onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args?: any[], messagePorts?: Client.IpcBusMessagePort[]): boolean {
        return this._onClientMessageReceived(this._client, local, ipcMessage, args, messagePorts);
    }

    onConnectorShutdown() {
        super.onConnectorShutdown();
        this._client = null;
    }

    onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._client) {
            this._postCommand({
                kind: IpcBusCommand.Kind.RemoveListeners,
                channel: ''
            });
            this._client = null;
        }
    }

    connect(client: IpcBusTransport.Client, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
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

    close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
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
}
