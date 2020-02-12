import { IpcPacketBuffer } from 'socket-serializer';

import { IpcBusCommand } from './IpcBusCommand';
import * as Client from './IpcBusClient';
import { IpcBusLogConfig } from './log/IpcBusLogConfig';

/** @internal */
export namespace IpcBusConnector {
    /** @internal */
    export interface Handshake {
        process: Client.IpcBusProcess;
        logLevel: IpcBusLogConfig.Level;
        noSerialization?: boolean;
    }

    /** @internal */
    export interface Client {
        peer: Client.IpcBusPeer;
        onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void;
        onConnectorBufferReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void;
        onConnectorArgsReceived(ipcBusCommand: IpcBusCommand, args: any[]): void;
        onConnectorShutdown(): void;
    }
}

/** @internal */
export interface IpcBusConnector {
    readonly process: Client.IpcBusProcess | null;

    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    shutdown(client: IpcBusConnector.Client, options: Client.IpcBusClient.CloseOptions): Promise<void>;
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void;
    postBuffer(buffer: Buffer): void;

    logMessageCreation(previousLog: IpcBusCommand.Log, ipcBusCommand: IpcBusCommand): IpcBusCommand.Log;
    logLocalResponse(previousLog: IpcBusCommand.Log, ipcBusCommand: IpcBusCommand, args: any[]): void;
    logMessageReceived(peer: Client.IpcBusPeer, local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): IpcBusCommand.Log;
}

