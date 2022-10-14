import type * as Client from './IpcBusClient';
import * as IpcBusUtils from '../utils';
import type { IpcBusCommand, IpcBusMessage } from '../utils/IpcBusCommand';

import type { IpcBusTransport } from './IpcBusTransport';

/** @internal */
export function CastToMessagePort(port: Client.IpcMessagePortType): Client.IpcBusMessagePort {
    const unknownPort = port as any;
    if (unknownPort.addEventListener && !unknownPort.addListener) {
        unknownPort.on = unknownPort.addListener = unknownPort.addEventListener;
        unknownPort.off = unknownPort.removeListener = unknownPort.addRemoveListener;
        unknownPort.once = (event: string, listener: (...args: any[]) => void) => {
            return unknownPort.addEventListener(event, listener, { once: true });
        }
    }
    else if (!unknownPort.addEventListener && unknownPort.addListener) {
        unknownPort.addEventListener = (event: string, listener: (...args: any[]) => void, options: any) => {
            if (typeof options === 'object' && options.once) {
                return unknownPort.once(event, listener);
            }
            else {
                return unknownPort.addListener(event, listener);
            }
        }
        unknownPort.removeEventListener = unknownPort.addListener;
    }
    return unknownPort as Client.IpcBusMessagePort;
}

/** @internal */
export class DeferredRequestPromise {
    public promise: Promise<Client.IpcBusRequestResponse>;

    public resolve: (value: Client.IpcBusRequestResponse) => void;
    public reject: (err: Client.IpcBusRequestResponse) => void;

    client: IpcBusTransport.Client;
    request: IpcBusCommand.Request;

    private _settled: boolean;

    constructor(client: IpcBusTransport.Client, request: IpcBusCommand.Request) {
        this.client = client;
        this.request = request;
        this.promise = new Promise<Client.IpcBusRequestResponse>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        })
        // Prevent unhandled rejected promise
        this.promise.catch(() => { });
        this._settled = false;
    }

    isSettled(): boolean {
        return this._settled;
    }

    settled(ipcResponse: IpcBusMessage, args: any[]) {
        if (this._settled === false) {
            const ipcBusEvent: Client.IpcBusEvent = { channel: ipcResponse.request.channel, sender: ipcResponse.peer };
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcResponse.request.id}`);
            try {
                if (ipcResponse.request.resolve === true) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] resolve`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, payload: args[0] };
                    this.resolve(response);
                }
                else {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${args[0]}`);
                    const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: args[0] };
                    this.reject(response);
                }
            }
            catch (err) {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport] reject: ${err}`);
                const response: Client.IpcBusRequestResponse = { event: ipcBusEvent, err: JSON.stringify(err) };
                this.reject(response);
            }
            this._settled = true;
        }
    }

    timeout(): void {
        const response: Client.IpcBusRequestResponse = {
            event: {
                channel: this.request.channel,
                sender: this.client.peer
            },
            err: 'timeout'
        };
        this.reject(response);
    }
}
