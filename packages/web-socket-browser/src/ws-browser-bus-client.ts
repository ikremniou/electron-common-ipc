import { CheckConnectOptions, IpcBusClientImpl } from '@electron-common-ipc/universal';

import { defer } from './promises';

import type {
    ClientConnectOptions,
    ClientCloseOptions,
    EventEmitterLike,
    IpcBusListener,
    IpcBusTransport,
    BusMessagePort,
    IpcBusPeer,
    IpcBusRequestResponse,
    Logger,
} from '@electron-common-ipc/universal';

export interface ReconnectOptions {
    tries: number;
    await: number;
}

export class WsBrowserBusClient extends IpcBusClientImpl {
    private _isConnected?: boolean;
    private _isClosed: boolean;
    private _lastConnectionOptions?: ClientConnectOptions;

    private _closeHandler: () => void;

    constructor(
        emitter: EventEmitterLike<IpcBusListener>,
        transport: IpcBusTransport,
        private readonly _logger: Logger,
        private readonly _reconnectOptions: ReconnectOptions
    ) {
        super(emitter, transport);
        this.onConnectionClosed = this.onConnectionClosed.bind(this);
        this.subscribeOnConnectionClosed();
        this._isClosed = true;
    }

    override async connect(
        arg1?: ClientConnectOptions | string | number,
        arg2?: ClientConnectOptions | string,
        arg3?: ClientConnectOptions
    ): Promise<void> {
        await this.connectInternal(arg1, arg2, arg3);
        this._lastConnectionOptions = CheckConnectOptions(arg1, arg2, arg3);
    }

    override async close(options?: ClientCloseOptions): Promise<void> {
        this._isClosed = true;
        await super.close(options);
        this._isConnected = false;
    }

    override send(channel: string, ...args: any[]): boolean {
        return this._isConnected && super.send(channel, ...args);
    }

    override sendTo(target: IpcBusPeer, channel: string, ...args: any[]): boolean {
        return this._isConnected && super.sendTo(target, channel, ...args);
    }

    override request(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusRequestResponse> {
        if (!this._isConnected) {
            return Promise.reject(`Attempt to request on closed bus client ${this.peer?.id}`);
        }

        return super.request(channel, timeoutDelay, ...args);
    }

    override requestTo(
        target: IpcBusPeer,
        channel: string,
        timeoutDelay: number,
        ...args: any[]
    ): Promise<IpcBusRequestResponse> {
        if (!this._isConnected) {
            return Promise.reject(`Attempt to request on closed bus client ${this.peer?.id}`);
        }

        return super.requestTo(target, channel, timeoutDelay, ...args);
    }

    override postMessage(channel: string, message: unknown, messagePorts?: BusMessagePort[]): void {
        return this._isConnected && super.postMessage(channel, message, messagePorts);
    }

    override postMessageTo(
        target: IpcBusPeer,
        channel: string,
        message: unknown,
        messagePorts?: BusMessagePort[]
    ): void {
        return this._isConnected && super.postMessageTo(target, channel, message, messagePorts);
    }

    override emit(event: string, ...args: any[]): boolean {
        return this._isConnected && super.emit(event, ...args);
    }

    override onClosed(handler: () => void): void {
        this._closeHandler = handler;
    }

    private async connectInternal(
        arg1?: ClientConnectOptions | string | number,
        arg2?: ClientConnectOptions | string,
        arg3?: ClientConnectOptions
    ): Promise<void> {
        await super.connect(arg1, arg2, arg3);
        this._isConnected = true;
        this._isClosed = false;
    }

    private subscribeOnConnectionClosed(): void {
        super.onClosed(this.onConnectionClosed);
    }

    private async onConnectionClosed(): Promise<void> {
        if (!this._isConnected) {
            this._logger?.info(
                `[WsBrowserBusClient ${this.peer?.id}] Connection closed during re-connection. Ignoring...`);
            return;
        }

        this._isConnected = false;
        if (this._isClosed) {
            this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Connection closed by the consumer`);
            this._closeHandler?.();
            return;
        }

        this._logger?.info(
            `[WsBrowserBusClient ${this.peer?.id}] Connection closed unexpectedly. Trying to reconnect...`);
        this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Changing state to close...`);
        try {
            await super.close();
            this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Running reconnection loop...`);
            await this.reconnect();
        } catch (err) {
            this._logger?.warn(`[WsBrowserBusClient ${this.peer?.id}] Reconnection failed. ${err}`);
            this._closeHandler?.();
            return;
        }

        this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Reconnected successfully`);
        this.subscribeOnConnectionClosed();
    }

    private async reconnect(): Promise<void> {
        let tries = this._reconnectOptions.tries;
        if (tries === null || tries === undefined || tries < 0) {
            tries = Number.POSITIVE_INFINITY;
        }

        for (let reconnectionAttempt = 0; reconnectionAttempt < tries; reconnectionAttempt++) {
            if (this._isClosed) {
                throw new Error('Connection closed by the consumer during reconnection');
            }

            this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Reconnection attempt #${reconnectionAttempt}`);
            this._logger?.info(
                `[WsBrowserBusClient ${this.peer?.id}] Trying to reconnect after ${this._reconnectOptions.await} ms...`
                );
            try {
                return await defer(
                    () => {
                        this._logger?.info(`[WsBrowserBusClient ${this.peer?.id}] Reconnecting...`);
                        return this.connectInternal(this._lastConnectionOptions);
                    },
                    this._reconnectOptions.await);
            } catch (err) {
                this._logger?.warn(`[WsBrowserBusClient ${this.peer?.id}] Reconnection attempt failed. ${err}`);
            }
        }

        throw new Error(`Reached max reconnection attempts count ${tries}`);
    }
}
