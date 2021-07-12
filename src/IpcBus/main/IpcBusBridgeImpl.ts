/// <reference types='electron' />

import type { IpcPacketBufferCore } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';
import type * as Client from '../IpcBusClient';
import type * as Bridge from './IpcBusBridge';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';

import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusTransportSocketBridge } from './IpcBusSocketBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge'; 
import type { IpcBusTransport } from '../IpcBusTransport'; 
import { IpcBusBrokerBridge } from './IpcBusBrokerBridge';
import { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';
import type { QueryStateBase, QueryStateResponse } from '../IpcBusQueryState';

export interface IpcBusBridgeClient {
    getChannels(): string[];
    isTarget(ipcMessage: IpcBusMessage): boolean;

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void>;
    broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    broadcastCommand(ipcCommand: IpcBusCommand): void;
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
    broadcastData(ipcMessage: IpcBusMessage, data: any, messagePorts?: Electron.MessagePortMain[]): boolean;

    queryState(): QueryStateBase;
}

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _socketTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusRendererBridge;
    protected _serializeMessage: IpcBusCommandHelpers.SerializeMessage;

    constructor(contextType: Client.IpcBusProcessType) {
        const mainConnector = new IpcBusBridgeConnectorMain(contextType, this);
        this._mainTransport = new IpcBusBridgeTransportMain(mainConnector);
        this._rendererConnector = new IpcBusRendererBridge(this);

        this._serializeMessage = new IpcBusCommandHelpers.SerializeMessage();
    }

    get mainTransport(): IpcBusTransport {
        return this._mainTransport;
    }

    getWindowTarget(window: Electron.BrowserWindow): Client.IpcBusPeerProcess | undefined {
        return this._rendererConnector.getWindowTarget(window);
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
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

    postQueryState() {
        const ipcQueryState: IpcBusCommand = {
            kind: IpcBusCommand.Kind.QueryState,
            channel: 'titi'
        };
        const rendererQueryState = this._rendererConnector.queryState();
        console.log(`QueryState: ${JSON.stringify(rendererQueryState)}`);
        this._rendererConnector.broadcastCommand(ipcQueryState);
        const mainQueryState = this._mainTransport.queryState();
        console.log(`QueryState: ${JSON.stringify(mainQueryState)}`);
        this._mainTransport.onCommandReceived(ipcQueryState);
        if (this._socketTransport) {
            const socketQueryState = this._socketTransport.queryState();
            console.log(`QueryState: ${JSON.stringify(socketQueryState)}`);
            this._socketTransport.broadcastCommand(ipcQueryState);
        }
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
            this._socketTransport.broadcastCommand(ipcCommand);
        }
    }

    // This is coming from the Electron Renderer Process (Electron renderer ipc)
    // =================================================================================================
    _onRendererCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.QueryStateResponse: {
                const queryStatResponse = (ipcCommand as any).data as QueryStateResponse;
                console.log(`QueryState: ${JSON.stringify(queryStatResponse)}`);
                break;
            }
        }
    }

    _onRendererMessageReceived(ipcMessage: IpcBusMessage, data: any, messagePorts?: Electron.MessagePortMain[]) {
        if (ipcMessage.rawData) {
            // Electron IPC "corrupts" Buffer to a Uint8Array
            IpcBusRendererContent.FixRawContent(data);
            if (this._mainTransport.onConnectorRawDataReceived(ipcMessage, data, messagePorts) === false) {
                const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
                // Prevent serializing for nothing !
                if (hasSocketChannel) {
                    this._socketTransport.broadcastData(ipcMessage, data, messagePorts);
                }
            }
        }
        else {
            if (this._mainTransport.onConnectorArgsReceived(ipcMessage, data, messagePorts) === false) {
                const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
                // Prevent serializing for nothing !
                if (hasSocketChannel) {
                    const packet = this._serializeMessage.serialize(ipcMessage, data);
                    this._socketTransport.broadcastPacket(ipcMessage, packet);
                }
            }
        }
    }

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.QueryStateResponse: {
                const queryStatResponse = (ipcCommand as any).data as QueryStateResponse;
                console.log(`QueryState: ${JSON.stringify(queryStatResponse)}`);
                break;
            }
        }
    }

    _onMainMessageReceived(ipcMessage: IpcBusMessage, data: any, messagePorts?: Electron.MessagePortMain[]) {
        if (this._rendererConnector.broadcastData(ipcMessage, data, messagePorts) === false) {
            const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
            if (hasSocketChannel) {
                if (ipcMessage.rawData) {
                    this._socketTransport.broadcastPacket(ipcMessage, data);
                }
                else {
                    const packet = this._serializeMessage.serialize(ipcMessage, data);
                    this._socketTransport.broadcastPacket(ipcMessage, packet);
                }
            }
        }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onSocketCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.QueryStateResponse: {
                const queryStatResponse = (ipcCommand as any).data as QueryStateResponse;
                console.log(`QueryState: ${JSON.stringify(queryStatResponse)}`);
                break;
            }
        }
    }

    _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        if (this._mainTransport.onMessageReceived(false, ipcMessage, undefined, ipcPacketBufferCore) === false) {
            return this._rendererConnector.broadcastPacket(ipcMessage, ipcPacketBufferCore);
        }
        return true;
    }

    _onSocketRequestResponseReceived(ipcResponse: IpcBusMessage, ipcPacketBufferCore?: IpcPacketBufferCore): boolean {
        if (this._mainTransport.onRequestResponseReceived(false, ipcResponse, undefined, ipcPacketBufferCore) === false) {
            return this._rendererConnector.broadcastPacket(ipcResponse, ipcPacketBufferCore);
        }
        return true;
    }
   
    _onSocketClosed() {
        this._socketTransport = null;
    }
}

