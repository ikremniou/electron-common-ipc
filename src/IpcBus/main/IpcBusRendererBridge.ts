/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';
import { IpcPacketBuffer } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import * as IpcBusUtils from '../IpcBusUtils';
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

interface IpcBusPeerWC extends Client.IpcBusPeer {
    webContents?: Electron.WebContents;
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;
    private _subscriptions: ChannelConnectionMap<IpcBusPeerWC, string>;
    private _peers: Map<string, IpcBusPeerWC>;

    private _packetOut: IpcPacketBuffer;

    private _rendererRawDataCallback: (...args: any[]) => void;
    private _rendererArgsCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new ChannelConnectionMap('IPCBus:RendererBridge');
        this._peers = new Map();

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
        this._onRendererHandshake = this._onRendererHandshake.bind(this);
    }

    getPeerForWindow(window: Electron.BrowserWindow): Client.IpcBusPeer | undefined {
        let result: Client.IpcBusPeer;
        for (const peer of this._peers.values()) {
            if (peer.process.wcid === window.webContents.id && peer.process.isMainFrame) {
                result = peer;
                break;
            }
        }
        return result;
    }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel) || IpcBusUtils.IsWebContentsChannel(channel);
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

        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        this._ipcMain.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);

        return Promise.resolve();
    }

    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._onRendererHandshake);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._rendererArgsCallback);
        this._ipcMain.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._onRendererHandshake);
        return Promise.resolve();
    }

    // This is coming from the Electron Renderer Proces/s (Electron ipc)
    // =================================================================================================
    private _getHandshake(event: Electron.IpcMainEvent, peer: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();
        const webContents = event.sender;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: peer.process,
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
        // handshake.useIPCFrameAPI = this._bridge.useIPCNativeSerialization;
        const peerWC: IpcBusPeerWC = { ...peer, webContents };
        this._peers.set(peer.id, peerWC );
       
        this._trackRendererDestruction(peerWC);

        return handshake;
    }

    private _trackRendererDestruction(peerWC: IpcBusPeerWC): void {
        const webContents = peerWC.webContents;
        webContents.once('destroyed', () => {
            this._subscriptions.removeKey(peerWC.id);
            this._peers.delete(peerWC.id);
        });
    }

    private _onRendererHandshake(event: Electron.IpcMainEvent, peer: Client.IpcBusPeer): void {
        const webContents = event.sender;
        const handshake = this._getHandshake(event, peer);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peer, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.sendToFrame(event.frameId, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peer, handshake);
            });
        }
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
                if (ipcBusCommand.target) {
                    const peer = this._peers.get(ipcBusCommand.target);
                    if (peer) {
                        peer.webContents.sendToFrame(peer.process.frameid, ipcChannel, ipcBusCommand, data);
                    }
                }
                else {
                    const id = local ? ipcBusCommand.peer.id: - 1;
                    this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                        // Prevent echo message
                        if (connData.conn.id !== id) {
                            // if (this._bridge.useIPCFrameAPI) {
                                connData.conn.webContents.sendToFrame(connData.conn.process.frameid, ipcChannel, ipcBusCommand, data);
                            // }
                            // else {
                            //     connData.conn.webContents.send(ipcchannel, ipcBusCommand, data);
                            // }
                        }
                    });
                }
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                // First use target
                let peerId = ipcBusCommand.target;
                if (peerId == null) {
                    const webContentsTargetIds = IpcBusUtils.GetWebContentsIdentifierFromString(ipcBusCommand.request.replyChannel);
                    if (webContentsTargetIds) {
                        peerId = webContentsTargetIds.peerid;
                    }
                }
                if (peerId) {
                    const peer = this._peers.get(peerId);
                    if (peer) {
                        peer.webContents.sendToFrame(peer.process.frameid, ipcChannel, ipcBusCommand, data);
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

    private _onRendererAdminReceived(ipcBusCommand: IpcBusCommand): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener: {
                const peerWC = this._peers.get(ipcBusCommand.peer.id);
                this._subscriptions.addRef(ipcBusCommand.channel, peerWC.id, peerWC, ipcBusCommand.peer);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, ipcBusCommand.peer.id, ipcBusCommand.peer);
                return true;
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, ipcBusCommand.peer.id, ipcBusCommand.peer);
                return true;
            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                return true;
        }
        return false;
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawData: IpcBusRendererContent) {
        if (this._onRendererAdminReceived(ipcBusCommand) === false) {
            if (this._broadcastData(true, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData) === false) {
                IpcBusRendererContent.FixRawContent(rawData);
                this._bridge._onRendererContentReceived(ipcBusCommand, rawData);
            }
        }
    }

    private _onRendererArgsReceived(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._onRendererAdminReceived(ipcBusCommand) === false) {
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

