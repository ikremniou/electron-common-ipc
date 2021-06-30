/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';
import { IpcPacketBuffer } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionMap } from '../IpcBusChannelMap';

import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_RENDERER_MESSAGE_RAWDATA,
    IPCBUS_RENDERER_MESSAGE_ARGS,
    IPCBUS_RENDERER_COMMAND,
} from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import * as IpcBusUtils from '../IpcBusUtils';

interface IpcBusEndpointWebContents extends Client.IpcBusProcess {
    webContents: Electron.WebContents;
}
 
// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;

    private _subscriptions: ChannelConnectionMap<IpcBusEndpointWebContents, number>;
    private _endpoints: Map<number, IpcBusEndpointWebContents>;

    private _packetOut: IpcPacketBuffer;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        this._ipcMain = require('electron').ipcMain;

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

        this._onRendererMessageRawDataReceived = this._onRendererMessageRawDataReceived.bind(this);
        this._onRendererMessageArgsReceived = this._onRendererMessageArgsReceived.bind(this);
        this._onRendererCommandReceived = this._onRendererCommandReceived.bind(this);
        this._onRendererTransportHandshake = this._onRendererTransportHandshake.bind(this);
    }

    getWindowTarget(window: Electron.BrowserWindow): Client.IpcBusProcess | undefined {
        let result: Client.IpcBusProcess;
        for (const endpoint of this._endpoints.values()) {
            if (endpoint.wcid === window.webContents.id && endpoint.isMainFrame) {
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
        return IpcBusUtils.GetTargetRenderer(ipcMessage) != null;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_RENDERER_MESSAGE_RAWDATA, this._onRendererMessageRawDataReceived);
        this._ipcMain.addListener(IPCBUS_RENDERER_MESSAGE_RAWDATA, this._onRendererMessageRawDataReceived);

        this._ipcMain.removeListener(IPCBUS_RENDERER_MESSAGE_ARGS, this._onRendererMessageArgsReceived);
        this._ipcMain.addListener(IPCBUS_RENDERER_MESSAGE_ARGS, this._onRendererMessageArgsReceived);

        this._ipcMain.removeListener(IPCBUS_RENDERER_COMMAND, this._onRendererCommandReceived);
        this._ipcMain.addListener(IPCBUS_RENDERER_COMMAND, this._onRendererCommandReceived);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);

        return Promise.resolve();
    }

    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_RENDERER_MESSAGE_RAWDATA, this._onRendererTransportHandshake);
        this._ipcMain.removeListener(IPCBUS_RENDERER_MESSAGE_ARGS, this._onRendererMessageArgsReceived);
        this._ipcMain.removeListener(IPCBUS_RENDERER_COMMAND, this._onRendererCommandReceived);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _getTransportHandshake(event: Electron.IpcMainEvent, endpoint: Client.IpcBusProcess): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();
        const webContents = event.sender;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            endpoint,
            logLevel: logger.level,
        };
        handshake.endpoint.wcid = webContents.id;
        handshake.endpoint.frameid = event.frameId;
        // Following functions are not implemented in all Electrons
        try {
            handshake.endpoint.rid = webContents.getProcessId();
        }
        catch (err) {
            handshake.endpoint.rid = -1;
        }
        try {
            handshake.endpoint.pid = webContents.getOSProcessId();
        }
        catch (err) {
            // For backward we fill pid with webContents id
            handshake.endpoint.pid = webContents.id;
        }
        handshake.useIPCNativeSerialization = this._bridge.useIPCNativeSerialization;

        const key = IpcBusUtils.CreateKeyForEndpoint(handshake.endpoint);
        webContents.once('destroyed', () => {
            this._subscriptions.removeKey(key);
        });

        return handshake;
    }

    private _onRendererTransportHandshake(event: Electron.IpcMainEvent, endpoint: Client.IpcBusProcess): void {
        const webContents = event.sender;
        const handshake = this._getTransportHandshake(event, endpoint);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, endpoint, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, endpoint, handshake);
            });
        }
    }

    private _onEndpointHandshake(event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand) {
        const webContents = event.sender;
        const endpoint: IpcBusEndpointWebContents = { ...ipcCommand.process, webContents };
        const key = IpcBusUtils.CreateKeyForEndpoint(endpoint);
        this._endpoints.set(key, endpoint);
        webContents.once('destroyed', () => {
            this._endpoints.delete(key);
        });
    }

    private _onEndpointShutdown(event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand) {
        const endpoint = ipcCommand.process;
        const key = IpcBusUtils.CreateKeyForEndpoint(endpoint);
        this._endpoints.delete(key);
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        throw 'not implemented';
    }

    broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): void {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): void {
        const rawData = ipcPacketBufferCore.getRawData() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawData);
        this._broadcastData(false, IPCBUS_RENDERER_MESSAGE_RAWDATA, ipcMessage, rawData);
    }

    // From renderer transport
    private _broadcastData(local: boolean, ipcChannel: string, ipcMessage: IpcBusMessage, data: any): boolean {
        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const target = IpcBusUtils.GetTargetRenderer(ipcMessage);
                if (target) {
                    const key = IpcBusUtils.CreateKeyForEndpoint(target);
                    const endpoint = this._endpoints.get(key);
                    if (endpoint) {
                        endpoint.webContents.sendToFrame(endpoint.frameid, ipcChannel, ipcMessage, data);
                    }
                    return true;
                }
                const key = local ? IpcBusUtils.CreateKeyForEndpoint(ipcMessage.peer.process): -1;
                this._subscriptions.forEachChannel(ipcMessage.channel, (connData) => {
                    // Prevent echo message
                    if (connData.key !== key) {
                        connData.data.webContents.sendToFrame(connData.data.frameid, ipcChannel, ipcMessage, data);
                    }
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const target = IpcBusUtils.GetTargetRenderer(ipcMessage);
                if (target) {
                    const key = IpcBusUtils.CreateKeyForEndpoint(target);
                    const endpoint = this._endpoints.get(key);
                    if (endpoint) {
                        endpoint.webContents.sendToFrame(endpoint.frameid, ipcChannel, ipcMessage, data);
                    }
                    return true;
                }
                break;
            }

            // case IpcBusCommand.Kind.RequestClose:
            //     break;
        }
        return false;
    }

    broadcastRawData(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData) {
        this._broadcastData(false, IPCBUS_RENDERER_MESSAGE_RAWDATA, ipcMessage, rawData);
    }

    // From renderer transport
    broadcastArgs(ipcMessage: IpcBusMessage, args: any) {
        try {
            this._broadcastData(false, IPCBUS_RENDERER_MESSAGE_ARGS, ipcMessage, args);
        }
        catch (err) {
            // maybe an object does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            const rawData = this._packetOut.getRawData();
            this._broadcastData(false, IPCBUS_RENDERER_MESSAGE_RAWDATA, ipcMessage, rawData);
        }
    }

    private _onRendererCommandReceived(event: Electron.IpcMainEvent, ipcCommand: IpcBusCommand): boolean {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.Handshake: 
                this._onEndpointHandshake(event, ipcCommand);
                return true;
            case IpcBusCommand.Kind.Shutdown:
                this._onEndpointShutdown(event, ipcCommand);
                return true;

            case IpcBusCommand.Kind.AddChannelListener: {
                const key = IpcBusUtils.CreateKeyForEndpoint(ipcCommand.process);
                const endpointWC = this._endpoints.get(key);
                this._subscriptions.addRef(ipcCommand.channel, key, endpointWC);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelListener: {
                const key = IpcBusUtils.CreateKeyForEndpoint(ipcCommand.process);
                this._subscriptions.release(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelAllListeners: {
                const key = IpcBusUtils.CreateKeyForEndpoint(ipcCommand.process);
                this._subscriptions.releaseAll(ipcCommand.channel, key);
                return true;
            }
            case IpcBusCommand.Kind.RemoveListeners: {
                const key = IpcBusUtils.CreateKeyForEndpoint(ipcCommand.process);
                this._subscriptions.removeKey(key);
                return true;
            }
        }
        return false;
    }

    private _onRendererMessageRawDataReceived(event: Electron.IpcMainEvent, ipcMessage: IpcBusMessage, rawData: IpcBusRendererContent) {
        if (this._broadcastData(true, IPCBUS_RENDERER_MESSAGE_RAWDATA, ipcMessage, rawData) === false) {
            IpcBusRendererContent.FixRawContent(rawData);
            this._bridge._onRendererRawDataReceived(ipcMessage, rawData);
        }
    }

    private _onRendererMessageArgsReceived(event: any, ipcMessage: IpcBusMessage, args: any[]) {
        try {
            if (this._broadcastData(true, IPCBUS_RENDERER_MESSAGE_ARGS, ipcMessage, args) === false) {
                this._bridge._onRendererArgsReceived(ipcMessage, args);
            }
        }
        catch (err) {
            // maybe an object does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            const rawData = this._packetOut.getRawData();
            if (this._broadcastData(true, IPCBUS_RENDERER_MESSAGE_RAWDATA, ipcMessage, rawData) === false) {
                IpcBusRendererContent.FixRawContent(rawData);
                this._bridge._onRendererRawDataReceived(ipcMessage, rawData);
            }
        }
    }
}

