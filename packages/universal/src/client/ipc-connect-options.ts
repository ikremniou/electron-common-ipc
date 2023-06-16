interface IpcNetOptions {
    port?: number;
    host?: string;
    path?: string;
}

export interface IpcTimeoutOptions {
    timeoutDelay?: number;
}

export interface IpcConnectOptions extends IpcNetOptions, IpcTimeoutOptions { }

export interface ConnectFunction<T> {
    (options?: T): Promise<void>;
    (path: string, options?: T): Promise<void>;
    (port: number, options?: T): Promise<void>;
    (port: number, hostname?: string, options?: T): Promise<void>;
}

export interface CloseFunction<T> {
    (options?: T): Promise<void>;
}
