import * as net from 'net';

import type { IpcPacketBufferList } from 'socket-serializer';
import { WriteBuffersToSocket } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';
import type * as Broker from './IpcBusBroker';
import * as IpcBusUtils from '../IpcBusUtils';
import { ChannelConnectionMap } from '../IpcBusChannelMap';

import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';

import { IpcBusBrokerSocketClient, IpcBusBrokerSocket } from './IpcBusBrokerSocket';
import type { QueryStateBase, QueryStateBroker, QueryStateChannels, QueryStatePeerProcesses } from '../IpcBusQueryState';
import { CreateProcessId } from '../IpcBusConnectorImpl';

interface IpcBusPeerProcessEndpoint extends Client.IpcBusPeerProcess {
    socket?: net.Socket;
}

/** @internal */
export abstract class IpcBusBrokerImpl implements Broker.IpcBusBroker, IpcBusBrokerSocketClient {
    // protected _ipcBusBrokerClient: Client.IpcBusClient;
    private _socketClients: Map<net.Socket, IpcBusBrokerSocket>;

    private _server: net.Server;
    private _netBinds: { [key: string]: (...args: any[]) => void };

    protected _connectCloseState: IpcBusUtils.ConnectCloseState<void>;

    protected _subscriptions: ChannelConnectionMap<IpcBusPeerProcessEndpoint, number>;
    protected _endpoints: Map<number, IpcBusPeerProcessEndpoint>;

    constructor(contextType: Client.IpcBusProcessType) {
        this._subscriptions = new ChannelConnectionMap('IPCBus:Broker');
        this._endpoints = new Map();

        // Callbacks
        this._netBinds = {};
        this._netBinds['error'] = this._onServerError.bind(this);
        this._netBinds['close'] = this._onServerClose.bind(this);
        this._netBinds['connection'] = this._onServerConnection.bind(this);

        this._socketClients = new Map();

        this._connectCloseState = new IpcBusUtils.ConnectCloseState<void>();
    }

    protected _reset(closeServer: boolean) {
        if (this._server) {
            const server = this._server;
            this._server = null;
            for (let key in this._netBinds) {
                server.removeListener(key, this._netBinds[key]);
            }

            this._socketClients.forEach((socket) => {
                socket.release(closeServer);
            });

            server.close();
            server.unref();
        }
        this._connectCloseState.shutdown();
        this._socketClients.clear();
        this._subscriptions.clear();
    }

    // IpcBusBroker API
    connect(arg1: Broker.IpcBusBroker.ConnectOptions | string | number, arg2?: Broker.IpcBusBroker.ConnectOptions | string, arg3?: Broker.IpcBusBroker.ConnectOptions): Promise<void> {
        return this._connectCloseState.connect(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            if ((options.port == null) && (options.path == null)) {
                return Promise.reject('Connection options not provided');
            }
            return new Promise<void>((resolve, reject) => {
                const server = net.createServer();
                server.unref();

                let timer: NodeJS.Timer = null;
                let fctReject: (msg: string) => void;

                const removeLocalListeners = () => {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    server.removeListener('listening', catchListening);
                    server.removeListener('error', catchError);
                    server.removeListener('close', catchClose);
                };

                // Below zero = infinite
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        const msg = `[IPCBus:Broker] error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                        fctReject(msg);
                    }, options.timeoutDelay);
                }

                const catchError = (err: any) => {
                    const msg = `[IPCBus:Broker] error = ${err} on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchClose = () => {
                    const msg = `[IPCBus:Broker] close on ${JSON.stringify(options)}`;
                    fctReject(msg);
                };

                const catchListening = (_server: any) => {
                    removeLocalListeners();
                    this._server = server;
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${JSON.stringify(options)}`);
                    for (let key in this._netBinds) {
                        this._server.addListener(key, this._netBinds[key]);
                    }
                    resolve();
                };

                fctReject = (msg: string) => {
                    removeLocalListeners();
                    this._reset(false);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                    reject(msg);
                };
                server.addListener('listening', catchListening);
                server.addListener('error', catchError);
                server.addListener('close', catchClose);
                if (options.path) {
                    server.listen(options.path);
                }
                else if (options.port && options.host) {
                    server.listen(options.port, options.host);
                }
                else {
                    server.listen(options.port);
                }
            });
        });
    }

    close(options?: Broker.IpcBusBroker.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = options || {};
            if (options.timeoutDelay == null) {
                options.timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
            }
            return new Promise<void>((resolve, reject) => {
                if (this._server) {
                    const server = this._server;
                    let timer: NodeJS.Timer;
                    const catchClose = () => {
                        clearTimeout(timer);
                        server.removeListener('close', catchClose);
                        resolve();
                    };

                    // Below zero = infinite
                    if (options.timeoutDelay >= 0) {
                        timer = setTimeout(() => {
                            server.removeListener('close', catchClose);
                            const msg = `[IPCBus:Broker] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(options)}`;
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
                            reject(msg);
                        }, options.timeoutDelay);
                    }
                    server.addListener('close', catchClose);
                    this._reset(true);
                }
                else {
                    resolve();
                }
            });
        });
    }

    protected _socketCleanUp(socket: any): void {
        this.onBridgeClosed(socket);
        // Broadcast peers destruction ?
        for (const endpoint of this._endpoints.values()) {
            if (endpoint.socket === socket) {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(endpoint);
                this._endpoints.delete(key);
                this._subscriptions.remove(key);
            }
        }
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    protected _onSocketConnected(socket: net.Socket): void {
        this._socketClients.set(socket, new IpcBusBrokerSocket(socket, this));
    }

    onSocketError(socket: net.Socket, err: string): void {
        // Not closing server
        if (this._server) {
            this._socketClients.delete(socket);
            this._socketCleanUp(socket);
        }
    }

    onSocketClose(socket: net.Socket): void {
        // Not closing server
        if (this._server) {
            this._socketClients.delete(socket);
            this._socketCleanUp(socket);
        }
    }

    onSocketEnd(socket: net.Socket): void {
        this.onSocketClose(socket);
    }

    protected _onServerClose(): void {
        const msg = `[IPCBus:Broker] server close`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(msg);
        this._reset(false);
    }

    protected _onServerError(err: any) {
        const msg = `[IPCBus:Broker] server error ${err}`;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(msg);
        this._reset(true);
    }

    protected _onServerConnection(socket: net.Socket, _server: net.Server): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        this._onSocketConnected(socket);
    }

    private _onEndpointHandshake(socket: net.Socket, ipcCommand: IpcBusCommand) {
        const endpoint: IpcBusPeerProcessEndpoint = { ...ipcCommand.peer, socket };
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(endpoint);
        this._endpoints.set(key, endpoint);
    }

    private _onEndpointShutdown(socket: net.Socket, ipcCommand: IpcBusCommand) {
        const endpoint = ipcCommand.peer;
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(endpoint);
        this._endpoints.delete(key);
        this._subscriptions.remove(key);
    }

    queryState(): QueryStateBase {
        const peersJSON: QueryStatePeerProcesses = {};
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
                const peer = clientRef.data;
                const peerid = CreateProcessId(peer.process);
                const peerJSON = peersJSON[peerid] = peersJSON[peerid] || {
                    peer,
                    channels: {}
                };
                const peerChannelJSON = peerJSON.channels[channel] = peerJSON.channels[channel] || {
                    name: channel,
                    refCount: 0
                };
                peerChannelJSON.refCount += clientRef.refCount;
            });
        }

        const results: QueryStateBroker = {
            type: 'broker',
            channels: processChannelsJSON,
            peers: peersJSON
        };
        return results;
    }

    // protected _onServerData(packet: IpcPacketBuffer, socket: net.Socket, server: net.Server): void {
    onSocketCommand(socket: net.Socket, ipcCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList): void {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.Handshake: 
                this._onEndpointHandshake(socket, ipcCommand);
                break;
            case IpcBusCommand.Kind.Shutdown:
                this._onEndpointShutdown(socket, ipcCommand);
                // this._socketCleanUp(socket);
                break;

            case IpcBusCommand.Kind.AddChannelListener: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                const endpointSocket = this._endpoints.get(key);
                this._subscriptions.addRef(ipcCommand.channel, key, endpointSocket);
                break;
            }
            case IpcBusCommand.Kind.RemoveChannelListener: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.release(ipcCommand.channel, key);
                break;
            }
            case IpcBusCommand.Kind.RemoveChannelAllListeners: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.releaseAll(ipcCommand.channel, key);
                break;
            }
            case IpcBusCommand.Kind.RemoveListeners: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.remove(key);
                break;
            }

            case IpcBusCommand.Kind.QueryState: {
                this._subscriptions.forEachChannel(ipcCommand.channel, (connData) => {
                    // Prevent echo message
                    if (connData.data.socket !== socket) {
                        WriteBuffersToSocket(connData.data.socket, ipcPacketBufferList.buffers);
                    }
                });
                const queryState = this.queryState();
                this.broadcastCommandToBridge({
                    kind: IpcBusCommand.Kind.QueryStateResponse,
                    data: {
                        id: ipcCommand.channel,
                        queryState
                    }
                } as any)
                break;
            }

            case IpcBusCommand.Kind.QueryStateResponse:
                this.broadcastCommandToBridge(ipcCommand);
                break;

            // Socket can come from C++ process, Node.js process or main bridge
            case IpcBusCommand.Kind.SendMessage: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                const target = IpcBusCommandHelpers.GetTargetProcess(ipcMessage);
                if (target) {
                    const endpoint = this._endpoints.get(target.process.pid);
                    if (endpoint) {
                        WriteBuffersToSocket(endpoint.socket, ipcPacketBufferList.buffers);
                        return;
                    }
                }
                this._subscriptions.forEachChannel(ipcCommand.channel, (connData) => {
                    // Prevent echo message
                    if (connData.data.socket !== socket) {
                        WriteBuffersToSocket(connData.data.socket, ipcPacketBufferList.buffers);
                    }
                });
                // if not coming from main bridge => forward
                this.broadcastToBridgeMessage(socket, ipcMessage, ipcPacketBufferList);
                break;
            }

            // Socket can come from C++ process, Node.js process or main bridge
            case IpcBusCommand.Kind.RequestResponse: {
                const ipcMessage = ipcCommand as IpcBusMessage;
                const target = IpcBusCommandHelpers.GetTargetProcess(ipcMessage);
                if (target) {
                    const endpoint = this._endpoints.get(target.process.pid);
                    if (endpoint) {
                        WriteBuffersToSocket(endpoint.socket, ipcPacketBufferList.buffers);
                        return;
                    }
                }
                // Response if not for a socket client, forward to main bridge
                this.broadcastToBridge(socket, ipcMessage, ipcPacketBufferList);
                break;
            }

            // case IpcBusCommand.Kind.LogGetMessage:
            // case IpcBusCommand.Kind.LogLocalSendRequest:
            // case IpcBusCommand.Kind.LogLocalRequestResponse:
            //     this.broadcastToBridge(socket, ipcCommand, ipcPacketBufferList);
            //     break;

            // BridgeClose/Connect received are coming from IpcBusBridge only !
            case IpcBusCommand.Kind.BridgeConnect: {
                const socketClient = this._socketClients.get(socket);
                this.onBridgeConnected(socketClient, ipcCommand);
                break;
            }
            case IpcBusCommand.Kind.BridgeAddChannelListener:
                this.onBridgeAddChannel(socket, ipcCommand);
                break;

            case IpcBusCommand.Kind.BridgeRemoveChannelListener:
                this.onBridgeRemoveChannel(socket, ipcCommand);
                break;

            case IpcBusCommand.Kind.BridgeClose:
                this.onBridgeClosed();
                break;

            default:
                console.log(JSON.stringify(ipcCommand, null, 4));
                throw 'IpcBusBrokerImpl: Not valid packet !';
        }
    }

    protected onBridgeConnected(socketClient: IpcBusBrokerSocket, ipcCommand: IpcBusCommand) {
    }

    protected onBridgeClosed(socket?: net.Socket) {
    }

    protected onBridgeAddChannel(socket: net.Socket, ipcCommand: IpcBusCommand) {
    }

    protected onBridgeRemoveChannel(socket: net.Socket, ipcCommand: IpcBusCommand) {
    }

    protected abstract broadcastCommandToBridge(ipcCommand: IpcBusCommand): void;
    protected abstract broadcastToBridgeMessage(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList): void;
    protected abstract broadcastToBridge(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList): void;
}
