// import { IpcPacketBuffer } from 'socket-serializer';
import type { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';
import { CreateIpcBusLog } from './log/IpcBusLog-factory';
import { ConnectCloseState, CreateProcessID } from './IpcBusUtils';
import { IpcBusLog } from './log/IpcBusLog';

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

    stampMessage(ipcMessage: IpcBusMessage, kindOverriden?: IpcBusLog.Kind) {
        const timestamp = this._log.now;
        const id = `${CreateProcessID(ipcMessage.peer.process)}.${this._messageCount++}`;
        ipcMessage.stamp = {
            local: false,
            id,
            kind: kindOverriden || ipcMessage.request ? IpcBusLog.Kind.SEND_REQUEST : IpcBusLog.Kind.SEND_MESSAGE,
            timestamp,
            peer: ipcMessage.peer
        }
    }

    stampResponse(ipcMessage: IpcBusMessage) {
        if (ipcMessage.stamp) {
            ipcMessage.stamp.timestamp_response = this._log.now;
            ipcMessage.stamp.kind = IpcBusLog.Kind.SEND_REQUEST_RESPONSE;
        }
    }

    ackMessage(ipcMessage: IpcBusMessage, args: any[], local: boolean, local_peer: Client.IpcBusPeer) {
        let timestamp = this._log.now;
        if (ipcMessage.stamp == null) {
            local = false;
            this.stampMessage(ipcMessage);
            ipcMessage.stamp.timestamp = timestamp;
        }
        ipcMessage.stamp.kind = ipcMessage.request ? IpcBusLog.Kind.GET_REQUEST : IpcBusLog.Kind.GET_MESSAGE,
        ipcMessage.stamp.timestamp_received = timestamp;
        ipcMessage.stamp.local = local;
        ipcMessage.stamp.peer_received = local_peer;
        const ipcMessageClone = Object.assign({}, ipcMessage, { kind: IpcBusCommand.Kind.LogRoundtrip, rawData: false });
        this.postLogRoundtrip(ipcMessageClone, args);
    }

    ackResponse(ipcMessage: IpcBusMessage, args: any[], local: boolean, local_peer: Client.IpcBusPeer) {
        let timestamp = this._log.now;
        if (ipcMessage.stamp == null) {
            local = false;
            this.stampMessage(ipcMessage, IpcBusLog.Kind.SEND_REQUEST);
            ipcMessage.peer = local_peer;
            ipcMessage.stamp.timestamp = timestamp;
            this.stampResponse(ipcMessage);
            ipcMessage.stamp.timestamp_response = timestamp;
        }
        ipcMessage.stamp.kind = IpcBusLog.Kind.GET_REQUEST_RESPONSE;
        ipcMessage.stamp.timestamp_response_received = timestamp;
        ipcMessage.stamp.response_local = local;
        const ipcMessageClone = Object.assign({}, ipcMessage, { kind: IpcBusCommand.Kind.LogRoundtrip, rawData: false });
        this.postLogRoundtrip(ipcMessageClone, args);
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
