import type { IpcBusLogConfig } from './IpcBusLogConfig';

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    const newModule = require('./IpcBusLog-new-renderer');
    return newModule.NewIpcBusLog();
};

const windowLocal = window as any;
windowLocal.CreateIpcBusLog = CreateIpcBusLog;
