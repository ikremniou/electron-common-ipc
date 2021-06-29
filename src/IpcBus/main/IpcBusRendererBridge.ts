/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';
import { IpcPacketBuffer } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import type { IpcBusConnector } from '../IpcBusConnector';
import { ChannelConnectionMap } from '../IpcBusChannelMap';

import {
    IPCBUS_TRANSPORT_RENDERER_HANDSHAKE,
    IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA,
    IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS
} from '../renderer/IpcBusConnectorRenderer';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import * as IpcBusUtils from '../IpcBusUtils';

interface IpcBusEndpointWC extends Client.IpcBusEndpoint {
    webContents?: Electron.WebContents;
}

function createKeyFromEvent(wcId: number, frameId: number) {
    return (wcId<< 8) + frameId;
}
 
// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;

    private _subscriptions: ChannelConnectionMap<IpcBusEndpointWC, number>;
    private _endpoints: Map<number, IpcBusEndpointWC>;

    private _packetOut: IpcPacketBuffer;

    private _rendererRawDataCallback: (...args: any[]) => void;
    private _rendererArgsCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        this._ipcMain = require('electron').ipcMain;

        this._subscriptions = new ChannelConnectionMap('IPCBus:RendererBridge');
        this._endpoints = new Map();

        this._subscriptions.client = {
            channelAdded: (channel) => {
                const ipcBusCommand: IpcBusCommand = {
                    peer: undefined,
                    kind: IpcBusCommand.Kind.AddChannelListener,
                    channel
                }
                this._bridge._onBridgeChannelChanged(ipcBusCommand);
            },
            channelRemoved: (channel) => {
                const ipcBusCommand: IpcBusCommand = {
                    peer: undefined,
                    kind: IpcBusCommand.Kind.RemoveChannelListener,
                    channel
                }
                this._bridge._onBridgeChannelChanged(ipcBusCommand);
            }
        };

        this._rendererRawDataCallback = this._onRendererRawContentReceived.bind(this);
        this._rendererArgsCallback = this._onRendererArgsReceived.bind(this);
        this._onRendererTransportHandshake = this._onRendererTransportHandshake.bind(this);
    }

    getEndpointForWindow(window: Electron.BrowserWindow): Client.IpcBusEndpoint | undefined {
        let result: Client.IpcBusEndpoint;
        for (const endpoint of this._endpoints.values()) {
            if (endpoint.wcid === window.webContents.id && endpoint.isMainFrame) {
                result = endpoint;
                break;
            }
        }
        return result;
    }

    isTarget(ipcBusCommand: IpcBusCommand): boolean {
        if (this._subscriptions.hasChannel(ipcBusCommand.channel)) {
            return true;
        }
        return IpcBusUtils.GetTargetRenderer(ipcBusCommand) != null;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        // To manage re-entrance
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._rendererRawDataCallback);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._rendererRawDataCallback);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._rendererArgsCallback);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._rendererArgsCallback);

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);

        return Promise.resolve();
    }

    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._onRendererTransportHandshake);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._rendererArgsCallback);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererTransportHandshake);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _getTransportHandshake(event: Electron.IpcMainEvent, peerEndpoint: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();
        const webContents = event.sender;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: peerEndpoint.process,
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

        const key = createKeyFromEvent(handshake.process.wcid, handshake.process.frameid);
        webContents.once('destroyed', () => {
            this._subscriptions.removeKey(key);
        });

        return handshake;
    }

    private _onRendererTransportHandshake(event: Electron.IpcMainEvent, peerEndpoint: Client.IpcBusPeer): void {
        const webContents = event.sender;
        const handshake = this._getTransportHandshake(event, peerEndpoint);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peerEndpoint, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peerEndpoint, handshake);
            });
        }
    }

    private _onEndpointHandshake(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand) {
        const webContents = event.sender;
        const peerEndpoint = { ...ipcBusCommand.peer.process, webContents };
        const key = createKeyFromEvent(peerEndpoint.wcid, peerEndpoint.frameid);
        this._endpoints.set(key, peerEndpoint);
        webContents.once('destroyed', () => {
            this._endpoints.delete(key);
        });
    }

    private _onEndpointShutdown(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand) {
        const peerEndpoint = ipcBusCommand.peer;
        const key = createKeyFromEvent(peerEndpoint.process.wcid, peerEndpoint.process.frameid);
        this._endpoints.delete(key);
    }

    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        const rawData = ipcPacketBufferCore.getRawData() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawData);
        this._broadcastData(false, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
    }

    // From renderer transport
    private _broadcastData(local: boolean, ipcChannel: string, ipcBusCommand: IpcBusCommand, data: any): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const target = IpcBusUtils.GetTargetRenderer(ipcBusCommand, true);
                if (target) {
                    const key = createKeyFromEvent(target.wcid, target.frameid);
                    const endpoint = this._endpoints.get(key);
                    if (endpoint) {
                        endpoint.webContents.sendToFrame(endpoint.frameid, ipcChannel, ipcBusCommand, data);
                    }
                    return true;
                }
                const key = local ? createKeyFromEvent(ipcBusCommand.peer.process.wcid, ipcBusCommand.peer.process.frameid): -1;
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    // Prevent echo message
                    if (connData.key !== key) {
                        connData.conn.webContents.sendToFrame(connData.conn.frameid, ipcChannel, ipcBusCommand, data);
                    }
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const target = IpcBusUtils.GetTargetRenderer(ipcBusCommand, true);
                if (target) {
                    const key = createKeyFromEvent(target.wcid, target.frameid);
                    const endpoint = this._endpoints.get(key);
                    if (endpoint) {
                        endpoint.webContents.sendToFrame(endpoint.frameid, ipcChannel, ipcBusCommand, data);
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

    broadcastRawData(ipcBusCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData) {
        this._broadcastData(false, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
    }

    // From renderer transport
    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any) {
        try {
            this._broadcastData(false, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
        }
        catch (err) {
            // maybe an object does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([ipcBusCommand, args]);
            JSONParserV1.uninstall();
            const rawData = this._packetOut.getRawData();
            this._broadcastData(false, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
        }
    }

    private _onRendererAdminReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.Handshake: 
                this._onEndpointHandshake(event, ipcBusCommand);
                return true;
            case IpcBusCommand.Kind.Shutdown:
                this._onEndpointShutdown(event, ipcBusCommand);
                return true;

            case IpcBusCommand.Kind.AddChannelListener: {
                const key = createKeyFromEvent(event.sender.id, event.frameId);
                const endpoint = this._endpoints.get(key);
                this._subscriptions.addRef(ipcBusCommand.channel, key, endpoint, ipcBusCommand.peer);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelListener: {
                const key = createKeyFromEvent(event.sender.id, event.frameId);
                this._subscriptions.release(ipcBusCommand.channel, key, ipcBusCommand.peer);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelAllListeners: {
                const key = createKeyFromEvent(event.sender.id, event.frameId);
                this._subscriptions.releaseAll(ipcBusCommand.channel, key, ipcBusCommand.peer);
                return true;
            }
            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                return true;
        }
        return false;
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawData: IpcBusRendererContent) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            if (this._broadcastData(true, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData) === false) {
                IpcBusRendererContent.FixRawContent(rawData);
                this._bridge._onRendererContentReceived(ipcBusCommand, rawData);
            }
        }
    }

    private _onRendererArgsReceived(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            try {
                if (this._broadcastData(true, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args) === false) {
                    this._bridge._onRendererArgsReceived(ipcBusCommand, args);
                }
            }
            catch (err) {
                // maybe an object does not supporting Electron serialization !
                JSONParserV1.install();
                this._packetOut.serialize([ipcBusCommand, args]);
                JSONParserV1.uninstall();
                const rawData = this._packetOut.getRawData();
                if (this._broadcastData(true, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData) === false) {
                    IpcBusRendererContent.FixRawContent(rawData);
                    this._bridge._onRendererContentReceived(ipcBusCommand, rawData);
                }
            }
        }
    }
}

