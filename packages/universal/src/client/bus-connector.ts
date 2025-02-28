import type { ClientCloseOptions, ClientConnectOptions } from './bus-client';
import type { BusMessagePort } from './message-ports';
import type { IpcBusCommand, IpcBusCommandBase } from '../contract/ipc-bus-command';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer, IpcBusProcessType } from '../contract/ipc-bus-peer';
import type { QueryStateConnector } from '../contract/query-state';
import type { ContractLogLevel } from '../log/ipc-bus-log-config';
import type { IpcPacketBufferCore } from 'socket-serializer';

export interface ConnectorHandshake {
    peer: IpcBusPeer;
    logLevel?: ContractLogLevel;
}

export interface IpcBusConnectorClient {
    peers: IpcBusPeer[];
    onConnectorArgsReceived(
        ipcMessage: IpcBusMessage,
        args: unknown[],
        messagePorts?: ReadonlyArray<BusMessagePort>
    ): boolean;
    onConnectorPacketReceived(
        ipcMessage: IpcBusMessage,
        ipcPacketBufferCore: IpcPacketBufferCore,
        messagePorts?: ReadonlyArray<BusMessagePort>
    ): boolean;
    onConnectorCommandBase(ipcCommandBase: IpcBusCommandBase, ipcPacketBufferCore?: IpcPacketBufferCore): void;
    onConnectorBeforeShutdown(): void;
    onConnectorShutdown(): void;

    onLogReceived(ipcMessage: IpcBusMessage, args?: unknown[], ipcPacketBufferCore?: IpcPacketBufferCore): void;
    onMessageReceived(
        local: boolean,
        ipcMessage: IpcBusMessage,
        args?: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore,
        messagePorts?: ReadonlyArray<BusMessagePort>
    ): boolean;
    onRequestResponseReceived(
        local: boolean,
        ipcResponse: IpcBusMessage,
        args: unknown[],
        ipcPacketBufferCore?: IpcPacketBufferCore
    ): boolean;
}

export interface PostCommandFunction {
    (ipcCommand: IpcBusCommand): void;
}

export interface PostMessageFunction {
    (ipcMessage: IpcBusMessage, args?: unknown[], messagePorts?: BusMessagePort[]): void;
}

export interface IpcBusConnector {
    readonly type: IpcBusProcessType;

    handshake(client: IpcBusConnectorClient, peer: IpcBusPeer, opts: ClientConnectOptions): Promise<ConnectorHandshake>;
    shutdown(opts?: ClientCloseOptions): Promise<void>;
    postCommand(ipcCommand: IpcBusCommand): void;
    postMessage(ipcMessage: IpcBusMessage, args?: unknown[], messagePorts?: BusMessagePort[]): void;
    queryState(): QueryStateConnector;
}
