import type { EventEmitter } from 'events';

import type * as Client from './IpcBusClient';
import type { IpcBusMessage } from './IpcBusCommand';

/** @internal */
export namespace IpcBusTransport {
    /** @internal */
    export interface Client extends EventEmitter {
        peer: Client.IpcBusPeer;
    }
}

/** @internal */
export interface IpcBusTransport {
    connect(client: IpcBusTransport.Client, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer>;
    close(client: IpcBusTransport.Client, options?: Client.IpcBusClient.CloseOptions): Promise<void>;

    createDirectChannel(client: IpcBusTransport.Client): string;

    isTarget(ipcMessage: IpcBusMessage): boolean;
    getChannels(): string[];

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void;
    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void;

    requestMessage(client: IpcBusTransport.Client, target: Client.IpcBusPeer | Client.IpcBusPeerProcess | undefined, channel: string, timeoutDelay: number, args: any[]): Promise<Client.IpcBusRequestResponse>;
    postMessage(client: IpcBusTransport.Client, target: Client.IpcBusPeer | Client.IpcBusPeerProcess | undefined, channel: string, args: any[], ipcPorts?: Client.IpcBusMessagePort[]): void;
}
