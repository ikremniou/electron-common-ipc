// import { IpcPacketBuffer } from 'socket-serializer';
import type { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';
import { CreateIpcBusLog } from './log/IpcBusLog-factory';
import { ConnectCloseState, CreateProcessID } from './IpcBusUtils';

export function CreateProcessId(process: Client.IpcBusProcess): string {
    let name = `${process.type}`;
    if (process.wcid) {
        name += `-${process.wcid}`;
    }
    if (process.frameid) {
        name += `-f${process.frameid}`;
    }
    if (process.rid && (process.rid !== process.wcid)) {
        name += `-r${process.rid}`;
    }
    if (process.pid) {
        name += `-p${process.pid}`;
    }
    return name;
}

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _peerProcess: Client.IpcBusPeerProcess;
    protected _messageCount: number;
    protected _log: IpcBusLogConfig;

    protected _connectCloseState: ConnectCloseState<IpcBusConnector.Handshake>;

    constructor(contextType: Client.IpcBusProcessType) {
        this._peerProcess = {
            process: {
                type: contextType,
                pid: process ? process.pid: -1
            }
        };

        this._connectCloseState = new ConnectCloseState<IpcBusConnector.Handshake>();

        this._log = CreateIpcBusLog();
        this._messageCount = 0;
    }

    get peer() {
        return this._peerProcess;
    }

    protected onConnectorBeforeShutdown() {
        this._client && this._client.onConnectorBeforeShutdown();
        const shutdownCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.Shutdown,
            channel: ''
        };
        this.postCommand(shutdownCommand);
    }

    protected onConnectorHandshake() {
        const handshakeCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.Handshake,
            channel: ''
        };
        this.postCommand(handshakeCommand);
    }

    protected onConnectorShutdown() {
        this._connectCloseState.shutdown();
        this._client && this._client.onConnectorShutdown();
        this.removeClient();
    }

    protected addClient(client: IpcBusConnector.Client) {
        this._client = client;
    }

    protected removeClient() {
        this._client = null;
    }

    stampMessage(ipcMessage: IpcBusMessage) {
        const timestamp = this._log.now;
        const id = `${CreateProcessID(this._peerProcess.process)}.${this._messageCount++}`;
        ipcMessage.stamp = {
            local: false,
            id,
            kind: ipcMessage.kind,
            timestamp,
            peer: ipcMessage.peer
        }
    }

    stampResponse(ipcMessage: IpcBusMessage) {
        if (ipcMessage.stamp) {
            ipcMessage.stamp.timestamp_response = this._log.now;
            ipcMessage.stamp.kind = ipcMessage.kind;
        }
    }

    ackMessage(ipcMessage: IpcBusMessage, local: boolean, related_peer: Client.IpcBusPeer) {
        if (ipcMessage.stamp) {
            ipcMessage.rawData = false;
            ipcMessage.stamp.timestamp_received = this._log.now;
            ipcMessage.stamp.local = local;
            ipcMessage.stamp.peer_received = related_peer;
        }
    }

    ackResponse(ipcMessage: IpcBusMessage, local: boolean) {
        if (ipcMessage.stamp) {
            ipcMessage.rawData = false;
            ipcMessage.stamp.timestamp_response_received = this._log.now;
            ipcMessage.stamp.response_local = local;
        }
    }

    onCommandReceived(ipcCommand: IpcBusCommand): void {
        this._client.onCommandReceived(ipcCommand);
    }

    abstract isTarget(ipcMessage: IpcBusMessage): boolean;

    abstract handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    abstract postMessage(ipcMessage: IpcBusMessage, args?: any[], messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): void;
    abstract postMessage(ipcMessage: IpcBusMessage, args?: any[]): void;
    abstract postCommand(ipcCommand: IpcBusCommand): void;

    abstract postLogRoundtrip(ipcMessage: IpcBusMessage, args?: any[]): void;
}
