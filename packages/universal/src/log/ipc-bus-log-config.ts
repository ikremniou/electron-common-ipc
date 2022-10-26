export enum ContractLogLevel {
    None = 0,
    Traffic = 1,
    Args = 2,
    Max = Traffic + Args,
}

export interface IpcBusLogConfig {
    level: ContractLogLevel;
    baseTime: number;
    now: number;
    argMaxContentLen: number;
}
