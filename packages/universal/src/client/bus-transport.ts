import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { QueryStateTransport } from '../contract/query-state';
import type { ClientCloseOptions, ClientConnectOptions, IpcBusRequestResponse } from './bus-client';
import type { BusMessagePort } from './message-ports';

export interface IpcBusTransportClient {
    peer: IpcBusPeer | null;
    listeners(eventName: string): Function[];
}

export interface IpcBusTransport {
    connect(client: IpcBusTransportClient, options: ClientConnectOptions): Promise<IpcBusPeer>;
    close(client: IpcBusTransportClient, options?: ClientCloseOptions): Promise<void>;

    createDirectChannel(client: IpcBusTransportClient): string;

    isTarget(ipcMessage: IpcBusMessage): boolean;
    getChannels(): string[];

    addChannel(client: IpcBusTransportClient, channel: string, count?: number): void;
    removeChannel(client: IpcBusTransportClient, channel?: string, all?: boolean): void;

    postRequestMessage(
        client: IpcBusTransportClient,
        target: IpcBusPeer | undefined,
        channel: string,
        timeoutDelay: number,
        args: unknown[]
    ): Promise<IpcBusRequestResponse>;
    postMessage(
        client: IpcBusTransportClient,
        target: IpcBusPeer | undefined,
        channel: string,
        args: unknown[],
        messagePorts?: BusMessagePort[]
    ): void;

    queryState(): QueryStateTransport;
}
