import { CreateKeyForEndpoint } from '../contract/command-helpers';
import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { CheckConnectOptions, CheckTimeoutOptions, createContextId, isBridgeTarget } from '../utils';
import { ChannelConnectionMap } from '../utils/channel-map';
import { ConnectionState } from '../utils/connection-state';

import type { BrokerCloseOptions, BrokerConnectOptions, IpcBusBroker } from './broker';
import type { BrokerClient } from './broker-client';
import type { BrokerServer } from './broker-server';
import type { BrokerServerFactory } from './broker-server-factory';
import type { IpcBusCommand } from '../contract/ipc-bus-command';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer, IpcBusProcessType } from '../contract/ipc-bus-peer';
import type { QueryStateBase, QueryStateBroker, QueryStateChannels, QueryStatePeers } from '../contract/query-state';
import type { Logger } from '../log/logger';
import type { IpcPacketBufferList } from 'socket-serializer';

interface IpcBusPeerProcessEndpoint extends IpcBusPeer {
    socket?: BrokerClient;
}

export class BrokerImpl implements IpcBusBroker {
    private readonly _socketClients: BrokerClient[] = [];
    private _server: BrokerServer;

    protected _connectCloseState: ConnectionState;
    protected _subscriptions: ChannelConnectionMap<IpcBusPeerProcessEndpoint, string>;
    protected _endpoints: Map<string, IpcBusPeerProcessEndpoint>;

    constructor(
        private readonly _serverFactory: BrokerServerFactory,
        protected readonly _contextType: IpcBusProcessType,
        private readonly _logger?: Logger
    ) {
        this._endpoints = new Map();
        this._connectCloseState = new ConnectionState();
        this._subscriptions = new ChannelConnectionMap('BusBroker', this._logger);

        this._onServerClose = this._onServerClose.bind(this);
        this._onServerError = this._onServerError.bind(this);
        this._onServerConnection = this._onServerConnection.bind(this);

        this._onClientSocketData = this._onClientSocketData.bind(this);
        this._onClientSocketClose = this._onClientSocketClose.bind(this);
        this._onClientSocketError = this._onClientSocketError.bind(this);
    }

    // IpcBusBroker API
    public connect(
        arg1: BrokerConnectOptions | string | number,
        arg2?: BrokerConnectOptions | string,
        arg3?: BrokerConnectOptions
    ): Promise<void> {
        return this._connectCloseState.connect(async () => {
            const options = CheckConnectOptions(arg1, arg2, arg3);

            try {
                this._server = await this._serverFactory.create(options);
                this._server.subscribe(this._onServerClose, this._onServerError, this._onServerConnection);
            } catch (error) {
                this._logger?.error(error.toString());
                throw error;
            }
        });
    }

    public close(options?: BrokerCloseOptions): Promise<void> {
        return this._connectCloseState.close(async () => {
            options = CheckTimeoutOptions(options);

            try {
                if (this._server) {
                    this._reset();
                    await this._server.close(options);
                    this._server = undefined;
                }
            } catch (error) {
                this._logger?.error(error.toString());
                throw error;
            }
        });
    }

    public addClient(peers: IpcBusPeer[], userClient: BrokerClient): void {
        this._logger?.info(`[BusBroker] Adding client from user ${userClient}`);
        this._onServerConnection(userClient);
        this._onEndpointHandshake(userClient, peers);
    }

    protected _reset(): void {
        this._socketClients.forEach((socket) => {
            socket.release();
        });

        // await this._server.close();
        this._connectCloseState.shutdown();
        this._socketClients.length = 0;
        this._subscriptions.clear();
    }

    protected _socketCleanUp(brokerClient: BrokerClient): void {
        this.onBridgeClosed(brokerClient);
        // Broadcast peers destruction ?
        this._endpoints.forEach((endpoint) => {
            if (endpoint.socket === brokerClient) {
                const key = CreateKeyForEndpoint(endpoint);
                this._endpoints.delete(key);
                this._subscriptions.remove(key);
            }
        });
        this._logger?.info(`[BrokerImpl] Connection closed !`);
    }

    protected _onServerClose(): void {
        const msg = `[BrokerImpl] server close`;
        this._logger?.info(msg);
        this._reset();
        this._server = undefined;
    }

    protected _onServerError(err: Error) {
        const msg = `[BrokerImpl] server error ${err}`;
        this._logger?.error(msg);
        this._reset();
    }

    protected _onServerConnection(serverClient: BrokerClient): void {
        this._logger?.info(`[BrokerImpl] Incoming connection !`);
        // Detailed representation is logged via [Symbol.toPrimitive]
        this._logger?.info(`[BrokerImpl] Socket client: ${serverClient}`);

        serverClient.subscribe(this._onClientSocketData, this._onClientSocketError, this._onClientSocketClose);
        this._socketClients.push(serverClient);
    }

    protected _queryState(): QueryStateBase {
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
                const endpointCopy = { ...clientRef.data };
                endpointCopy.socket = undefined;
                const processID = endpointCopy.id;
                const peerJSON = (peersJSON[processID] = peersJSON[processID] || {
                    peer: endpointCopy,
                    channels: {},
                });
                const peerChannelJSON = (peerJSON.channels[channel] = peerJSON.channels[channel] || {
                    name: channel,
                    refCount: 0,
                });
                peerChannelJSON.refCount += clientRef.refCount;
            });
        }

        const results: QueryStateBroker = {
            type: 'broker',
            contextId: createContextId(this._contextType),
            channels: processChannelsJSON,
            peers: peersJSON,
        };
        return results;
    }

    private _onClientSocketError(client: BrokerClient, _err: Error): void {
        this._onClientSocketClose(client);
    }

    private _onClientSocketClose(socket: BrokerClient): void {
        if (this._server) {
            socket.release();
            this._socketClients.splice(this._socketClients.indexOf(socket), 1);
            this._socketCleanUp(socket);
        }
    }

    private _onClientSocketData(
        socket: BrokerClient,
        ipcCommand: IpcBusCommand,
        ipcPacketBufferList: IpcPacketBufferList
    ): void {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.Handshake:
                this._onEndpointHandshake(socket, ipcCommand.peers ?? [ipcCommand.peer]);
                break;
            case IpcBusCommandKind.Shutdown:
                this._onEndpointShutdown(ipcCommand.peers ?? [ipcCommand.peer]);
                // this._socketCleanUp(socket);
                break;

            case IpcBusCommandKind.AddChannelListener:
                this._addListeners(ipcCommand);
                break;
            case IpcBusCommandKind.RemoveChannelListener:
                this._removeListeners(ipcCommand, 'release');
                break;
            case IpcBusCommandKind.RemoveChannelAllListeners: {
                this._removeListeners(ipcCommand, 'all');
                break;
            }
            case IpcBusCommandKind.RemoveListeners:
                this._removeListeners(ipcCommand, 'remove');
                break;
            case IpcBusCommandKind.QueryState: {
                this._endpoints.forEach((endpoint) => {
                    // Prevent echo message
                    if (endpoint.socket !== socket) {
                        endpoint.socket.send(ipcPacketBufferList);
                    }
                });
                const queryState = this._queryState();
                this.broadcastCommandToBridge({
                    kind: IpcBusCommandKind.QueryStateResponse,
                    peer: { id: 'broker', type: this._contextType },
                    data: {
                        id: ipcCommand.channel,
                        queryState,
                    },
                } as IpcBusCommand);
                break;
            }

            case IpcBusCommandKind.QueryStateResponse:
                this.broadcastCommandToBridge(ipcCommand);
                break;

            case IpcBusCommandKind.LogRoundtrip: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                this.broadcastToBridge(socket, ipcMessage, ipcPacketBufferList);
                break;
            }

            // Socket can come from C++ process, Node.js process or main bridge
            case IpcBusCommandKind.SendMessage: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                if (!this._sendToTarget(socket, ipcMessage, ipcPacketBufferList)) {
                    this._subscriptions.forEachChannel(ipcCommand.channel, (connData) => {
                        // Prevent echo message
                        if (connData.data.socket !== socket) {
                            connData.data.socket.send(ipcPacketBufferList);
                        }
                    });
                    // if not coming from main bridge => forward
                    this.broadcastToBridge(socket, ipcMessage, ipcPacketBufferList);
                }
                break;
            }

            // Socket can come from C++ process, Node.js process or main bridge
            case IpcBusCommandKind.RequestResponse: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                if (!this._sendToTarget(socket, ipcMessage, ipcPacketBufferList)) {
                    // Response if not for a socket client, forward to main bridge
                    this.broadcastToBridge(socket, ipcMessage, ipcPacketBufferList);
                }
                break;
            }

            // BridgeClose/Connect received are coming from IpcBusBridge only !
            case IpcBusCommandKind.BridgeConnect: {
                this.onBridgeConnected(socket, ipcCommand);
                break;
            }
            case IpcBusCommandKind.BridgeAddChannelListener:
                this.onBridgeAddChannel(ipcCommand);
                break;

            case IpcBusCommandKind.BridgeRemoveChannelListener:
                this.onBridgeRemoveChannel(ipcCommand);
                break;

            case IpcBusCommandKind.BridgeClose:
                this.onBridgeClosed();
                break;

            default:
                console.log(JSON.stringify(ipcCommand, undefined, 4));
                throw 'IpcBusBrokerImpl: Not valid packet. Command is unknown';
        }
    }

    private _sendToTarget(
        client: BrokerClient,
        ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ): boolean {
        if (ipcMessage.target) {
            if (isBridgeTarget(ipcMessage.target)) {
                this.broadcastToBridge(client, ipcMessage, ipcPacketBufferList);
                return true;
            }

            const endpoint = this._endpoints.get(ipcMessage.target.id);
            if (endpoint) {
                endpoint.socket.send(ipcPacketBufferList);
                return true;
            }
        }
        return false;
    }

    private _addListeners(ipcCommand: IpcBusCommand): void {
        const peers = ipcCommand.peers ?? [ipcCommand.peer];
        peers.forEach((peer) => {
            const key = CreateKeyForEndpoint(peer);
            const endpointSocket = this._endpoints.get(key);
            if (endpointSocket) {
                this._subscriptions.addRef(ipcCommand.channel, key, endpointSocket);
            }
        });
    }

    private _removeListeners(ipcCommand: IpcBusCommand, type: 'release' | 'all' | 'remove'): void {
        const peers = ipcCommand.peers ?? [ipcCommand.peer];
        peers.forEach((peer) => {
            const key = CreateKeyForEndpoint(peer);
            switch (type) {
                case 'release':
                    this._subscriptions.release(ipcCommand.channel, key);
                    break;
                case 'all':
                    this._subscriptions.releaseAll(ipcCommand.channel, key);
                    break;
                case 'remove':
                    this._subscriptions.remove(key);
                    break;
            }
        });
    }

    private _onEndpointHandshake(socket: BrokerClient, peers: IpcBusPeer[]): void {
        peers.forEach((peer) => {
            const endpoint: IpcBusPeerProcessEndpoint = { ...peer, socket };
            const key = CreateKeyForEndpoint(endpoint);
            this._endpoints.set(key, endpoint);
        });
    }

    private _onEndpointShutdown(peers: IpcBusPeer[]) {
        peers.forEach((peer) => {
            const key = CreateKeyForEndpoint(peer);
            this._endpoints.delete(key);
            this._subscriptions.remove(key);
        });
    }

    protected onBridgeClosed(_client?: BrokerClient) {}
    protected onBridgeConnected(_client: BrokerClient, _ipcCommand: IpcBusCommand) {}
    protected onBridgeAddChannel(_ipcCommand: IpcBusCommand) {}
    protected onBridgeRemoveChannel(_ipcCommand: IpcBusCommand) {}
    protected broadcastCommandToBridge(_ipcCommand: IpcBusCommand): void {}
    protected broadcastToBridge(
        _client: BrokerClient,
        _message: IpcBusMessage,
        _ipcPacketBufferList: IpcPacketBufferList
    ): void {}
}
