/// <reference types='electron' />

import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../IpcBusTransportMultiImpl';
import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import * as IpcBusUtils from '../IpcBusUtils';

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(contextType);
        this._bridge = bridge;
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return IpcBusUtils.GetTargetMain(ipcMessage) != null;
    }
    
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            endpoint: this._process,
            logLevel: this._log.level
        }
        return Promise.resolve(handshake);
    }

    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postMessage(ipcBusMessage: IpcBusMessage, args?: any[]): void {
        this._bridge._onMainMessageReceived(ipcBusMessage, args);
    }

    postCommand(ipcCommand: IpcBusCommand, args?: any[]): void {
        ipcCommand.process = this._process;
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
            case IpcBusCommand.Kind.RemoveListeners:
                throw 'IpcBusTransportMultiImpl - should not happen';
    
            case IpcBusCommand.Kind.AddChannelListener:
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._bridge._onBridgeChannelChanged(ipcCommand);
                break;
        }
    }

    postBuffers(buffers: Buffer[]) {
        throw 'not implemented';
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
    // broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
    //     throw 'not implemented';
    // }

    // broadcastClose(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
    //     throw 'not implemented';
    // }

    // broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): void {
    //     throw 'not implemented';
    // }

    // broadcastArgs(ipcMessage: IpcBusMessage, args: any[]): void {
    //     this.onConnectorArgsReceived(ipcCommand, args);
    // }

    // broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): void {
    //     this.onConnectorPacketReceived(ipcCommand, ipcPacketBufferCore);
    // }

    // broadcastRawData(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData): void {
    //     this.onConnectorRawDataReceived(ipcCommand, rawData);
    // }
}