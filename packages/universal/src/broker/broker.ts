import type {
    CloseFunction,
    ConnectFunction,
    IpcConnectOptions,
    IpcTimeoutOptions,
} from '../client/ipc-connect-options';

export type BrokerConnectOptions = IpcConnectOptions;
export type BrokerCloseOptions = IpcTimeoutOptions;

export interface IpcBusBroker {
    connect: ConnectFunction<BrokerConnectOptions>;
    close: CloseFunction<BrokerCloseOptions>;
}

