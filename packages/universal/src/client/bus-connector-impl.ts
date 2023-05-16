import { IpcBusCommandKind } from '../contract/ipc-bus-command';
import { CheckTimeoutOptions, createContextId } from '../utils';
import { ConnectionState } from '../utils/connection-state';
import { executeInTimeout } from '../utils/execute-in-timeout';

import type { ClientCloseOptions, ClientConnectOptions } from './bus-client';
import type { ConnectorHandshake, IpcBusConnector, IpcBusConnectorClient } from './bus-connector';
import type { BusMessagePort } from './message-ports';
import type { IpcBusCommand } from '../contract/ipc-bus-command';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer, IpcBusProcessType } from '../contract/ipc-bus-peer';
import type { QueryStateConnector } from '../contract/query-state';
import type { Logger } from '../log/logger';
import type { UuidProvider } from '../utils/uuid';

export abstract class IpcBusConnectorImpl implements IpcBusConnector {
    protected id: string;
    protected _client?: IpcBusConnectorClient;
    private readonly _connectCloseState: ConnectionState;

    constructor(
        uuid: UuidProvider,
        public readonly type: IpcBusProcessType,
        private readonly _connectorType: QueryStateConnector['type'],
        protected readonly _logger?: Logger
    ) {
        this.id = uuid();
        this._connectCloseState = new ConnectionState();
    }

    public async handshake(
        client: IpcBusConnectorClient,
        peer: IpcBusPeer,
        options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        const handshake = await this._connectCloseState.connect<ConnectorHandshake>(() => {
            options = CheckTimeoutOptions(options);
            return executeInTimeout(
                options.timeoutDelay,
                async (resolve, reject) => {
                    try {
                        const handshake = await this.handshakeInternal(client, peer, options);
                        resolve(handshake);
                    } catch (error) {
                        this._logger?.error(`[BusConnector] Failed to connect. ${error}`);
                        this._connectCloseState.shutdown();
                        reject(error);
                    }
                },
                (reject) => {
                    this.shutdownInternal();
                    const message = `[BusConnector] Failed to connect after ${options.timeoutDelay}ms.`;
                    this._logger?.error(message);
                    this._connectCloseState.shutdown();
                    reject(new Error(message));
                }
            );
        });

        this.postHandshakeCommand(peer);
        handshake.peer = Object.assign(peer, handshake.peer);
        return handshake;
    }

    public shutdown(options?: ClientCloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            options = CheckTimeoutOptions(options);
            return executeInTimeout(
                options.timeoutDelay,
                async (resolve, reject) => {
                    try {
                        this.postConnectorBeforeShutdown();
                        await this.shutdownInternal(options);
                        resolve();
                    } catch (error) {
                        this._logger?.error(
                            `[BusConnector] Failed to shutdown. ${error}. Options: ${JSON.stringify(options)}`
                        );
                        this._connectCloseState.shutdown();
                        reject(error);
                    }
                },
                (reject) => {
                    const message =
                        `[BusConnector] Failed shutdown after` +
                        ` ${options.timeoutDelay}ms. Options: ${JSON.stringify(options)}`;
                    this._logger?.error(message);
                    this._connectCloseState.shutdown();
                    this.onConnectorShutdown();
                    reject(new Error(message));
                }
            );
        });
    }

    public queryState(): QueryStateConnector {
        const queryState: QueryStateConnector = {
            id: this.id,
            type: this._connectorType,
            contextId: createContextId(this.type),
        };
        return queryState;
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

    private postConnectorBeforeShutdown() {
        this._client?.onConnectorBeforeShutdown();
        const shutdownCommand: IpcBusCommand = {
            peers: this._client?.peers,
            kind: IpcBusCommandKind.Shutdown,
        };
        this.postCommand(shutdownCommand);
    }

    private postHandshakeCommand(peer: IpcBusPeer) {
        const handshakeCommand: IpcBusCommand = {
            peer,
            kind: IpcBusCommandKind.Handshake,
        };
        this.postCommand(handshakeCommand);
    }

    protected abstract handshakeInternal(
        client: IpcBusConnectorClient,
        peer: IpcBusPeer,
        options: ClientConnectOptions
    ): Promise<ConnectorHandshake>;

    protected abstract shutdownInternal(options?: ClientCloseOptions): Promise<void>;
    abstract postMessage(ipcMessage: IpcBusMessage, args?: unknown[], ports?: BusMessagePort[]): void;
    abstract postCommand(ipcCommand: IpcBusCommand): void;
}
