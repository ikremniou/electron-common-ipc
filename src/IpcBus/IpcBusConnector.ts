import type { IpcPacketBufferCore, IpcPacketBuffer } from 'socket-serializer';

import type { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        endpoint: Client.IpcBusEndpoint;
        logLevel: IpcBusLogConfig.Level;
        useIPCNativeSerialization?: boolean;
        // useIPCFrameAPI?: boolean;
    }

    /** @internal */
    export interface Client {
        // peer: Client.IpcBusPeer;
        onConnectorPacketReceived(ipcCommand: IpcBusCommand, ipcPacketBufferCore: IpcPacketBufferCore): boolean;
        onConnectorRawDataReceived(ipcCommand: IpcBusCommand, rawData: IpcPacketBuffer.RawData): boolean;
        onConnectorArgsReceived(ipcCommand: IpcBusCommand, args: any[]): boolean;
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
    postBuffers(buffers: Buffer[]): void;

    // logMessageSend(previousLog: IpcBusCommand.Log, ipcCommand: IpcBusCommand): IpcBusCommand.Log;
    // logLocalMessage(peer: Client.IpcBusPeer, ipcCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
    // logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
}

