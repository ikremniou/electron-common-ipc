import { executeInTimeout } from '@electron-common-ipc/universal';

import { WsBrokerClient } from './ws-broker-client';

import type { BrokerServer, BrokerClient, BrokerCloseOptions, JsonLike } from '@electron-common-ipc/universal';
import type { WebSocketServer, WebSocket } from 'ws';

export class WsBrokerServer implements BrokerServer {
    private _onCloseHandler?: () => void;
    private _onErrorHandler?: (error: Error) => void;
    private _onConnectionHandler?: (client: BrokerClient) => void;

    constructor(private readonly _server: WebSocketServer, private readonly _json: JsonLike) {
        this._onClose = this._onClose.bind(this);
        this._onError = this._onError.bind(this);
        this._onConnection = this._onConnection.bind(this);
    }

    public subscribe(
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

    public unsubscribe(): void {
        this._onCloseHandler = undefined;
        this._onErrorHandler = undefined;
        this._onConnectionHandler = undefined;

        this._server.off('close', this._onClose);
        this._server.off('error', this._onError);
        this._server.off('connection', this._onConnection);
    }

    public close(options?: BrokerCloseOptions): Promise<void> {
        return executeInTimeout(
            options.timeoutDelay,
            (resolve, reject) => {
                this.unsubscribe();
                this._server.close((error?: Error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve();
                });
            },
            (reject) => {
                const message = `[WsBrokerServer] stop, error = timeout (${
                    options.timeoutDelay
                } ms) on ${JSON.stringify(options)}`;
                reject(new Error(message));
            }
        );
    }

    private _onConnection(socket: WebSocket): void {
        const socketWrapper = new WsBrokerClient(socket, this._json);
        this._onConnectionHandler(socketWrapper);
    }

    private _onClose(): void {
        this._onCloseHandler?.();
    }

    private _onError(error: Error): void {
        this._onErrorHandler?.(error);
    }
}
