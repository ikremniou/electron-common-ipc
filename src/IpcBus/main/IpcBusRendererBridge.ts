/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';
import type { IpcPacketBuffer } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionMap } from '../IpcBusChannelMap';

import { IPCBUS_TRANSPORT_RENDERER_HANDSHAKE } from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';

let electron: any;
try {
    // Will work in a preload or with nodeIntegration=true
    electron = require('electron');
}
catch (err) {
}

interface IpcBusPeerProcessEndpoint extends Client.IpcBusPeerProcess {
    messagePort: Electron.MessagePortMain;
    commandPort: Electron.MessagePortMain;
}
 
// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;
    
    private _subscriptions: ChannelConnectionMap<IpcBusPeerProcessEndpoint, number>;
    private _endpoints: Map<number, IpcBusPeerProcessEndpoint>;

    protected _serializeMessage: IpcBusCommandHelpers.SerializeMessage;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
        this._serializeMessage = new IpcBusCommandHelpers.SerializeMessage();

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

        this._onCommandReceived = this._onCommandReceived.bind(this);
        this._onHandshakeReceived = this._onHandshakeReceived.bind(this);
        this._onMessageReceived = this._onMessageReceived.bind(this);
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
        handshake.useIPCNativeSerialization = this._bridge.useIPCNativeSerialization;

        const endpoint: IpcBusPeerProcessEndpoint = Object.assign(ipcCommand.peer, { 
            commandPort: event.ports[0],
            messagePort: event.ports[1]
        });
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
        this._endpoints.set(key, endpoint);

        endpoint.messagePort.on('close', () => {
            this._onEndpointShutdown(ipcCommand);
        });
        endpoint.commandPort.on('close', () => {
            this._onEndpointShutdown(ipcCommand);
        });

        endpoint.messagePort.addListener('message', this._onMessageReceived);
        endpoint.messagePort.start();

        endpoint.commandPort.addListener('message', this._onCommandReceived);
        endpoint.commandPort.start();

        endpoint.commandPort.postMessage(handshake);

        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        // See https://github.com/electron/electron/issues/25119
        // if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
        //     webContents.postMessage(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake, [this._messageChannel.port2]);
        // }
        // else {
        //     webContents.on('did-finish-load', () => {
        //         webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, handshake, [this._messageChannel.port2]);
        //     });
        // }
    }

    private _onEndpointHandshake(ipcCommand: IpcBusCommand) {
    }

    private _onEndpointShutdown(ipcCommand: IpcBusCommand) {
        const key = IpcBusCommandHelpers.CreateKeyForEndpoint(ipcCommand.peer);
        const endpoint = this._endpoints.get(key);
        if (endpoint && this._endpoints.delete(key)) {
            this._subscriptions.remove(key);

            endpoint.messagePort.close();
            endpoint.messagePort.removeListener('message', this._onMessageReceived);

            endpoint.commandPort.close();
            endpoint.commandPort.removeListener('message', this._onCommandReceived);
        }
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        throw 'not implemented';
    }

    broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        const rawData = ipcPacketBufferCore.getRawData() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawData);
        return this._broadcastData(false, ipcMessage, rawData);
    }

    // From renderer transport
    broadcastArgs(ipcMessage: IpcBusMessage, args: any, messagePorts?: Electron.MessagePortMain[]): boolean {
        return this._broadcastData(false, ipcMessage, args, messagePorts);
    }

    broadcastRawData(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData, messagePorts?: Electron.MessagePortMain[]): boolean {
        return this._broadcastData(false, ipcMessage, rawData, messagePorts);
    }

    // From renderer transport
    private _broadcastData(local: boolean, ipcMessage: IpcBusMessage, data: any, messagePorts?: Electron.MessagePortMain[]): boolean {
        const target = IpcBusCommandHelpers.GetTargetRenderer(ipcMessage);
        if (target) {
            const key = IpcBusCommandHelpers.CreateKeyForEndpoint(target);
            const endpoint = this._endpoints.get(key);
            if (endpoint) {
                // Electron has issue with a "undefined" ports arg
                messagePorts = messagePorts || [];
                endpoint.messagePort.postMessage([ipcMessage, data], messagePorts);
            }
            return true;
        }
        if (ipcMessage.kind === IpcBusCommand.Kind.SendMessage) {
            // Electron has issue with a "undefined" ports arg
            messagePorts = messagePorts || [];
            const key = local ? IpcBusCommandHelpers.CreateKeyForEndpoint(ipcMessage.peer): -1;
            this._subscriptions.forEachChannel(ipcMessage.channel, (connData) => {
                // Prevent echo message
                if (connData.key !== key) {
                    connData.data.messagePort.postMessage([ipcMessage, data], messagePorts);
                }
            });
        }
        return false;
    }

    private _onCommandReceived(event: Electron.MessageEvent): boolean {
        const ipcCommand = event.data as IpcBusCommand;
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
        }
        return false;
    }

    private _onMessageReceived(event: Electron.MessageEvent): void {
        const [ipcMessage, data] = event.data;
        if (this._broadcastData(true, ipcMessage, data, event.ports) === false) {
            this._bridge._onRendererMessageReceived(ipcMessage, data, event.ports);
        }
    }
}

