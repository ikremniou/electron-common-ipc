import { IpcBusLogConfigMain } from './IpcBusLogConfigMain';
import type { IpcBusLogConfig } from './IpcBusLogConfig';

let g_log: IpcBusLogConfig;

/** @internal */
export function NewIpcBusLog(): IpcBusLogConfig {
    g_log = g_log || new IpcBusLogConfigMain();
    return g_log;
};
