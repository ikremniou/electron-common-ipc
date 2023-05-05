/// <reference types='electron' />

import { ChannelConnectionMap, IpcBusCommandKind, createContextId } from '@electron-common-ipc/universal';

import { CreateIpcBusLog } from '../log/IpcBusLog-factory-main';
import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND,
    IPCBUS_TRANSPORT_RENDERER_MESSAGE,
    IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP,
} from '../renderer/IpcBusConnectorRenderer';
import { createProcessID, requireElectron } from '../utils';
import { CreateKeyForEndpoint, GetTargetRenderer } from '../utils/IpcBusCommand-helpers';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import type { QueryStatePeerProcesses, QueryStateRendererBridge } from '../utils/IpcBusQueryState';
import type {
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusPeer,
    IpcBusProcess,
    QueryStateChannels,
    IpcBusCommand,
    IpcBusMessage,
    QueryStateBase,
    IpcBusProcessType,
} from '@electron-common-ipc/universal';
import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

const electron = requireElectron();

export interface IpcBusRendererPeer extends IpcBusPeer {
    process: IpcBusProcess;
}

interface IpcBusPeerProcessEndpoint extends IpcBusRendererPeer {
    webContents: Electron.WebContents;
    messagePort?: Electron.MessagePortMain;
    commandPort?: Electron.MessagePortMain;
}

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private readonly _contextType: IpcBusProcessType;

    private readonly _bridge: IpcBusBridgeImpl;
    private readonly _ipcMain: Electron.IpcMain;

    private readonly _subscriptions: ChannelConnectionMap<IpcBusPeerProcessEndpoint, string>;
    private readonly _endpoints: Map<string, IpcBusPeerProcessEndpoint>;

    // See https://github.com/electron/electron/issues/25119
    private readonly _earlyIPCIssueFixed: boolean;

    constructor(contextType: IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        this._contextType = contextType;

        this._bridge = bridge;

        this._ipcMain = electron.ipcMain;

        const electronVersion = process.versions.electron.split('.')[0];
        // TODO_IK: update Electron version
        this._earlyIPCIssueFixed = Number(electronVersion) >= 12;

        this._subscriptions = new ChannelConnectionMap('IPCBus:RendererBridge');
        this._endpoints = new Map();

        this._subscriptions.client = {
            channelAdded: (channel) => {
                const ipcCommand: IpcBusCommand = {
                    kind: IpcBusCommandKind.AddChannelListener,
                    channel,
                };
                this._bridge._onBridgeChannelChanged(ipcCommand);
            },
            channelRemoved: (channel) => {
                const ipcCommand: IpcBusCommand = {
                    kind: IpcBusCommandKind.RemoveChannelListener,
                    channel,
                };
                this._bridge._onBridgeChannelChanged(ipcCommand);
            },
        };

        this._onHandshakeReceived = this._onHandshakeReceived.bind(this);
        this._onPortMessageReceived = this._onPortMessageReceived.bind(this);
        this._onPortCommandReceived = this._onPortCommandReceived.bind(this);

        this._onIPCCommandReceived = this._onIPCCommandReceived.bind(this);
        this._onIPCMessageReceived = this._onIPCMessageReceived.bind(this);

        this._onIPCLogReceived = this._onIPCLogReceived.bind(this);
    }

    getWindowTarget(window: Electron.BrowserWindow, frameId?: number): IpcBusPeer | undefined {
        let result: IpcBusPeer;
        if (frameId === undefined) {
            for (const endpoint of this._endpoints.values()) {
                if (endpoint.process.wcid === window.webContents.id && endpoint.process.isMainFrame) {
                    result = endpoint;
                    break;
                }
            }
        } else {
            for (const endpoint of this._endpoints.values()) {
                if (endpoint.process.wcid === window.webContents.id && endpoint.process.frameid === frameId) {
                    result = endpoint;
                    break;
                }
            }
        }
        return result;
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        if (this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return GetTargetRenderer(ipcMessage) !== undefined;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(_options: ClientConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onIPCCommandReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onIPCCommandReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this._onIPCMessageReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this._onIPCMessageReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP, this._onIPCLogReceived);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP, this._onIPCLogReceived);

        return Promise.resolve();
    }

    broadcastClose(_options?: ClientCloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onHandshakeReceived);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this._onIPCCommandReceived);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this._onIPCMessageReceived);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP, this._onIPCLogReceived);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Process/es (Electron ipc)
    // =================================================================================================
    private _onHandshakeReceived(event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand): void {
        const logger = CreateIpcBusLog();
        const webContents = event.sender;
        const realPeer = ipcCommand.peer as IpcBusRendererPeer;

        // Inherit from the peer.process and then complete missing information
        realPeer.process.wcid = webContents.id;
        realPeer.process.frameid = event.frameId;
        // Following functions are not implemented in all Electrons
        try {
            realPeer.process.rid = event.processId || webContents.getProcessId();
        } catch (err) {
            realPeer.process.rid = -1;
        }
        try {
            realPeer.process.pid = webContents.getOSProcessId();
        } catch (err) {
            // For backward we fill pid with webContents id
            realPeer.process.pid = webContents.id;
        }

        this._trackRendererDestruction(webContents);

        const peerCopy = { ...realPeer };
        const endpoint: IpcBusPeerProcessEndpoint = Object.assign(realPeer, { webContents });
        const key = CreateKeyForEndpoint(realPeer);
        this._endpoints.set(key, endpoint);
        if (event.ports) {
            endpoint.messagePort = event.ports[0];
            endpoint.messagePort.on('close', () => {
                this._onEndpointShutdown(ipcCommand);
            });
            endpoint.messagePort.addListener('message', this._onPortMessageReceived);
            endpoint.messagePort.start();

            endpoint.commandPort = event.ports[1];
            if (endpoint.commandPort) {
                endpoint.commandPort.on('close', () => {
                    this._onEndpointShutdown(ipcCommand);
                });
                endpoint.commandPort.addListener('message', this._onPortCommandReceived);
                endpoint.commandPort.start();
            }
        }

        const handshake: ConnectorHandshake = {
            peer: peerCopy,
            logLevel: logger.level,
        };
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        const frameTarget: [number, number] = [event.processId, event.frameId];
        if (webContents.getURL()) {
            if (this._earlyIPCIssueFixed) {
                webContents.sendToFrame(frameTarget, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake);
                return;
            }
            if (!webContents.isLoadingMainFrame()) {
                webContents.sendToFrame(frameTarget, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake);
                return;
            }
        }
        webContents.on('did-finish-load', () => {
            webContents.sendToFrame(frameTarget, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake);
        });
    }

    private _trackRendererDestruction(webContents: Electron.WebContents): void {
        // When webContents is destroyed some properties like id are no more accessible !
        const webContentsId = webContents.id;
        webContents.once('destroyed', () => {
            // Have to remove this webContents, included its frames
            const entries = this._subscriptions.getConns().filter((entry) => {
                return entry.data.process.wcid === webContentsId;
            });
            for (let i = 0, l = entries.length; i < l; ++i) {
                this.deleteEndpointKey(entries[i].key);
            }
        });
    }

    private deleteEndpointKey(key: string): void {
        const endpoint = this._endpoints.get(key);
        if (endpoint) {
            this._endpoints.delete(key);
            this._subscriptions.remove(key);

            if (endpoint.messagePort) {
                endpoint.messagePort.close();
                endpoint.messagePort.removeListener('message', this._onPortMessageReceived);
                endpoint.messagePort = undefined;
            }

            if (endpoint.commandPort) {
                endpoint.commandPort.close();
                endpoint.commandPort.removeListener('message', this._onPortCommandReceived);
                endpoint.commandPort = undefined;
            }
        }
    }

    private _onEndpointHandshake(_ipcCommand: IpcBusCommand) {}

    private _onEndpointShutdown(ipcCommand: IpcBusCommand) {
        const key = CreateKeyForEndpoint(ipcCommand.peer);
        this.deleteEndpointKey(key);
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        this._endpoints.forEach((endpoint) => {
            // endpoint.commandPort.postMessage(ipcCommand);
            const frameTarget: [number, number] = [endpoint.process.rid, endpoint.process.frameid];
            endpoint.webContents.sendToFrame(frameTarget, IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcCommand);
        });
    }

    broadcastBuffers(_ipcMessage: IpcBusMessage, _buffers: Buffer[]): boolean {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        const rawData = ipcPacketBufferCore.getRawData() as IpcPacketBuffer.RawData;
        return this._broadcastData(false, ipcMessage, rawData);
    }

    // From renderer transport
    broadcastData(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBuffer.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ): boolean {
        return this._broadcastData(false, ipcMessage, data, messagePorts);
    }

    // From renderer transport
    private _broadcastData(
        local: boolean,
        ipcMessage: IpcBusMessage,
        data: IpcPacketBuffer.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ): boolean {
        const target = GetTargetRenderer(ipcMessage);
        if (target) {
            const key = CreateKeyForEndpoint(target);
            const endpoint = this._endpoints.get(key);
            if (endpoint) {
                if (!messagePorts) {
                    const frameTarget: [number, number] = [endpoint.process.rid, endpoint.process.frameid];
                    endpoint.webContents.sendToFrame(frameTarget, IPCBUS_TRANSPORT_RENDERER_MESSAGE, ipcMessage, data);
                } else {
                    endpoint.messagePort.postMessage([ipcMessage, data], messagePorts);
                }
            }
            return true;
        }
        if (ipcMessage.kind === IpcBusCommandKind.SendMessage) {
            const channelConns = this._subscriptions.getChannelConns(ipcMessage.channel);
            if (channelConns) {
                const key = local ? CreateKeyForEndpoint(ipcMessage.peer) : -1;
                if (!messagePorts) {
                    channelConns.forEach((entry) => {
                        // Prevent echo message
                        if (entry.key !== key) {
                            const frameTarget: [number, number] = [entry.data.process.rid, entry.data.process.frameid];
                            entry.data.webContents.sendToFrame(
                                frameTarget,
                                IPCBUS_TRANSPORT_RENDERER_MESSAGE,
                                ipcMessage,
                                data
                            );
                        }
                    });
                } else {
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

    private _onIPCLogReceived(_event: Electron.IpcMainEvent, ipcMessage: IpcBusMessage, args: unknown[]): void {
        this._bridge._onRendererLogReceived(ipcMessage, args);
    }

    private _onIPCCommandReceived(_event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand): boolean {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.Handshake:
                this._onEndpointHandshake(ipcCommand);
                return true;
            case IpcBusCommandKind.Shutdown:
                this._onEndpointShutdown(ipcCommand);
                return true;

            case IpcBusCommandKind.AddChannelListener: {
                const key = CreateKeyForEndpoint(ipcCommand.peer);
                const endpointWC = this._endpoints.get(key);
                if (endpointWC) {
                    this._subscriptions.addRef(ipcCommand.channel, key, endpointWC);
                }
                return true;
            }
            case IpcBusCommandKind.RemoveChannelListener: {
                const key = CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.release(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommandKind.RemoveChannelAllListeners: {
                const key = CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.releaseAll(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommandKind.RemoveListeners: {
                const key = CreateKeyForEndpoint(ipcCommand.peer);
                this._subscriptions.remove(key);
                return true;
            }

            case IpcBusCommandKind.QueryState:
            case IpcBusCommandKind.QueryStateResponse:
                this._bridge._onRendererCommandReceived(ipcCommand);
                return true;
        }
        return false;
    }

    private _onPortCommandReceived(event: Electron.MessageEvent): boolean {
        return this._onIPCCommandReceived(undefined, event.data as IpcBusCommand);
    }

    private _onIPCMessageReceived(
        _event: Electron.IpcMainEvent,
        ipcMessage: IpcBusMessage,
        data: IpcPacketBufferCore.RawData | unknown[]
    ): void {
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
            const processChannelJSON = (processChannelsJSON[channel] = {
                name: channel,
                refCount: 0,
            });
            const channelConns = this._subscriptions.getChannelConns(channel);
            channelConns.forEach((clientRef) => {
                processChannelJSON.refCount += clientRef.refCount;
                const endpoint = clientRef.data;
                const processID = createProcessID(endpoint, endpoint.process);
                const peerJSON = (peersJSON[processID] = peersJSON[processID] || {
                    peer: endpoint,
                    channels: {},
                });
                const peerChannelJSON = (peerJSON.channels[channel] = peerJSON.channels[channel] || {
                    name: channel,
                    refCount: 0,
                });
                peerChannelJSON.refCount += clientRef.refCount;
            });
        }

        const results: QueryStateRendererBridge = {
            type: 'renderer-bridge',
            contextId: createContextId(this._contextType),
            channels: processChannelsJSON,
            peers: peersJSON,
        };
        return results;
    }
}
