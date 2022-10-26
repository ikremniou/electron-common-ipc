import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { ConnectionState } from '../utils/connection-state';

import type { IpcBusCommand } from '../contract/ipc-bus-command';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer, IpcBusProcessType } from '../contract/ipc-bus-peer';
import type { QueryStateConnector } from '../contract/query-state';
import type { UuidProvider } from '../utils/uuid';
import type { ClientCloseOptions, ClientConnectOptions } from './bus-client';
import type { ConnectorHandshake, IpcBusConnector, IpcBusConnectorClient } from './bus-connector';
import type { BusMessagePort } from './message-ports';

export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected _client?: IpcBusConnectorClient;
    protected _peer: IpcBusPeer;

    protected _connectCloseState: ConnectionState;

    constructor(
        uuid: UuidProvider,
        processContextType: IpcBusProcessType,
        private readonly _connectorType: QueryStateConnector['type']
    ) {
        this._peer = {
            id: `${uuid()}`,
            type: processContextType,
        };

        this._connectCloseState = new ConnectionState();
    }

    get peer() {
        return this._peer;
    }

    queryState(): QueryStateConnector {
        const queryState: QueryStateConnector = {
            type: this._connectorType,
            peer: this._peer,
        };
        return queryState;
    }

    protected onConnectorBeforeShutdown() {
        this._client?.onConnectorBeforeShutdown();
        const shutdownCommand: IpcBusCommand = {
            kind: IpcBusCommandKind.Shutdown,
            channel: '',
        };
        this.postCommand(shutdownCommand);
    }

    protected onConnectorHandshake() {
        const handshakeCommand: IpcBusCommand = {
            kind: IpcBusCommandKind.Handshake,
            channel: '',
        };
        this.postCommand(handshakeCommand);
    }

    protected onConnectorShutdown() {
        this._connectCloseState.shutdown();
        this._client?.onConnectorShutdown();
        this.removeClient();
    }

    protected addClient(client: IpcBusConnectorClient) {
        this._client = client;
    }

    protected removeClient() {
        this._client = undefined;
    }

    abstract isTarget(ipcMessage: IpcBusMessage): boolean;
    abstract handshake(client: IpcBusConnectorClient, options: ClientConnectOptions): Promise<ConnectorHandshake>;
    abstract shutdown(options?: ClientCloseOptions): Promise<void>;

    abstract postMessage(ipcMessage: IpcBusMessage, args?: unknown[], ports?: BusMessagePort[]): void;
    abstract postCommand(ipcCommand: IpcBusCommand): void;
}
