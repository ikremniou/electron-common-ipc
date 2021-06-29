// import { IpcPacketBuffer } from 'socket-serializer';
import type { IpcBusConnector } from './IpcBusConnector';
import { IpcBusCommand, IpcBusMessage } from './IpcBusCommand';
import type * as Client from './IpcBusClient';
import type { IpcBusLogConfig } from './log/IpcBusLogConfig';
import { CreateIpcBusLog } from './log/IpcBusLog-factory';
import { ConnectCloseState } from './IpcBusUtils';

// Implementation for renderer process
/** @internal */
export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client: IpcBusConnector.Client;
    protected _process: Client.IpcBusProcess;
    protected _messageCount: number;
    protected _log: IpcBusLogConfig;

    protected _connectCloseState: ConnectCloseState<IpcBusConnector.Handshake>;

    constructor(contextType: Client.IpcBusProcessType) {
        this._process = {
            type: contextType,
            pid: process ? process.pid: -1
        };

        this._connectCloseState = new ConnectCloseState<IpcBusConnector.Handshake>();

        this._log = CreateIpcBusLog();
        this._messageCount = 0;
    }

    protected onConnectorBeforeShutdown() {
        this._client && this._client.onConnectorBeforeShutdown();
    }

    protected onConnectorHandshake() {
        const handshakeCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.Handshake,
            channel: ''
        };
        this.postCommand(handshakeCommand);
    }

    protected onConnectorShutdown() {
        const shutdownCommand: IpcBusCommand = {
            kind: IpcBusCommand.Kind.Shutdown,
            channel: ''
        };
        this.postCommand(shutdownCommand);
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

    // protected cloneCommand(command: IpcBusCommand): IpcBusCommand.LogCommand {
    //     const logCommand: IpcBusCommand.LogCommand = {
    //         kind: command.kind,
    //         peer: command.peer,
    //         channel: command.channel,
    //         request: command.request
    //     };
    //     return logCommand;
    // }

    // logMessageSend(previousLog: IpcBusCommand.Log, ipcCommand: IpcBusCommand): IpcBusCommand.Log {
        // if (this._log.level >= IpcBusLogConfig.Level.Sent) {
        //     // static part . dynamic part
        //     const id = `${this._endpoint.id}.${this._messageCount++}`;
        //     ipcCommand.log = {
        //         id,
        //         kind: ipcCommand.kind,
        //         peer: ipcCommand.peer,
        //         timestamp: this._log.now,
        //         command: this.cloneCommand(ipcCommand),
        //         previous: previousLog,
        //     };
        //     while (previousLog) {
        //         ipcCommand.log.related_peer = previousLog.peer;
        //         previousLog = previousLog.previous;
        //     }
        //     return ipcCommand.log;
        // }
    //     return null;
    // }

    // logLocalMessage(peer: Client.IpcBusPeer, ipcBusCommandLocal: IpcBusCommand, argsResponse: any[]): IpcBusCommand.Log {
        // if (this._log.level >= IpcBusLogConfig.Level.Sent) {
        //     // Clone first level
        //     const ipcBusCommandLog: IpcBusCommand = Object.assign({}, ipcBusCommandLocal);
        //     ipcBusCommandLog.kind = `LOG${ipcBusCommandLocal.kind}` as IpcBusCommand.Kind;
        //     // ipcBusCommandLog.log = ipcBusCommandLocal.log; 
        //     ipcBusCommandLog.log.local = true;
        //     this.postCommand(ipcBusCommandLog, argsResponse);
        //     return ipcBusCommandLog.log;
        // }
    //     return null;
    // }

    // logMessageGet(peer: Client.IpcBusPeer, local: boolean, ipcBusCommandPrevious: IpcBusCommand, args: any[]): IpcBusCommand.Log {
        // if (this._log.level & IpcBusLogConfig.Level.Get) {
        //     const ipcBusCommandLog: IpcBusCommand = {
        //         kind: IpcBusCommand.Kind.LogGetMessage,
        //         peer,
        //         channel: ''
        //     };
        //     this.logMessageSend(ipcBusCommandPrevious.log, ipcBusCommandLog);
        //     ipcBusCommandLog.log.command = this.cloneCommand(ipcBusCommandPrevious);
        //     ipcBusCommandLog.log.related_peer = ipcBusCommandPrevious.peer;
        //     ipcBusCommandLog.log.local = local;
        //     if (this._log.level & IpcBusLogConfig.Level.GetArgs) {
        //         this.postCommand(ipcBusCommandLog, args);
        //     }
        //     else {
        //         this.postCommand(ipcBusCommandLog);
        //     }
        //     return ipcBusCommandLog.log;
        // }
    //     return null;
    // }

    abstract isTarget(ipcMessage: IpcBusMessage): boolean;

    abstract handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake>;
    abstract shutdown(options: Client.IpcBusClient.CloseOptions): Promise<void>;

    abstract postMessage(ipcBusMessage: IpcBusMessage, args?: any[]): void;
    abstract postCommand(ipcCommand: IpcBusCommand): void;
    abstract postBuffers(buffers: Buffer[]): void;
}
