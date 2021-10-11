import type { IpcPacketBufferCore, IpcPacketBuffer } from 'socket-serializer';

import type { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
        logLevel: IpcBusLogConfig.Level;
    }

    /** @internal */
    export interface Client {
        // peer: Client.IpcBusPeer;
        onConnectorRawDataReceived(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData, messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean;
        onConnectorArgsReceived(ipcMessage: IpcBusMessage, args: any[], messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean;

        onMessageReceived(local: boolean, ipcMessage: IpcBusMessage, args?: any[], ipcPacketBufferCore?: IpcPacketBufferCore, messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): boolean;
        onRequestResponseReceived(local: boolean, ipcResponse: IpcBusMessage, args: any[], ipcPacketBufferCore?: IpcPacketBufferCore): boolean;
        onCommandReceived(ipcCommand: IpcBusCommand): void;

        onConnectorBeforeShutdown(): void;
        onConnectorShutdown(): void;
    }
}

export interface PostCommandFunction {
    (ipcCommand: IpcBusCommand): void;
}

export interface PostMessageFunction {
    (ipcMessage: IpcBusMessage, args?: any[], messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): void;
}

/** @internal */
export interface IpcBusConnector {
    readonly peer: Client.IpcBusPeerProcess;

    isTarget(ipcMessage: IpcBusMessage): boolean;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    postMessage(ipcMessage: IpcBusMessage, args?: any[], messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): void;
    postCommand(ipcCommand: IpcBusCommand): void;

    onCommandReceived(ipcCommand: IpcBusCommand): void;

    stampMessage(ipcMessage: IpcBusMessage): void;
    ackMessage(ipcBusMessage: IpcBusMessage, related_peer: Client.IpcBusPeer): void;
    ackResponse(ipcBusMessage: IpcBusMessage): void;
    stampResponse(ipcBusMessage: IpcBusMessage, args?: any[], response?: any): void;
    logRoundtrip(ipcBusMessage: IpcBusMessage): void;

    // logMessageSend(previousLog: IpcBusMessage.Log, ipcMessage: IpcBusMessage): IpcBusCommand.Log;
    // logLocalMessage(peer: Client.IpcBusPeer, ipcMessage: IpcBusMessage, args: any[]): IpcBusCommand.Log;
    // logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcMessage: IpcBusMessage, args: any[]): IpcBusCommand.Log;
}

