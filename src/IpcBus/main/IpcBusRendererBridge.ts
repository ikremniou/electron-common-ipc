/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';
import type { IpcPacketBuffer } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionMap } from '../IpcBusChannelMap';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';
import type { QueryStateBase, QueryStateChannels, QueryStatePeerProcesses, QueryStateRendererBridge } from '../IpcBusQueryState';
import { IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, IPCBUS_TRANSPORT_RENDERER_COMMAND, IPCBUS_TRANSPORT_RENDERER_MESSAGE } from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import { CreateProcessId } from '../IpcBusConnectorImpl';

let electron: any;
try {
    // Will work in a preload or with nodeIntegration=true
    electron = require('electron');
}
catch (err) {
}

interface IpcBusPeerProcessEndpoint extends Client.IpcBusPeerProcess {
    webContents: Electron.WebContents;
    messagePort?: Electron.MessagePortMain;
    commandPort?: Electron.MessagePortMain;
}
 
// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _contextType: Client.IpcBusProcessType;

    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;
    
    private _subscriptions: ChannelConnectionMap<IpcBusPeerProcessEndpoint, number>;
    private _endpoints: Map<number, IpcBusPeerProcessEndpoint>;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        this._contextType = contextType;
    
        this._bridge = bridge;

        this._ipcMain = electron.ipcMain;

        this._subscriptions = new ChannelConnectionMap('IPCBus:RendererBridge');
        this._endpoints = new Map();

        this._subscriptions.client = {
            channelAdded: (channel) => {
                const ipcCommand: IpcBusCommand = {
                    kind: IpcBusCommand.Kind.AddChannelListener,
                    channel
                }
                this._bridge._onBridgeChannelChanged(ipcCommand);
            },
            channelRemoved: (channel) => {
                const ipcCommand: IpcBusCommand = {
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                }
                this._bridge._onBridgeChannelChanged(ipcCommand);
            }
        };

        this._onHandshakeReceived = this._onHandshakeReceived.bind(this);
        this._onPortMessageReceived = this._onPortMessageReceived.bind(this);
        this._onPortCommandReceived = this._onPortCommandReceived.bind(this);

        this._onIPCCommandReceived = this._onIPCCommandReceived.bind(this);
        this._onIPCMessageReceived = this._onIPCMessageReceived.bind(this);
    }

    getWindowTarget(window: Electron.BrowserWindow): Client.IpcBusPeerProcess | undefined {
        let result: Client.IpcBusPeerProcess;
        for (const endpoint of this._endpoints.values()) {
            if (endpoint.process.wcid === window.webContents.id && endpoint.process.isMainFrame) {
                result = endpoint;
                break;
            }
        }
        return result;
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return IpcBusCommandHelpers.GetTargetRenderer(ipcMessage) != null;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onIPCCommandReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onIPCCommandReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this._onIPCMessageReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this._onIPCMessageReceived);

        return Promise.resolve();
    }

    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _onHandshakeReceived(event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand): void {
        const logger = CreateIpcBusLog();
        const webContents = event.sender;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: ipcCommand.peer.process,
            logLevel: logger.level,
        };
        handshake.process.wcid = webContents.id;
        handshake.process.frameid = event.frameId;
        // Following functions are not implemented in all Electrons
        try {
            handshake.process.rid = webContents.getProcessId();
        }
        catch (err) {
            handshake.process.rid = -1;
        }
        try {
            handshake.process.pid = webContents.getOSProcessId();
        }
        catch (err) {
            // For backward we fill pid with webContents id
            handshake.process.pid = webContents.id;
        }

        this._trackRendererDestruction(webContents);

        const endpoint: IpcBusPeerProcessEndpoint = Object.assign(ipcCommand.peer, { webContents });
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
        this._endpoints.set(key, endpoint);
        if (event.ports) {
            endpoint.commandPort = event.ports[0];
            endpoint.messagePort = event.ports[1];

            endpoint.messagePort.on('close', () => {
                this._onEndpointShutdown(ipcCommand);
            });
            endpoint.commandPort.on('close', () => {
                this._onEndpointShutdown(ipcCommand);
            });

            endpoint.messagePort.addListener('message', this._onPortMessageReceived);
            endpoint.messagePort.start();

            endpoint.commandPort.addListener('message', this._onPortCommandReceived);
            endpoint.commandPort.start();

            endpoint.commandPort.postMessage(handshake);
        }
        else {
            // We get back to the webContents
            // - to confirm the connection
            // - to provide id/s
            // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
            // See https://github.com/electron/electron/issues/25119
            if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
                webContents.postMessage(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake);
            }
            else {
                webContents.on('did-finish-load', () => {
                    webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake);
                });
            }
        }
    }

    private _trackRendererDestruction(webContents: Electron.WebContents): void {
        // When webContents is destroyed some properties like id are no more accessible !
        const webContentsId = webContents.id;
        webContents.once('destroyed', () => {
            // Have to remove this webContents, included its frames
            const entries = this._subscriptions.getConns().filter((entry) => {
                return (entry.data.process.wcid === webContentsId);
            });
            // Broadcast peers destruction ?
            for (let i = 0, l = entries.length; i < l; ++i) {
                this.deleteEndpointKey(entries[i].key);
            }
        });
    }

    private deleteEndpointKey(key: number) {
        const endpoint = this._endpoints.get(key);
        if (endpoint) {
            this._endpoints.delete(key);
            this._subscriptions.remove(key);

            if (endpoint.commandPort) {
                endpoint.messagePort.close();
                endpoint.messagePort.removeListener('message', this._onPortMessageReceived);
                endpoint.messagePort = null;

                endpoint.commandPort.close();
                endpoint.commandPort.removeListener('message', this._onPortCommandReceived);
                endpoint.commandPort = null;
            }
        }
    }

    private _onEndpointHandshake(ipcCommand: IpcBusCommand) {
    }

    private _onEndpointShutdown(ipcCommand: IpcBusCommand) {
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
        this.deleteEndpointKey(key);
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        this._endpoints.forEach((endpoint) => {
            // endpoint.commandPort.postMessage(ipcCommand);
            endpoint.webContents.sendToFrame(endpoint.process.frameid, IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcCommand);
        });
    }

    broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        const rawData = ipcPacketBufferCore.getRawData() as IpcPacketBuffer.RawData;
        return this._broadcastData(false, ipcMessage, rawData);
    }

    // From renderer transport
    broadcastData(ipcMessage: IpcBusMessage, data: IpcPacketBuffer.RawData | any[], messagePorts?: Electron.MessagePortMain[]): boolean {
        return this._broadcastData(false, ipcMessage, data, messagePorts);
    }

    // From renderer transport
    private _broadcastData(local: boolean, ipcMessage: IpcBusMessage, data: IpcPacketBuffer.RawData | any[], messagePorts?: Electron.MessagePortMain[]): boolean {
        const target = IpcBusCommandHelpers.GetTargetRenderer(ipcMessage);
        if (target) {
            const key = IpcBusCommandHelpers.CreateKeyForEndpoint(target);
            const endpoint = this._endpoints.get(key);
            if (endpoint) {
                if (messagePorts == null) {
                    endpoint.webContents.sendToFrame(endpoint.process.frameid, IPCBUS_TRANSPORT_RENDERER_MESSAGE, ipcMessage, data);
                }
                else {
                    endpoint.messagePort.postMessage([ipcMessage, data], messagePorts);
                }
            }
            return true;
        }
        if (ipcMessage.kind === IpcBusCommand.Kind.SendMessage) {
            const channelConns = this._subscriptions.getChannelConns(ipcMessage.channel);
            if (channelConns) {
                const key = local ? IpcBusCommandHelpers.CreateKeyForEndpoint(ipcMessage.peer): -1;
                if (messagePorts == null) {
                    channelConns.forEach((entry) => {
                        // Prevent echo message
                        if (entry.key !== key) {
                            entry.data.webContents.sendToFrame(entry.data.process.frameid, IPCBUS_TRANSPORT_RENDERER_MESSAGE, ipcMessage, data);
                        }
                    });
                }
                else {
                    channelConns.forEach((entry) => {
                        // Prevent echo message
                        if (entry.key !== key) {
                            entry.data.messagePort.postMessage([ipcMessage, data], messagePorts);
                        }
                    });
                }
            }
        }
        return false;
    }

    private _onIPCCommandReceived(_event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand): boolean {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.Handshake: 
                this._onEndpointHandshake(ipcCommand);
                return true;
            case IpcBusCommand.Kind.Shutdown:
                this._onEndpointShutdown(ipcCommand);
                return true;

            case IpcBusCommand.Kind.AddChannelListener: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                const endpointWC = this._endpoints.get(key);
                this._subscriptions.addRef(ipcCommand.channel, key, endpointWC);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelListener: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.release(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelAllListeners: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.releaseAll(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommand.Kind.RemoveListeners: {
                const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.remove(key);
                return true;
            }

            case IpcBusCommand.Kind.QueryState:
            case IpcBusCommand.Kind.QueryStateResponse:
                this._bridge._onRendererCommandReceived(ipcCommand);
                return true;
        }
        return false;
    }

    private _onPortCommandReceived(event: Electron.MessageEvent): boolean {
        return this._onIPCCommandReceived(undefined, event.data as IpcBusCommand);
    }

    private _onIPCMessageReceived(event: Electron.IpcMainEvent, ipcMessage: IpcBusMessage, data: IpcPacketBufferCore.RawData | any[]): void {
        if (this._broadcastData(true, ipcMessage, data) === false) {
            this._bridge._onRendererMessageReceived(ipcMessage, data);
        }
    }

    private _onPortMessageReceived(event: Electron.MessageEvent): void {
        const [ipcMessage, data] = event.data;
        if (this._broadcastData(true, ipcMessage, data, event.ports) === false) {
            this._bridge._onRendererMessageReceived(ipcMessage, data, event.ports);
        }
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
            })
        }

        const results: QueryStateRendererBridge = {
            type: 'renderer-bridge',
            process: { type: this._contextType, pid: process.pid },
            channels: processChannelsJSON,
            peers: peersJSON
        };
        return results;
    }}

