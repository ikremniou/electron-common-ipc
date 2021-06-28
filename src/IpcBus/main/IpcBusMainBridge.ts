/// <reference types='electron' />

import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
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

        this.postMessage = this.postCommand;
    }

    isTarget(ipcBusCommand: IpcBusCommand): boolean {
        return IpcBusUtils.GetTargetMain(ipcBusCommand) != null;
    }
    
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this._peer.process,
            logLevel: this._log.level
        }
        return Promise.resolve(handshake);
    }

    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        // fake body
    }

    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        ipcBusCommand.peer = this._peer;
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
            case IpcBusCommand.Kind.RemoveListeners:
                throw 'IpcBusTransportMultiImpl - should not happen';
    
            case IpcBusCommand.Kind.AddChannelListener:
            case IpcBusCommand.Kind.RemoveChannelListener:
                this._bridge._onBridgeChannelChanged(ipcBusCommand);
                break;

            default :
                this._bridge._onMainMessageReceived(ipcBusCommand, args);
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

    // broadcastBuffers(ipcBusCommand: IpcBusCommand, buffers: Buffer[]): void {
    //     throw 'not implemented';
    // }

    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
    //     this.onConnectorArgsReceived(ipcBusCommand, args);
    // }

    // broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): void {
    //     this.onConnectorPacketReceived(ipcBusCommand, ipcPacketBufferCore);
    // }

    // broadcastRawData(ipcBusCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): void {
    //     this.onConnectorRawDataReceived(ipcBusCommand, rawData);
    // }
}