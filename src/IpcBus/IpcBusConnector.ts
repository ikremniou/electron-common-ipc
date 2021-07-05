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
        useIPCNativeSerialization?: boolean;
        // useIPCFrameAPI?: boolean;
    }

    /** @internal */
    export interface Client {
        // peer: Client.IpcBusPeer;
        onConnectorPacketReceived(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
        onConnectorRawDataReceived(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData): boolean;
        onConnectorArgsReceived(ipcMessage: IpcBusMessage, args: any[]): boolean;
        onConnectorBeforeShutdown(): void;
        onConnectorShutdown(): void;
    }
}

export interface PostCommandFunction {
    (ipcCommand: IpcBusCommand): void;
}

export interface PostMessageFunction {
    (ipcMessage: IpcBusMessage, args?: any[]): void;
}

/** @internal */
export interface IpcBusConnector {
    isTarget(ipcMessage: IpcBusMessage): boolean;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    postMessage(ipcBusMessage: IpcBusMessage, args?: any[]): void;
    postCommand(ipcCommand: IpcBusCommand): void;

    // logMessageSend(previousLog: IpcBusMessage.Log, ipcMessage: IpcBusMessage): IpcBusCommand.Log;
    // logLocalMessage(peer: Client.IpcBusPeer, ipcMessage: IpcBusMessage, args: any[]): IpcBusCommand.Log;
    // logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcMessage: IpcBusMessage, args: any[]): IpcBusCommand.Log;
}

