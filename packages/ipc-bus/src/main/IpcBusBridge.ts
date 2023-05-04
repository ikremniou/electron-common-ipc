import type { IpcConnectOptions, IpcTimeoutOptions } from '@electron-common-ipc/universal';

export interface BridgeConnectOptions extends IpcConnectOptions {
    // 'false' by default
    server?: boolean;
}

export interface BridgeCloseOptions extends IpcTimeoutOptions {}
export interface BridgeConnectFunction {
    (options: BridgeConnectOptions): Promise<void>;
    (path: string, options?: BridgeConnectOptions): Promise<void>;
    (port: number, options?: BridgeConnectOptions): Promise<void>;
    (port: number, hostname?: string, options?: BridgeConnectOptions): Promise<void>;
}
export interface BridgeCloseFunction {
    (options?: BridgeCloseOptions): Promise<void>;
}

export interface IpcBusBridge {
    connect: BridgeConnectFunction;
    close: BridgeCloseFunction;
}
