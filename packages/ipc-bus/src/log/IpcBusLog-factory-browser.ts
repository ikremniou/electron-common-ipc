import { IpcBusLogConfigImpl } from '@electron-common-ipc/universal';

import { CreateIpcBusLogSingleton } from './IpcBusLog-factory';

import type { IpcBusLogConfig } from '@electron-common-ipc/universal';

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    return CreateIpcBusLogSingleton('IpcBusLogConfigMain', () => new IpcBusLogConfigImpl());
};

const windowLocal = window as unknown as Record<string, typeof CreateIpcBusLog>;
windowLocal.CreateIpcBusLog = CreateIpcBusLog;
