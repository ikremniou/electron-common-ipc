import type { ClientCloseOptions, ClientConnectOptions, IpcBusRequestResponse } from './bus-client';
import type { IpcBusConnector } from './bus-connector';
import type { BusMessagePort } from './message-ports';
import type { IpcBusMessage } from '../contract/ipc-bus-message';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { QueryStateTransport } from '../contract/query-state';

export interface IpcBusTransportClient {
    peer: IpcBusPeer;
    listeners(eventName: string): Function[];
}

export interface IpcBusTransport {
    readonly connector: IpcBusConnector;

    connect(client: IpcBusTransportClient, options: ClientConnectOptions): Promise<void>;
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
    onClosed(handler: () => void): unknown;
}
