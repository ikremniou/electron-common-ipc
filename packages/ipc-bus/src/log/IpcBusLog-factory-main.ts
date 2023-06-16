import { CreateIpcBusLogSingleton } from './IpcBusLog-factory';
import { IpcBusLogConfigMain } from './IpcBusLogConfig-main';

import type { IpcBusLogConfig } from '@electron-common-ipc/universal';

/** @internal */
export const CreateIpcBusLog = (): IpcBusLogConfig => {
    return CreateIpcBusLogSingleton('IpcBusLogConfigMain', () => new IpcBusLogConfigMain());
};
