import { IpcBusLogConfigImpl } from '@electron-common-ipc/universal';

import { CreateIpcBusLogSingleton } from './IpcBusLog-factory';

import type { IpcBusLogConfig } from '@electron-common-ipc/universal';

export const CreateIpcBusLog = (): IpcBusLogConfig => {
    return CreateIpcBusLogSingleton('IpcBusLogConfigNode', () => new IpcBusLogConfigImpl());
};
