export namespace IpcBusLogConfig {
    export enum Level {
        None = 0,
        Traffic = 1,
        Args = 2,
        Max = Traffic + Args
    }
}

/** @internal */
export interface IpcBusLogConfig {
    level: IpcBusLogConfig.Level;
    baseTime: number;
    now: number;
    hrnow: number;
    argMaxContentLen: number;
}
