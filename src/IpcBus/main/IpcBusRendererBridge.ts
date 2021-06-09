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

interface WebContentsTarget {
    key: number;
    webContents: Electron.WebContents;
    frameid: number;
}

function getWebContentsTargetFromEvent(event: Electron.IpcMainEvent): WebContentsTarget {
    return { key: createKeyFromEvent(event), webContents: event.sender, frameid: event.frameId };
}

function createKeyFromEvent(event: Electron.IpcMainEvent) {
    return (event.sender.id << 8) + event.frameId;
}


// Even if electron is not use in a Node process
// Static import of electron crash the Node process (use require)
// import { webContents } from 'electron';
let electronModule: any;
try {
    electronModule = require('electron');
}
catch (err) {
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;
    private _ipcMain: Electron.IpcMain;
    private _subscriptions: ChannelConnectionMap<WebContentsTarget, number>;
    private _peers: Client.IpcBusPeer[];

    private _packetOut: IpcPacketBuffer;

    private _rendererRawDataCallback: (...args: any[]) => void;
    private _rendererArgsCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new ChannelConnectionMap('IPCBus:RendererBridge');
        this._peers = [];

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
        const peer = this._peers.find((cur) => cur.process.wcid === window.webContents.id && cur.process.isMainFrame);
        return peer;
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
    private _getHandshake(webContentsTarget: WebContentsTarget, peer: Client.IpcBusPeer): IpcBusConnector.Handshake {
        const logger = CreateIpcBusLog();
        const webContents = webContentsTarget.webContents;

        // Inherit from the peer.process and then complete missing information
        const handshake: IpcBusConnector.Handshake = {
            process: peer.process,
            logLevel: logger.level,
        };
        handshake.process.wcid = webContents.id;
        handshake.process.frameid = webContentsTarget.frameid;
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
        const index = this._peers.findIndex((cur) => cur.id === peer.id);
        if (index >= 0) {
            this._peers[index] = peer;
        }
        else {
            this._peers.push(peer);
        }
        
        this._trackRendererDestruction(webContentsTarget, peer);

        return handshake;
    }

    private _trackRendererDestruction(webContentsTarget: WebContentsTarget, peer: Client.IpcBusPeer): void {
        const webContents = webContentsTarget.webContents;
        webContents.once('destroyed', () => {
            this._subscriptions.removeKey(webContentsTarget.key);
            const index = this._peers.findIndex((cur) => cur.id === peer.id);
            if (index >= 0) {
                this._peers.splice(index, 1);
            }
        });
    }

    private _onRendererHandshake(event: Electron.IpcMainEvent, peer: Client.IpcBusPeer): void {
        const webContents = event.sender;
        const webContentsTarget = getWebContentsTargetFromEvent(event);

        const handshake = this._getHandshake(webContentsTarget, peer);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.sendToFrame(webContentsTarget.frameid, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peer, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.sendToFrame(webContentsTarget.frameid, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peer, handshake);
                // webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, peer, handshake);
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
        this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
    }

    // From renderer transport
    private _broadcastData(event: Electron.IpcMainEvent | null, ipcChannel: string, ipcBusCommand: IpcBusCommand, data: any): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                if (ipcBusCommand.target) {
                    const webContents = electronModule.webContents.fromId(ipcBusCommand.target.process.wcid);
                    if (webContents) {
                        webContents.send(ipcChannel, ipcBusCommand, data);
                        // webContents.sendToFrame(webContentsTargetIds.frameid, ipcchannel, ipcBusCommand, data);
                    }
                }
                else {
                    const key = event ? createKeyFromEvent(event) : -1;
                    this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                        // Prevent echo message
                        if (connData.key !== key) {
                            // if (this._bridge.useIPCFrameAPI) {
                                connData.conn.webContents.sendToFrame(connData.conn.frameid, ipcChannel, ipcBusCommand, data);
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
                const webContentsTargetIds = IpcBusUtils.GetWebContentsIdentifierFromString(ipcBusCommand.request.replyChannel);
                if (webContentsTargetIds) {
                    const webContents = electronModule.webContents.fromId(webContentsTargetIds.wcid);
                    if (webContents) {
                        webContents.sendToFrame(webContentsTargetIds.frameid, ipcChannel, ipcBusCommand, data);
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
        this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
    }

    // From renderer transport
    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any) {
        try {
            this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
        }
        catch (err) {
            // maybe an object does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([ipcBusCommand, args]);
            JSONParserV1.uninstall();
            const rawData = this._packetOut.getRawData();
            this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
        }
    }

    private _onRendererAdminReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener: {
                const webContentsTarget = getWebContentsTargetFromEvent(event);
                this._subscriptions.addRef(ipcBusCommand.channel, webContentsTarget.key, webContentsTarget, ipcBusCommand.peer);
                return true;
            }
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, createKeyFromEvent(event), ipcBusCommand.peer);
                return true;
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, createKeyFromEvent(event), ipcBusCommand.peer);
                return true;
            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                return true;
        }
        return false;
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawData: IpcBusRendererContent) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            if (this._broadcastData(event, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData) === false) {
                IpcBusRendererContent.FixRawContent(rawData);
                this._bridge._onRendererContentReceived(ipcBusCommand, rawData);
            }
        }
    }

    private _onRendererArgsReceived(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            try {
                if (this._broadcastData(event, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args) === false) {
                    this._bridge._onRendererArgsReceived(ipcBusCommand, args);
                }
            }
            catch (err) {
                // maybe an object does not supporting Electron serialization !
                JSONParserV1.install();
                this._packetOut.serialize([ipcBusCommand, args]);
                JSONParserV1.uninstall();
                const rawData = this._packetOut.getRawData();
                if (this._broadcastData(event, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData) === false) {
                    IpcBusRendererContent.FixRawContent(rawData);
                    this._bridge._onRendererContentReceived(ipcBusCommand, rawData);
                }
            }
        }
    }
}

