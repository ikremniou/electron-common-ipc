export interface IpcBusBrokerProxy {
    getInstance?<T>(): T;
    close(): Promise<void>;
}
