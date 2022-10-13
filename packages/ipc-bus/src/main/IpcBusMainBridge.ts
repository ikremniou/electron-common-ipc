/// <reference types='electron' />

import type * as Client from '../client/IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../utils/IpcBusCommand';
// import { IpcBusTransportNet } from '../node/IpcBusTransportNet';
import type { IpcBusConnector } from '../client/IpcBusConnector';
import { IpcBusConnectorImpl } from '../client/IpcBusConnectorImpl';
import { IpcBusTransportMultiImpl } from '../client/IpcBusTransportMultiImpl';
import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import * as IpcBusCommandHelpers from '../utils/IpcBusCommand-helpers';

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(contextType);
        this._bridge = bridge;
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return IpcBusCommandHelpers.GetTargetMain(ipcMessage) != null;
    }
    
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        const handshake: IpcBusConnector.Handshake = {
            process: this._peerProcess.process,
            logLevel: this._log.level
        }
        return Promise.resolve(handshake);
    }

    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postMessage(ipcMessage: IpcBusMessage, args: any[], messagePorts?: Electron.MessagePortMain[]): void {
        // ipcMessage.process = this._process;
        // Seems to have a bug in Electron, undefined is not supported
        // messagePorts = messagePorts || [];
        this._bridge._onMainMessageReceived(ipcMessage, args, messagePorts);
    }

    postCommand(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.RemoveChannelAllListeners:
            case IpcBusCommand.Kind.RemoveListeners:
                throw 'IpcBusTransportMultiImpl - should not happen';
    
            case IpcBusCommand.Kind.AddChannelListener:
            case IpcBusCommand.Kind.RemoveChannelListener:
                ipcCommand.peer = ipcCommand.peer || this._peerProcess;
                this._bridge._onBridgeChannelChanged(ipcCommand);
                break;

            case IpcBusCommand.Kind.QueryState:
            case IpcBusCommand.Kind.QueryStateResponse:
                this._bridge._onMainCommandReceived(ipcCommand);
                break;
        }
    }

    postLogRoundtrip(ipcMessage: IpcBusMessage, args?: any[]) {
        this._bridge._onMainLogReceived(ipcMessage, args);
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMultiImpl { // implements IpcBusBridgeClient {
}