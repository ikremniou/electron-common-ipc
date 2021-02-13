/// <reference types='electron' />

// import * as semver from 'semver';
import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

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
    webContents: Electron.WebContents;
    frameid: number;
}

function getWebContentsTargetFromEvent(event: Electron.IpcMainEvent): WebContentsTarget {
    // if (event.frameId === IpcBusUtils.TopFrameId) {
    //     return { webContents: event.sender, frameid: 0 };
    // }
    // else {
        return { webContents: event.sender, frameid: event.frameId };
    // }
}

function getKeyForTargetFromEvent(event: Electron.IpcMainEvent) {
    // if (event.frameId === IpcBusUtils.TopFrameId) {
    //     return (event.sender.id << 8);
    // }
    // else {
        return (event.sender.id << 8) + event.frameId;
    // }
}

// function getKeyForTarget(webContentsTarget: WebContentsTarget) {
//     const key = (webContentsTarget.webContents.id << 8) + webContentsTarget.frameId;
//     // if (key == 0) throw 'getKeyForTarget';
//     return key;
// }

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

    private _rendererRawDataCallback: (...args: any[]) => void;
    private _rendererArgsCallback: (...args: any[]) => void;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._ipcMain = require('electron').ipcMain;
        this._subscriptions = new ChannelConnectionMap<WebContentsTarget, number>('IPCBus:RendererBridge');

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
        handshake.useIPCNativeSerialization = this._bridge.noSerialization;
        return handshake;
    }

    private _trackRendererDestruction(webContents: Electron.WebContents): void {
        // When webContents is destroyed some properties like id are no more accessible !
        const webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            // Have to remove this webContents, included its frames
            const webContentsTargets = this._subscriptions.getConns().filter((item) => {
                const webContentIdentifiers = IpcBusUtils.UnserializeWebContentsIdentifier(item.key);
                return (webContentIdentifiers.wcid === webContentsId);
            });
            for (let i = 0, l = webContentsTargets.length; i < l; ++i) {
                this._subscriptions.removeKey(webContentsTargets[i].key);
            }
        });
    }

    private _onRendererHandshake(event: Electron.IpcMainEvent, ipcBusPeer: Client.IpcBusPeer): void {
        const webContents = event.sender;
        const webContentsTarget: WebContentsTarget = getWebContentsTargetFromEvent(event);

        this._trackRendererDestruction(webContents);

        const handshake = this._getHandshake(webContentsTarget, ipcBusPeer);
        // We get back to the webContents
        // - to confirm the connection
        // - to provide id/s
        // BEWARE, if the message is sent before webContents is ready, it will be lost !!!!
        // if (webContentsTarget.frameid > IpcBusUtils.TopFrameId) {
        //     webContents.sendToFrame(webContentsTarget.frameid, IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
        // }
        // else 
        if (webContents.getURL() && !webContents.isLoadingMainFrame()) {
            webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
        }
        else {
            webContents.on('did-finish-load', () => {
                webContents.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcBusPeer, handshake);
            });
        }
    }

    broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
        throw 'not implemented';
    }

    // From main or net transport
    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
        const rawContent = ipcPacketBufferCore.getRawData() as IpcBusRendererContent;
        // IpcBusRendererContent.PackRawContent(rawContent);
        this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawContent);
    }

    // From renderer transport
    private _broadcastData(event: Electron.IpcMainEvent | null, ipcchannel: string, ipcBusCommand: IpcBusCommand, data: any): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const key = event ? getKeyForTargetFromEvent(event) : -1;
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData) => {
                    // Prevent echo message
                    if (connData.key !== key) {
                        // if (connData.conn.frameid > IpcBusUtils.TopFrameId) {
                        //     connData.conn.webContents.sendToFrame(connData.conn.frameid, ipcchannel, ipcBusCommand, data);
                        // }
                        // else {
                            connData.conn.webContents.send(ipcchannel, ipcBusCommand, data);
                        // }
                    }
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const webContentsTargetIds = IpcBusUtils.GetWebContentsIdentifier(ipcBusCommand.request.replyChannel);
                if (webContentsTargetIds) {
                    const webContents = electronModule.webContents.fromId(webContentsTargetIds.wcid);
                    if (webContents) {
                        // if (webContentsTargetIds.frameid > IpcBusUtils.TopFrameId) {
                        //     webContents.sendToFrame(webContentsTargetIds.frameid, ipcchannel, ipcBusCommand, data);
                        // }
                        // else {
                            webContents.send(ipcchannel, ipcBusCommand, data);
                        // }
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

    broadcastRawData(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawData) {
        this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawContent);
    }

    // From renderer transport
    broadcastArgs(ipcBusCommand: IpcBusCommand, args: any) {
        this._broadcastData(undefined, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
    }

    private _onRendererAdminReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, getKeyForTargetFromEvent(event), getWebContentsTargetFromEvent(event), ipcBusCommand.peer);
                return true;
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, getKeyForTargetFromEvent(event), ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, getKeyForTargetFromEvent(event), ipcBusCommand.peer);
                return true;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(ipcBusCommand.peer);
                return true;
        }
        return false;
    }

    private _onRendererRawContentReceived(event: Electron.IpcMainEvent, ipcBusCommand: IpcBusCommand, rawContent: IpcBusRendererContent) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            if (this._broadcastData(event, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawContent) === false) {
                IpcBusRendererContent.FixRawContent(rawContent);
                this._bridge._onRendererContentReceived(ipcBusCommand, rawContent);
            }
        }
    }

    private _onRendererArgsReceived(event: any, ipcBusCommand: IpcBusCommand, args: any[]) {
        if (this._onRendererAdminReceived(event, ipcBusCommand) === false) {
            if (this._broadcastData(event, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args) === false) {
                this._bridge._onRendererArgsReceived(ipcBusCommand, args);
            }
        }
    }
}

