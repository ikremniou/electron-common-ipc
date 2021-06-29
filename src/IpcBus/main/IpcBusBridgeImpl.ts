/// <reference types='electron' />

import { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import type * as Bridge from './IpcBusBridge';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';

import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusTransportSocketBridge } from './IpcBusSocketBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge'; 
import type { IpcBusTransport } from '../IpcBusTransport'; 
import { IpcBusBrokerBridge } from './IpcBusBrokerBridge';
import { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';
import { JSONParserV1 } from 'json-helpers';

export interface IpcBusBridgeClient {
    getChannels(): string[];
    isTarget(ipcMessage: IpcBusMessage): boolean;

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    broadcastBuffers(ipcCommand: IpcBusCommand, buffers: Buffer[]): void;
    broadcastArgs(ipcCommand: IpcBusCommand, args: any[]): void;
    broadcastPacket(ipcCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void;
    broadcastRawData(ipcCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): void;
}

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _socketTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusRendererBridge;
    protected _packetOut: IpcPacketBuffer;

    private _useIPCNativeSerialization: boolean;
    // private _useIPCFrameAPI: boolean

    constructor(contextType: Client.IpcBusProcessType) {
        this._useIPCNativeSerialization = true;
        // this._useIPCFrameAPI = true;
        const mainConnector = new IpcBusBridgeConnectorMain(contextType, this);
        this._mainTransport = new IpcBusBridgeTransportMain(mainConnector);
        this._rendererConnector = new IpcBusRendererBridge(this);
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;
    }

    // get useIPCFrameAPI(): boolean {
    //     return this._useIPCFrameAPI;
    // }

    get useIPCNativeSerialization(): boolean {
        return this._useIPCNativeSerialization;
    }

    get mainTransport(): IpcBusTransport {
        return this._mainTransport;
    }

    getEndpointForWindow(window: Electron.BrowserWindow): Client.IpcBusEndpoint | undefined {
        return this._rendererConnector.getEndpointForWindow(window);
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
        this._useIPCNativeSerialization = options.useIPCNativeSerialization ?? true;
        return this._rendererConnector.broadcastConnect(options)
        .then(() => {
            if (this._socketTransport == null) {
                if ((options.port != null) || (options.path != null)) {
                    if (options.server === true) {
                        this._socketTransport = new IpcBusBrokerBridge('main', this);
                    }
                    else {
                        const connector = new IpcBusConnectorSocket('main');
                        this._socketTransport = new IpcBusTransportSocketBridge(connector, this);
                    }
                    return this._socketTransport.broadcastConnect(options)
                    .catch(err => {
                        this._socketTransport = null;
                    });
                }
            }
            else {
                if ((options.port == null) && (options.path == null)) {
                    const socketTransport = this._socketTransport;
                    this._socketTransport = null;
                    return socketTransport.broadcastClose();
                }
            }
            return Promise.resolve();
        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._rendererConnector.broadcastClose()
        .then(() => {
            if (this._socketTransport) {
                const socketTransport = this._socketTransport;
                this._socketTransport = null;
                return socketTransport.broadcastClose();
            }
            return Promise.resolve();
        });
    }

    getChannels(): string[] {
        const rendererChannels = this._rendererConnector.getChannels();
        const mainChannels = this._mainTransport.getChannels();
        return rendererChannels.concat(mainChannels);
    }

    // This is coming from the Electron Main Process (Electron main ipc)
    // This is coming from the Electron Renderer Process (Electron main ipc)
    // =================================================================================================
    _onBridgeChannelChanged(ipcCommand: IpcBusCommand) {
        if (this._socketTransport) {
            ipcCommand.kind = (IpcBusCommand.KindBridgePrefix + ipcCommand.kind) as IpcBusCommand.Kind;
            this._packetOut.serialize([ipcCommand]);
            this._socketTransport.broadcastPacket(ipcCommand, this._packetOut);
        }
    }

    // This is coming from the Electron Renderer Process (Electron renderer ipc)
    // =================================================================================================
    _onRendererContentReceived(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData) {
        this._mainTransport.onConnectorRawDataReceived(ipcMessage, rawData);
        this._socketTransport && this._socketTransport.broadcastRawData(ipcMessage, rawData);
    }

    _onRendererArgsReceived(ipcMessage: IpcBusMessage, args: any[]) {
        this._mainTransport.onConnectorArgsReceived(ipcMessage, args);
        const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
        // Prevent serializing for nothing !
        if (hasSocketChannel) {
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            this._socketTransport.broadcastPacket(ipcMessage, this._packetOut);
        }
    }

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainMessageReceived(ipcMessage: IpcBusMessage, args?: any[]) {
        const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
        if (this._useIPCNativeSerialization) {
            this._rendererConnector.broadcastArgs(ipcMessage, args);
            // Prevent serializing for nothing !
            if (hasSocketChannel) {
                JSONParserV1.install();
                this._packetOut.serialize([ipcMessage, args]);
                JSONParserV1.uninstall();
                this._socketTransport.broadcastPacket(ipcMessage, this._packetOut);
            }
        }
        else {
            const hasRendererChannel = this._rendererConnector.isTarget(ipcMessage);
            // Prevent serializing for nothing !
            if (hasRendererChannel || hasSocketChannel) {
                JSONParserV1.install();
                this._packetOut.serialize([ipcMessage, args]);
                JSONParserV1.uninstall();
                hasSocketChannel && this._socketTransport.broadcastPacket(ipcMessage, this._packetOut);
                hasRendererChannel && this._rendererConnector.broadcastPacket(ipcMessage, this._packetOut);
            }
        }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore) {
        // If we receive a message from Socket, it would mean the channel has been already checked on socket server side
        // if (this._useIPCNativeSerialization) {
        //     // Unserialize only once
        //     const args = ipcPacketBufferCore.parseArrayAt(1);
        //     this._mainTransport.onConnectorArgsReceived(ipcCommand, args);
        //     this._rendererConnector.broadcastArgs(ipcCommand, args);
        // }
        // else {
            this._mainTransport.onConnectorPacketReceived(ipcMessage, ipcPacketBufferCore);
            this._rendererConnector.broadcastPacket(ipcMessage, ipcPacketBufferCore);
        // }
    }

    _onSocketClosed() {
        this._socketTransport = null;
    }
}

