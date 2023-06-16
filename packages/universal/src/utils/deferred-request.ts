import type { IpcBusEvent, IpcBusRequestResponse } from '../client/bus-client';
import type { IpcBusTransportClient } from '../client/bus-transport';
import type { IpcBusMessage, MessageRequest } from '../contract/ipc-bus-message';
import type { Logger } from '../log/logger';

export class DeferredRequestPromise {
    public promise: Promise<IpcBusRequestResponse>;

    public resolve: (value: IpcBusRequestResponse) => void;
    public reject: (err: IpcBusRequestResponse) => void;

    private _settled: boolean;

    constructor(
        public readonly client: IpcBusTransportClient,
        public readonly request: MessageRequest,
        private readonly _logger?: Logger
    ) {
        this.client = client;
        this.request = request;
        this.promise = new Promise<IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
        // Prevent unhandled rejected promise
        this.promise.catch(() => {});
        this._settled = false;
    }

    isSettled(): boolean {
        return this._settled;
    }

    settled(ipcResponse: IpcBusMessage, args: unknown[]) {
        if (this._settled === false) {
            const ipcBusEvent: IpcBusEvent = { channel: ipcResponse.request.channel, sender: ipcResponse.peer };
            this._logger?.info(
                `[IPCBusTransport] Peer #${ipcBusEvent.sender.name}-${ipcBusEvent.sender.id}` +
                    ` replied to request on ${ipcResponse.request.id}`
            );
            try {
                if (ipcResponse.request.resolve === true) {
                    this._logger?.info(`[IPCBusTransport] resolve`);
                    const response: IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    this.resolve(response);
                } else {
                    this._logger?.info(`[IPCBusTransport] reject: ${args[0]}`);
                    const response: IpcBusRequestResponse = { event: ipcBusEvent, err: args[0].toString() };
                    this.reject(response);
                }
            } catch (err) {
                this._logger?.info(`[IPCBusTransport] reject: ${err}`);
                const response: IpcBusRequestResponse = { event: ipcBusEvent, err: JSON.stringify(err) };
                this.reject(response);
            }
            this._settled = true;
        }
    }

    timeout(): void {
        const response: IpcBusRequestResponse = {
            event: {
                channel: this.request.channel,
                sender: this.client.peer,
            },
            err: 'timeout',
        };
        this.reject(response);
    }
}
