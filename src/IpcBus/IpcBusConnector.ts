import type { IpcPacketBufferCore, IpcPacketBuffer } from 'socket-serializer';

import type { IpcBusCommand } from './IpcBusCommand';
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
        onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
        onConnectorRawDataReceived(ipcBusCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): boolean;
        onConnectorArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]): boolean;
        onConnectorBeforeShutdown(): void;
        onConnectorShutdown(): void;
    }
}

export interface PostCommandFunction {
    (ipcBusCommand: IpcBusCommand, args?: any[]): void;
}

export interface PostMessageFunction {
    (ipcBusCommand: IpcBusCommand, args?: any[]): void;
}

/** @internal */
export interface IpcBusConnector {
    isTarget(ipcBusCommand: IpcBusCommand): boolean;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postBuffers(buffers: Buffer[]): void;

    logMessageSend(previousLog: IpcBusCommand.Log, ipcBusCommand: IpcBusCommand): IpcBusCommand.Log;
    logLocalMessage(peer: Client.IpcBusPeer, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
    logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
}

