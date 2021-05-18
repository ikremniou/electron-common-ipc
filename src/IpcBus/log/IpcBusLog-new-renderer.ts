import type { IpcBusLogConfig } from './IpcBusLogConfig';
import { IpcBusLogConfigImpl } from './IpcBusLogConfigImpl';

let g_log: IpcBusLogConfig;

/** @internal */
export function NewIpcBusLog(): IpcBusLogConfig {
    g_log = g_log || new IpcBusLogConfigImpl();
    return g_log;
};
