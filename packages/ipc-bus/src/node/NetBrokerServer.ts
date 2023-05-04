import { executeInTimeout } from '@electron-common-ipc/universal';

import { NetBrokerClient } from './NetBrokerClient';

import type { BrokerServer, ClientCloseOptions, Logger, BrokerClient } from '@electron-common-ipc/universal';
import type * as net from 'net';

export class NetBrokerServer implements BrokerServer {
    private _onCloseHandler?: () => void;
    private _onErrorHandler?: (error: Error) => void;
    private _onConnectionHandler?: (client: BrokerClient) => void;

    constructor(private _server: net.Server, private readonly _logger?: Logger) {
        this._onClose = this._onClose.bind(this);
        this._onError = this._onError.bind(this);
        this._onConnection = this._onConnection.bind(this);
    }

    close(options?: ClientCloseOptions): Promise<void> {
        if (!this._server) {
            return Promise.resolve();
        }

        return executeInTimeout(
            options?.timeoutDelay,
            (resolve) => {
                this._server.removeAllListeners();
                this._server.addListener('close', () => {
                    this._server.removeAllListeners();
                    this._server = undefined;
                    resolve();
                });
                this._server.addListener('error', (err) => {
                    this._logger?.error(`[IPCBus:Broker] error on close: ${err}`);
                });

                this._server.close();
            },
            (reject) => {
                this._server.removeAllListeners();
                const msg = `[IPCBus:Broker] stop, error = timeout (${options.timeoutDelay} ms) on ${JSON.stringify(
                    options
                )}`;
                this._logger?.error(msg);
                reject(msg);
            }
        );
    }

    subscribe(
        onClose: () => void,
        onError: (error: Error) => void,
        onConnection: (client: BrokerClient) => void
    ): void {
        this._onCloseHandler = onClose;
        this._onErrorHandler = onError;
        this._onConnectionHandler = onConnection;

        this._server.on('close', this._onClose);
        this._server.on('error', this._onError);
        this._server.on('connection', this._onConnection);
    }

    unsubscribe(): void {
        this._onCloseHandler = undefined;
        this._onErrorHandler = undefined;
        this._onConnectionHandler = undefined;

        this._server.off('close', this._onClose);
        this._server.off('error', this._onError);
        this._server.off('connection', this._onConnection);
    }

    private _onConnection(socket: net.Socket): void {
        const socketWrapper = new NetBrokerClient(socket, this._logger);
        this._onConnectionHandler(socketWrapper);
    }

    private _onClose(): void {
        this._onCloseHandler?.();
    }

    private _onError(error: Error): void {
        this._onErrorHandler?.(error);
    }
}
