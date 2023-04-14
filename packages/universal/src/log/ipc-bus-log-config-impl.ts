import { ContractLogLevel } from './ipc-bus-log-config';

import type { IpcBusLogConfig } from './ipc-bus-log-config';

const enum Env {
    LogLevelEnv = 'ELECTRON_IPC_LOG_LEVEL',
    LogBaseTimeEnv = 'ELECTRON_IPC_LOG_BASE_TIME',
    ArgMaxContentLenEnv = 'ELECTRON_IPC_LOG_ARG_MAX_CONTENT_LEN',
}

export class IpcBusLogConfigImpl implements IpcBusLogConfig {
    protected _level: ContractLogLevel;
    protected _baseTime: number;
    protected _argMaxContentLen: number;

    constructor() {
        const levelFromEnv = this.getLevelFromEnv();
        this._level = Math.max(ContractLogLevel.None, levelFromEnv);
        const baseTimeFromEnv = this.getBaseTimeFromEnv();
        this._baseTime = Math.max(this.now, baseTimeFromEnv);
        const argMaxLenFromEnv = this.getArgMaxContentLenFromEnv();
        this._argMaxContentLen = Math.max(-1, argMaxLenFromEnv);
    }

    protected getLevelFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const levelAny = process.env[Env.LogLevelEnv];
            if (levelAny !== undefined) {
                let level = Number(levelAny);
                level = Math.min(level, ContractLogLevel.Max);
                level = Math.max(level, ContractLogLevel.None);
                return level;
            }
        }
        return -1;
    }

    protected getBaseTimeFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const baseTimeAny = process.env[Env.LogBaseTimeEnv];
            if (baseTimeAny !== undefined) {
                const baseline = Number(baseTimeAny);
                return baseline;
            }
        }
        return -1;
    }

    protected getArgMaxContentLenFromEnv(): number {
        // In renderer process, there is no process object
        if (process && process.env) {
            const argMaxContentLenAny = process.env[Env.ArgMaxContentLenEnv];
            if (argMaxContentLenAny !== undefined) {
                const argMaxContentLen = Number(argMaxContentLenAny);
                return argMaxContentLen;
            }
        }
        return -1;
    }

    get level(): ContractLogLevel {
        return this._level;
    }

    set level(level: ContractLogLevel) {
        if (process && process.env) {
            process.env[Env.LogLevelEnv] = level.toString();
        }
        this._level = level;
    }

    get baseTime(): number {
        return this._baseTime;
    }

    set baseTime(baseTime: number) {
        if (process && process.env) {
            process.env[Env.LogBaseTimeEnv] = baseTime.toString();
        }
        this._baseTime = baseTime;
    }

    get now(): number {
        return Date.now();
    }

    set argMaxContentLen(argMaxContentLen: number) {
        argMaxContentLen = argMaxContentLen === undefined ? -1 : argMaxContentLen;
        if (process && process.env) {
            process.env[Env.ArgMaxContentLenEnv] = argMaxContentLen.toString();
        }
        this._argMaxContentLen = argMaxContentLen;
    }

    get argMaxContentLen(): number {
        return this._argMaxContentLen;
    }
}
