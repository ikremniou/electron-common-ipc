/// <reference types='electron' />

import { CheckConnectOptions, IpcBusCommandKind, IpcBusProcessType } from '@electron-common-ipc/universal';

import { IpcBusBrokerBridge } from './IpcBusBrokerBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge';
import { IpcBusQueryStateManager } from './IpcBusQueryState-collector';
import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusTransportSocketBridge } from './IpcBusSocketBridge';
import { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';
import { fixRawData } from '../utils';
import { SerializeMessage } from '../utils/IpcBusCommand-helpers';

import type { BridgeCloseOptions, BridgeConnectOptions, IpcBusBridge } from './IpcBusBridge';
import type {
    ClientCloseOptions,
    ClientConnectOptions,
    IpcBusPeer,
    Logger,
    MessageStamp,
    UuidProvider,
    IpcBusMessage,
    IpcBusTransport,
    QueryStateBase,
    IpcBusCommand,
    QueryStateResponse,
} from '@electron-common-ipc/universal';
import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

export interface IpcBusBridgeClient {
    getChannels(): string[];
    isTarget(ipcMessage: IpcBusMessage): boolean;

    broadcastConnect(options: ClientConnectOptions): Promise<void>;
    broadcastClose(options?: ClientCloseOptions): Promise<void>;

    broadcastCommand(ipcCommand: IpcBusCommand): void;
    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
    broadcastData(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBuffer.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ): boolean;

    queryState(): QueryStateBase;
}

export interface IpcBusBridgeDispatcher {
    // This is coming from the Electron Renderer Process (Electron renderer ipc)
    // =================================================================================================
    _onRendererCommandReceived(ipcCommand: IpcBusCommand): void;
    _onRendererLogReceived(ipcMessage: IpcBusMessage, data: IpcPacketBufferCore.RawData | unknown[]): void;
    _onRendererMessageReceived(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBufferCore.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ): void;

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainCommandReceived(ipcCommand: IpcBusCommand): void;
    _onMainLogReceived(ipcMessage: IpcBusMessage, args: unknown[]): void;
    _onMainMessageReceived(ipcMessage: IpcBusMessage, args: unknown[], messagePorts?: Electron.MessagePortMain[]): void;

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onSocketCommandReceived(ipcCommand: IpcBusCommand): void;
    _onSocketLogReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): void;
    _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
    _onSocketRequestResponseReceived(ipcResponse: IpcBusMessage, ipcPacketBufferCore?: IpcPacketBufferCore): boolean;
}

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
export class IpcBusBridgeImpl implements IpcBusBridge, IpcBusBridgeDispatcher {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _socketTransport: IpcBusBridgeClient;
    protected _rendererConnector: IpcBusRendererBridge;
    protected _serializeMessage: SerializeMessage;

    protected _queryStateManager: IpcBusQueryStateManager;

    constructor(
        contextType: IpcBusProcessType,
        private readonly _uuid: UuidProvider,
        private readonly _stamp?: MessageStamp,
        private readonly _logger?: Logger
    ) {
        const mainConnector = new IpcBusBridgeConnectorMain(this._uuid, contextType, this);
        this._mainTransport = new IpcBusBridgeTransportMain(mainConnector, this._uuid, this._stamp, this._logger);
        this._rendererConnector = new IpcBusRendererBridge(contextType, this);

        this._serializeMessage = new SerializeMessage();

        this._queryStateManager = new IpcBusQueryStateManager(this);
    }

    get mainTransport(): IpcBusTransport {
        return this._mainTransport;
    }

    get rendererTransport(): IpcBusRendererBridge {
        return this._rendererConnector;
    }

    get socketTransport(): IpcBusBridgeClient {
        return this._socketTransport;
    }

    getWindowTarget(window: Electron.BrowserWindow, frameId?: number): IpcBusPeer | undefined {
        return this._rendererConnector.getWindowTarget(window, frameId);
    }

    // IpcBusBridge API
    connect(
        arg1: BridgeConnectOptions | string | number,
        arg2?: BridgeConnectOptions | string,
        arg3?: BridgeConnectOptions
    ): Promise<void> {
        // To manage re-entrance
        const options = CheckConnectOptions(arg1, arg2, arg3);
        return this._rendererConnector.broadcastConnect(options).then(() => {
            if (this._socketTransport === undefined) {
                if (options.port || options.path) {
                    if (options.server === true) {
                        this._socketTransport = new IpcBusBrokerBridge(IpcBusProcessType.Main, this, this._logger);
                    } else {
                        const connector = new IpcBusConnectorSocket(this._uuid, IpcBusProcessType.Main);
                        this._socketTransport = new IpcBusTransportSocketBridge(
                            connector,
                            this,
                            this._uuid,
                            this._stamp,
                            this._logger
                        );
                    }
                    return this._socketTransport.broadcastConnect(options).catch(() => {
                        this._socketTransport = null;
                    });
                }
            } else if (!options.port && !options.path) {
                const socketTransport = this._socketTransport;
                this._socketTransport = null;
                return socketTransport.broadcastClose();
            }
            return Promise.resolve();
        });
    }

    close(_options?: BridgeCloseOptions): Promise<void> {
        return this._rendererConnector.broadcastClose().then(() => {
            if (this._socketTransport) {
                const socketTransport = this._socketTransport;
                this._socketTransport = null;
                return socketTransport.broadcastClose();
            }
            return Promise.resolve();
        });
    }

    startQueryState() {
        this._queryStateManager.start();
    }

    getQueryState() {
        return this._queryStateManager.processes;
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
            switch (ipcCommand.kind) {
                case IpcBusCommandKind.AddChannelListener:
                    ipcCommand.kind = IpcBusCommandKind.BridgeAddChannelListener;
                    break;
                case IpcBusCommandKind.RemoveChannelListener:
                    ipcCommand.kind = IpcBusCommandKind.BridgeRemoveChannelListener;
                    break;
                default:
                    throw new Error(`Invalid command for bridge channel change event: ${ipcCommand.kind}`);
            }
            this._socketTransport.broadcastCommand(ipcCommand);
        }
    }

    // This is coming from the Electron Renderer Process (Electron renderer ipc)
    // =================================================================================================
    _onRendererCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.QueryStateResponse: {
                const queryStateResponse = (ipcCommand as unknown as { data: QueryStateResponse }).data;
                this._queryStateManager.collect(queryStateResponse);
                break;
            }
        }
    }

    _onRendererLogReceived(_ipcMessage: IpcBusMessage, _data: IpcPacketBufferCore.RawData | unknown[]): void {}

    _onRendererMessageReceived(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBufferCore.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ) {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBufferCore.RawData;
            // Electron IPC "corrupts" Buffer to a Uint8Array
            const packetCore = fixRawData(rawData);
            if (this._mainTransport.onConnectorPacketReceived(ipcMessage, packetCore, messagePorts) === false) {
                const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
                // Prevent serializing for nothing !
                if (hasSocketChannel) {
                    this._socketTransport.broadcastData(ipcMessage, rawData, messagePorts);
                }
            }
        } else {
            const args = data as unknown[];
            if (this._mainTransport.onConnectorArgsReceived(ipcMessage, args, messagePorts) === false) {
                const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
                // Prevent serializing for nothing !
                if (hasSocketChannel) {
                    const packet = this._serializeMessage.serialize(ipcMessage, args);
                    this._socketTransport.broadcastPacket(ipcMessage, packet);
                }
            }
        }
    }

    // This is coming from the Electron Main Process (Electron main ipc)
    // =================================================================================================
    _onMainCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.QueryStateResponse: {
                const queryStateResponse = (ipcCommand as unknown as { data: QueryStateResponse }).data;
                this._queryStateManager.collect(queryStateResponse);
                break;
            }
        }
    }

    _onMainLogReceived(_ipcMessage: IpcBusMessage, _args: unknown[]): void {}

    _onMainMessageReceived(ipcMessage: IpcBusMessage, args: unknown[], messagePorts?: Electron.MessagePortMain[]) {
        if (this._rendererConnector.broadcastData(ipcMessage, args, messagePorts) === false) {
            const hasSocketChannel = this._socketTransport && this._socketTransport.isTarget(ipcMessage);
            if (hasSocketChannel) {
                // A message coming from main should be never a rawData but who knowns
                if (ipcMessage.isRawData) {
                    this._socketTransport.broadcastData(ipcMessage, args);
                } else {
                    const packet = this._serializeMessage.serialize(ipcMessage, args);
                    this._socketTransport.broadcastPacket(ipcMessage, packet);
                }
            }
        }
    }

    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onSocketCommandReceived(ipcCommand: IpcBusCommand) {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.QueryStateResponse: {
                const queryStateResponse = (ipcCommand as unknown as { data: QueryStateResponse }).data;
                this._queryStateManager.collect(queryStateResponse);
                break;
            }
        }
    }

    _onSocketLogReceived(_ipcMessage: IpcBusMessage, _ipcPacketBufferCore: IpcPacketBufferCore): void {}

    _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        if (this._mainTransport.onMessageReceived(false, ipcMessage, undefined, ipcPacketBufferCore) === false) {
            return this._rendererConnector.broadcastPacket(ipcMessage, ipcPacketBufferCore);
        }
        return true;
    }

    _onSocketRequestResponseReceived(ipcResponse: IpcBusMessage, ipcPacketBufferCore?: IpcPacketBufferCore): boolean {
        if (
            this._mainTransport.onRequestResponseReceived(false, ipcResponse, undefined, ipcPacketBufferCore) === false
        ) {
            return this._rendererConnector.broadcastPacket(ipcResponse, ipcPacketBufferCore);
        }
        return true;
    }

    _onSocketClosed() {
        this._socketTransport = null;
    }
}
