import { newIpcBusClient as CreateIpcBusClient } from './client/IpcBusClient-factory-renderer';

import type { IpcBusClient } from '@electron-common-ipc/universal';

declare global {
    interface Window {
        ElectronCommonIpc: {
            CreateIpcBusClient: () => IpcBusClient;
        };
    }
}

export * from './common';
export * from '@electron-common-ipc/universal/lib/public';
export { CreateIpcBusClient };
