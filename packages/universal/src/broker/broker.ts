import type { BrokerClient } from './broker-client';
import type {
    CloseFunction,
    ConnectFunction,
    IpcConnectOptions,
    IpcTimeoutOptions,
} from '../client/ipc-connect-options';
import type { IpcBusCommandKind } from '../contract/ipc-bus-command';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';

export type BrokerConnectOptions = IpcConnectOptions;
export type BrokerCloseOptions = IpcTimeoutOptions;

export interface IpcBusBrokerPrivate {
    addHandler(message: IpcBusCommandKind, handler: () => void): void;
    addClient(peer: IpcBusPeer, client: BrokerClient): void;
}

export interface IpcBusBroker {
    connect: ConnectFunction<BrokerConnectOptions>;
    close: CloseFunction<BrokerCloseOptions>;
}

